// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IERC20TokenPredicate.sol";
import "./interfaces/IERC20Token.sol";
import "./interfaces/IGateway.sol";
import "./System.sol";

/**
    @title ERC20TokenPredicate
    @author Polygon Technology (@QEDK)
    @notice Enables ERC20 token deposits and withdrawals across an arbitrary root chain and token chain
 */
// solhint-disable reason-string
contract ERC20TokenPredicate is IERC20TokenPredicate, Initializable, System {
    using SafeERC20 for IERC20;

    /// @custom:security write-protection="onlySystemCall()"
    IGateway public gateway;
    /// @custom:security write-protection="onlySystemCall()"
    address public rootERC20Predicate;
    /// @custom:security write-protection="onlySystemCall()"
    address public tokenTemplate;
    bytes32 public constant DEPOSIT_SIG = keccak256("DEPOSIT");
    bytes32 public constant WITHDRAW_SIG = keccak256("WITHDRAW");
    bytes32 public constant MAP_TOKEN_SIG = keccak256("MAP_TOKEN");

    mapping(address => address) public rootTokenToToken;

    event Deposit(
        address indexed rootToken,
        address indexed token,
        address sender,
        address indexed receiver,
        uint256 amount
    );
    event Withdraw(
        address indexed rootToken,
        address indexed token,
        address sender,
        string receiver,
        uint256 amount
    );
    event TokenMapped(address indexed rootToken, address indexed token);

    /**
     * @notice Initialization function for ERC2Token0Predicate
     * @param newGateway Address of Gaeaway to receive deposit information from
     * @param newRootERC20Predicate Address of root ERC20 predicate to communicate with
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @param newNativeTokenRootAddress Address of native token on root chain
     * @dev Can only be called once. `newNativeTokenRootAddress` should be set to zero where root token does not exist.
     */
    function initialize(
        address newGateway,
        address newRootERC20Predicate,
        address newTokenTemplate,
        address newNativeTokenRootAddress
    ) public virtual onlySystemCall initializer {
        _initialize(
            newGateway,
            newRootERC20Predicate,
            newTokenTemplate,
            newNativeTokenRootAddress
        );
    }

    /**
     * @notice Function to be used for token deposits
     * @param data Data sent by the sender
     * @dev Can be extended to include other signatures for more functionality
     */
    function onStateReceive(
        uint256 /* id */,
        // address sender,
        bytes calldata data
    ) external {
        require(
            msg.sender == address(gateway),
            "ERC20TokenPredicate: ONLY_GATEWAY_ALLOWED"
        );

        if (bytes32(data[:32]) == DEPOSIT_SIG) {
            _deposit(data[32:]);
        } else if (bytes32(data[:32]) == MAP_TOKEN_SIG) {
            _mapToken(data);
        } else {
            revert("ERC20TokenPredicate: INVALID_SIGNATURE");
        }
    }

    /**
     * @notice Function to withdraw tokens from the withdrawer to themselves on the root chain
     * @param token Address of the token being withdrawn
     * @param amount Amount to withdraw
     */
    function withdraw(
        IERC20Token token,
        string calldata receiver,
        uint256 amount
    ) external {
        _withdraw(token, msg.sender, receiver, amount);
    }

    /**
     * @notice Internal initialization function for ERC20TokenPredicate
     * @param newGateway Address of Gatewey to receive deposit information from
     * @param newRootERC20Predicate Address of root ERC20 predicate to communicate with
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @param newNativeTokenRootAddress Address of native token on root chain
     * @dev Can be called multiple times.
     */
    function _initialize(
        address newGateway,
        address newRootERC20Predicate,
        address newTokenTemplate,
        address newNativeTokenRootAddress
    ) internal {
        require(
            newGateway != address(0) &&
                newRootERC20Predicate != address(0) &&
                newTokenTemplate != address(0),
            "ERC20TokenPredicate: BAD_INITIALIZATION"
        );
        gateway = IGateway(newGateway);
        rootERC20Predicate = newRootERC20Predicate;
        tokenTemplate = newTokenTemplate;
        if (newNativeTokenRootAddress != address(0)) {
            rootTokenToToken[newNativeTokenRootAddress] = NATIVE_TOKEN_CONTRACT;
            // slither-disable-next-line reentrancy-events
            emit TokenMapped(newNativeTokenRootAddress, NATIVE_TOKEN_CONTRACT);
        }
    }

    function _withdraw(
        IERC20Token token,
        address caller,
        string calldata receiver,
        uint256 amount
    ) private {
        require(
            address(token).code.length != 0,
            "ERC20TokenPredicate: NOT_CONTRACT"
        );

        address rootToken = token.rootToken();

        require(
            rootTokenToToken[rootToken] == address(token),
            "ERC20TokenPredicate: UNMAPPED_TOKEN"
        );
        // a mapped token should never have root token unset
        assert(rootToken != address(0));
        // a mapped token should never have predicate unset
        assert(token.predicate() == address(this));

        require(token.burn(caller, amount), "ERC20TokenPredicate: BURN_FAILED");
        gateway.syncState(
            abi.encode(WITHDRAW_SIG, rootToken, msg.sender, receiver, amount)
        );

        // slither-disable-next-line reentrancy-events

        emit Withdraw(rootToken, address(token), msg.sender, receiver, amount);
    }

    function _deposit(bytes calldata data) private {
        (
            address depositToken,
            address depositor,
            address receiver,
            uint256 amount
        ) = abi.decode(data, (address, address, address, uint256));

        IERC20Token token = IERC20Token(rootTokenToToken[depositToken]);

        require(
            address(token) != address(0),
            "ERC20TokenPredicate: UNMAPPED_TOKEN"
        );
        assert(address(token).code.length != 0);

        address rootToken = IERC20Token(token).rootToken();

        // a mapped token should match deposited token
        assert(rootToken == depositToken);
        // a mapped token should never have root token unset
        assert(rootToken != address(0));
        // a mapped token should never have predicate unset
        assert(IERC20Token(token).predicate() == address(this));

        require(
            IERC20Token(token).mint(receiver, amount),
            "ERC20TokenPredicate: MINT_FAILED"
        );

        // slither-disable-next-line reentrancy-events
        emit Deposit(depositToken, address(token), depositor, receiver, amount);
    }

    /**
     * @notice Function to be used for mapping a root token to a token
     * @dev Allows for 1-to-1 mappings for any root token to a token
     */
    function _mapToken(bytes calldata data) private {
        (
            ,
            address rootToken,
            string memory name,
            string memory symbol,
            uint8 decimals
        ) = abi.decode(data, (bytes32, address, string, string, uint8));
        assert(rootToken != address(0)); // invariant since root predicate performs the same check
        assert(rootTokenToToken[rootToken] == address(0)); // invariant since root predicate performs the same check
        IERC20Token token = IERC20Token(
            Clones.cloneDeterministic(
                tokenTemplate,
                keccak256(abi.encodePacked(rootToken))
            )
        );
        rootTokenToToken[rootToken] = address(token);
        token.initialize(rootToken, name, symbol, decimals);

        // slither-disable-next-line reentrancy-events
        emit TokenMapped(rootToken, address(token));
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
