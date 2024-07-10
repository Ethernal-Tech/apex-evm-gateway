// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IERC20TokenPredicate.sol";
import "./interfaces/IERC20Token.sol";
import "./interfaces/IStateSender.sol";
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
    IStateSender public l2StateSender;
    /// @custom:security write-protection="onlySystemCall()"
    address public stateReceiver;
    /// @custom:security write-protection="onlySystemCall()"
    address public rootERC20Predicate;
    /// @custom:security write-protection="onlySystemCall()"
    address public tokenTemplate;
    bytes32 public constant DEPOSIT_SIG = keccak256("DEPOSIT");
    bytes32 public constant WITHDRAW_SIG = keccak256("WITHDRAW");
    bytes32 public constant MAP_TOKEN_SIG = keccak256("MAP_TOKEN");

    mapping(address => address) public rootTokenToToken;

    event L2ERC20Deposit(
        address indexed rootToken,
        address indexed token,
        address sender,
        address indexed receiver,
        uint256 amount
    );
    event L2ERC20Withdraw(
        address indexed rootToken,
        address indexed token,
        address sender,
        address indexed receiver,
        uint256 amount
    );
    event L2TokenMapped(address indexed rootToken, address indexed token);

    /**
     * @notice Initialization function for ERC2Token0Predicate
     * @param newL2StateSender Address of L2StateSender to send exit information to
     * @param newStateReceiver Address of StateReceiver to receive deposit information from
     * @param newRootERC20Predicate Address of root ERC20 predicate to communicate with
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @param newNativeTokenRootAddress Address of native token on root chain
     * @dev Can only be called once. `newNativeTokenRootAddress` should be set to zero where root token does not exist.
     */
    function initialize(
        address newL2StateSender,
        address newStateReceiver,
        address newRootERC20Predicate,
        address newTokenTemplate,
        address newNativeTokenRootAddress
    ) public virtual onlySystemCall initializer {
        _initialize(
            newL2StateSender,
            newStateReceiver,
            newRootERC20Predicate,
            newTokenTemplate,
            newNativeTokenRootAddress
        );
    }

    /**
     * @notice Function to be used for token deposits
     * @param sender Address of the sender on the root chain
     * @param data Data sent by the sender
     * @dev Can be extended to include other signatures for more functionality
     */
    function onStateReceive(
        uint256 /* id */,
        address sender,
        bytes calldata data
    ) external {
        require(
            msg.sender == stateReceiver,
            "ERC20TokenPredicate: ONLY_STATE_RECEIVER"
        );
        require(
            sender == rootERC20Predicate,
            "ERC20TokenPredicate: ONLY_ROOT_PREDICATE"
        );

        if (bytes32(data[:32]) == DEPOSIT_SIG) {
            _beforeTokenDeposit();
            _deposit(data[32:]);
            _afterTokenDeposit();
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
    function withdraw(IERC20Token token, uint256 amount) external {
        _beforeTokenWithdraw();
        _withdraw(token, msg.sender, amount);
        _afterTokenWithdraw();
    }

    /**
     * @notice Function to withdraw tokens from the withdrawer to another address on the root chain
     * @param token Address of the token being withdrawn
     * @param receiver Address of the receiver on the root chain
     * @param amount Amount to withdraw
     */
    function withdrawTo(
        IERC20Token token,
        address receiver,
        uint256 amount
    ) external {
        _beforeTokenWithdraw();
        _withdraw(token, receiver, amount);
        _afterTokenWithdraw();
    }

    /**
     * @notice Internal initialization function for ERC20TokenPredicate
     * @param newL2StateSender Address of L2StateSender to send exit information to
     * @param newStateReceiver Address of StateReceiver to receive deposit information from
     * @param newRootERC20Predicate Address of root ERC20 predicate to communicate with
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @param newNativeTokenRootAddress Address of native token on root chain
     * @dev Can be called multiple times.
     */
    function _initialize(
        address newL2StateSender,
        address newStateReceiver,
        address newRootERC20Predicate,
        address newTokenTemplate,
        address newNativeTokenRootAddress
    ) internal {
        require(
            newL2StateSender != address(0) &&
                newStateReceiver != address(0) &&
                newRootERC20Predicate != address(0) &&
                newTokenTemplate != address(0),
            "ERC20TokenPredicate: BAD_INITIALIZATION"
        );
        l2StateSender = IStateSender(newL2StateSender);
        stateReceiver = newStateReceiver;
        rootERC20Predicate = newRootERC20Predicate;
        tokenTemplate = newTokenTemplate;
        if (newNativeTokenRootAddress != address(0)) {
            rootTokenToToken[newNativeTokenRootAddress] = NATIVE_TOKEN_CONTRACT;
            // slither-disable-next-line reentrancy-events
            emit L2TokenMapped(
                newNativeTokenRootAddress,
                NATIVE_TOKEN_CONTRACT
            );
        }
    }

    // solhint-disable no-empty-blocks
    function _beforeTokenDeposit() internal virtual {}

    // slither-disable-next-line dead-code
    function _beforeTokenWithdraw() internal virtual {}

    function _afterTokenDeposit() internal virtual {}

    function _afterTokenWithdraw() internal virtual {}

    function _withdraw(
        IERC20Token token,
        address receiver,
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

        require(
            token.burn(msg.sender, amount),
            "ERC20TokenPredicate: BURN_FAILED"
        );
        l2StateSender.syncState(
            rootERC20Predicate,
            abi.encode(WITHDRAW_SIG, rootToken, msg.sender, receiver, amount)
        );

        // slither-disable-next-line reentrancy-events
        emit L2ERC20Withdraw(
            rootToken,
            address(token),
            msg.sender,
            receiver,
            amount
        );
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
        emit L2ERC20Deposit(
            depositToken,
            address(token),
            depositor,
            receiver,
            amount
        );
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
        emit L2TokenMapped(rootToken, address(token));
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
