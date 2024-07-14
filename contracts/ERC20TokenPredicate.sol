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
    uint8 public sourceTokenId;
    /// @custom:security write-protection="onlySystemCall()"
    address public tokenTemplate;
    bytes32 public constant DEPOSIT_SIG = keccak256("DEPOSIT");
    bytes32 public constant WITHDRAW_SIG = keccak256("WITHDRAW");
    bytes32 public constant MAP_TOKEN_SIG = keccak256("MAP_TOKEN");

    mapping(uint8 => address) public sourceTokenToToken;

    event Deposit(
        uint8 indexed sourceTokenId,
        address indexed token,
        address indexed receiver,
        uint256 amount
    );
    event Withdraw(
        uint8 indexed sourceTokenId,
        address indexed token,
        string receiver,
        uint256 amount
    );
    event TokenMapped(uint8 indexed sourceTokenId, address indexed token);

    /**
     * @notice Initialization function for ERC2Token0Predicate
     * @param newGateway Address of Gaeaway to receive deposit information from
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @dev Can only be called once. `newNativeTokenRootAddress` should be set to zero where root token does not exist.
     */
    function initialize(
        address newGateway,
        address newTokenTemplate
    ) public virtual onlySystemCall initializer {
        _initialize(newGateway, newTokenTemplate);
    }

    /**
     * @notice Function to be used for token deposits
     * @param data Data sent by the sender
     * @dev Can be extended to include other signatures for more functionality
     */
    function onStateReceive(bytes calldata data) external {
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
     * @notice Function to withdraw tokens from the withdrawer to receiver on the source chain
     * @param token Address of the token being withdrawn
     * @param destinationTokenId ID of the token/source chain
     * @param receiver address of the receiver on the source chain
     * @param amount Amount to withdraw
     */
    function withdraw(
        IERC20Token token,
        uint8 destinationTokenId,
        string calldata receiver,
        uint256 amount
    ) external {
        _withdraw(token, destinationTokenId, msg.sender, receiver, amount);
    }

    /**
     * @notice Internal initialization function for ERC20TokenPredicate
     * @param newGateway Address of Gatewey to receive deposit information from
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @dev Can be called multiple times.
     */
    function _initialize(
        address newGateway,
        address newTokenTemplate
    ) internal {
        require(
            newGateway != address(0) && newTokenTemplate != address(0),
            "ERC20TokenPredicate: BAD_INITIALIZATION"
        );
        gateway = IGateway(newGateway);
        tokenTemplate = newTokenTemplate;
    }

    function _withdraw(
        IERC20Token token,
        uint8 destinationToken,
        address caller,
        string calldata receiver,
        uint256 amount
    ) private {
        require(
            address(token).code.length != 0,
            "ERC20TokenPredicate: NOT_CONTRACT"
        );

        require(
            sourceTokenToToken[destinationToken] == address(token),
            "ERC20TokenPredicate: UNMAPPED_TOKEN"
        );

        require(token.burn(caller, amount), "ERC20TokenPredicate: BURN_FAILED");
        gateway.syncState(
            abi.encode(WITHDRAW_SIG, destinationToken, receiver, amount)
        );

        // slither-disable-next-line reentrancy-events

        emit Withdraw(destinationToken, address(token), receiver, amount);
    }

    function _deposit(bytes calldata data) private {
        (uint8 _sourceTokenId, address receiver, uint256 amount) = abi.decode(
            data,
            (uint8, address, uint256)
        );

        IERC20Token token = IERC20Token(sourceTokenToToken[_sourceTokenId]);

        require(
            address(token) != address(0),
            "ERC20TokenPredicate: UNMAPPED_TOKEN"
        );
        assert(address(token).code.length != 0);

        require(
            IERC20Token(token).mint(receiver, amount),
            "ERC20TokenPredicate: MINT_FAILED"
        );

        // slither-disable-next-line reentrancy-events
        emit Deposit(sourceTokenId, address(token), receiver, amount);
    }

    /**
     * @notice Function to be used for mapping a root token to a token
     * @dev Allows fsourceTOkenIdor 1-to-1 mappings for any root token to a token
     */
    function _mapToken(bytes calldata data) private {
        (
            ,
            uint8 _sourceTokenId,
            string memory name,
            string memory symbol,
            uint8 decimals
        ) = abi.decode(data, (bytes32, uint8, string, string, uint8));
        assert(sourceTokenToToken[_sourceTokenId] == address(0)); // invariant since root predicate performs the same check
        IERC20Token token = IERC20Token(
            Clones.cloneDeterministic(
                tokenTemplate,
                keccak256(abi.encodePacked(_sourceTokenId))
            )
        );
        sourceTokenToToken[_sourceTokenId] = address(token);
        token.initialize(_sourceTokenId, name, symbol, decimals);

        // slither-disable-next-line reentrancy-events
        emit TokenMapped(_sourceTokenId, address(token));
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
