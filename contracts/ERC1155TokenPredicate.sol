// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IERC1155TokenPredicate.sol";
import "./interfaces/IERC1155Token.sol";
import "./interfaces/IStateSender.sol";
import "./System.sol";

/**
    @title ERC1155TokenPredicate
    @author Polygon Technology (@QEDK, @wschwab)
    @notice Enables ERC1155 token deposits and withdrawals across an arbitrary root chain and tokench chain
 */
// solhint-disable reason-string
contract ERC1155TokenPredicate is
    IERC1155TokenPredicate,
    Initializable,
    System
{
    /// @custom:security write-protection="onlySystemCall()"
    IStateSender public l2StateSender;
    /// @custom:security write-protection="onlySystemCall()"
    address public stateReceiver;
    /// @custom:security write-protection="onlySystemCall()"
    address public rootERC1155Predicate;
    /// @custom:security write-protection="onlySystemCall()"
    address public tokenTemplate;
    bytes32 public constant DEPOSIT_SIG = keccak256("DEPOSIT");
    bytes32 public constant DEPOSIT_BATCH_SIG = keccak256("DEPOSIT_BATCH");
    bytes32 public constant WITHDRAW_SIG = keccak256("WITHDRAW");
    bytes32 public constant WITHDRAW_BATCH_SIG = keccak256("WITHDRAW_BATCH");
    bytes32 public constant MAP_TOKEN_SIG = keccak256("MAP_TOKEN");

    mapping(address => address) public rootTokenToToken;

    event L2ERC1155Deposit(
        address indexed rootToken,
        address indexed token,
        address sender,
        address indexed receiver,
        uint256 tokenId,
        uint256 amount
    );
    event L2ERC1155DepositBatch(
        address indexed rootToken,
        address indexed token,
        address indexed sender,
        address[] receivers,
        uint256[] tokenIds,
        uint256[] amounts
    );
    event L2ERC1155Withdraw(
        address indexed rootToken,
        address indexed token,
        address sender,
        address indexed receiver,
        uint256 tokenId,
        uint256 amount
    );
    event L2ERC1155WithdrawBatch(
        address indexed rootToken,
        address indexed token,
        address indexed sender,
        address[] receivers,
        uint256[] tokenIds,
        uint256[] amounts
    );
    event L2TokenMapped(address indexed rootToken, address indexed token);

    modifier onlyValidToken(IERC1155Token token) {
        require(_verifyContract(token), "ERC1155TokenPredicate: NOT_CONTRACT");
        _;
    }

    /**
     * @notice Initialization function for ERC1155TokenPredicate
     * @param newL2StateSender Address of L2StateSender to send exit information to
     * @param newStateReceiver Address of StateReceiver to receive deposit information from
     * @param newRootERC1155Predicate Address of root ERC1155 predicate to communicate with
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @dev Can only be called once.
     */
    function initialize(
        address newL2StateSender,
        address newStateReceiver,
        address newRootERC1155Predicate,
        address newTokenTemplate
    ) public virtual onlySystemCall initializer {
        _initialize(
            newL2StateSender,
            newStateReceiver,
            newRootERC1155Predicate,
            newTokenTemplate
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
            "ERC1155TokenPredicate: ONLY_STATE_RECEIVER"
        );
        require(
            sender == rootERC1155Predicate,
            "ERC1155TokenPredicate: ONLY_ROOT_PREDICATE"
        );

        if (bytes32(data[:32]) == DEPOSIT_SIG) {
            _beforeTokenDeposit();
            _deposit(data[32:]);
            _afterTokenDeposit();
        } else if (bytes32(data[:32]) == DEPOSIT_BATCH_SIG) {
            _beforeTokenDeposit();
            _depositBatch(data);
            _afterTokenDeposit();
        } else if (bytes32(data[:32]) == MAP_TOKEN_SIG) {
            _mapToken(data);
        } else {
            revert("ERC1155TokenPredicate: INVALID_SIGNATURE");
        }
    }

    /**
     * @notice Function to withdraw tokens from the withdrawer to themselves on the root chain
     * @param token Address of the token being withdrawn
     * @param tokenId Index of the NFT to withdraw
     * @param amount Amount of the NFT to withdraw
     */
    function withdraw(
        IERC1155Token token,
        uint256 tokenId,
        uint256 amount
    ) external {
        _beforeTokenWithdraw();
        _withdraw(token, msg.sender, tokenId, amount);
        _afterTokenWithdraw();
    }

    /**
     * @notice Function to withdraw tokens from the withdrawer to another address on the root chain
     * @param token Address of the token being withdrawn
     * @param receiver Address of the receiver on the root chain
     * @param tokenId Index of the NFT to withdraw
     * @param amount Amount of NFT to withdraw
     */
    function withdrawTo(
        IERC1155Token token,
        address receiver,
        uint256 tokenId,
        uint256 amount
    ) external {
        _beforeTokenWithdraw();
        _withdraw(token, receiver, tokenId, amount);
        _afterTokenWithdraw();
    }

    /**
     * @notice Function to batch withdraw tokens from the withdrawer to other addresses on the root chain
     * @param token Address of the token being withdrawn
     * @param receivers Addresses of the receivers on the root chain
     * @param tokenIds indices of the NFTs to withdraw
     * @param amounts Amounts of NFTs to withdraw
     */
    function withdrawBatch(
        IERC1155Token token,
        address[] calldata receivers,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external {
        _beforeTokenWithdraw();
        _withdrawBatch(token, receivers, tokenIds, amounts);
        _afterTokenWithdraw();
    }

    /**
     * @notice Internal initialization function for ERC1155TokenPredicate
     * @param newL2StateSender Address of L2StateSender to send exit information to
     * @param newStateReceiver Address of StateReceiver to receive deposit information from
     * @param newRootERC1155Predicate Address of root ERC1155 predicate to communicate with
     * @param newTokenTemplate Address of token implementation to deploy clones of
     * @dev Can be called multiple times.
     */
    function _initialize(
        address newL2StateSender,
        address newStateReceiver,
        address newRootERC1155Predicate,
        address newTokenTemplate
    ) internal {
        require(
            newL2StateSender != address(0) &&
                newStateReceiver != address(0) &&
                newRootERC1155Predicate != address(0) &&
                newTokenTemplate != address(0),
            "ERC1155TokenPredicate: BAD_INITIALIZATION"
        );
        l2StateSender = IStateSender(newL2StateSender);
        stateReceiver = newStateReceiver;
        rootERC1155Predicate = newRootERC1155Predicate;
        tokenTemplate = newTokenTemplate;
    }

    // solhint-disable no-empty-blocks
    // slither-disable-start dead-code
    function _beforeTokenDeposit() internal virtual {}

    function _beforeTokenWithdraw() internal virtual {}

    function _afterTokenDeposit() internal virtual {}

    function _afterTokenWithdraw() internal virtual {}

    // slither-disable-end dead-code

    function _withdraw(
        IERC1155Token token,
        address receiver,
        uint256 tokenId,
        uint256 amount
    ) private onlyValidToken(token) {
        address rootToken = token.rootToken();

        require(
            rootTokenToToken[rootToken] == address(token),
            "ERC1155TokenPredicate: UNMAPPED_TOKEN"
        );
        // a mapped token should never have root token unset
        assert(rootToken != address(0));
        // a mapped token should never have predicate unset
        assert(token.predicate() == address(this));

        require(
            token.burn(msg.sender, tokenId, amount),
            "ERC1155TokenPredicate: BURN_FAILED"
        );
        l2StateSender.syncState(
            rootERC1155Predicate,
            abi.encode(
                WITHDRAW_SIG,
                rootToken,
                msg.sender,
                receiver,
                tokenId,
                amount
            )
        );
        // slither-disable-next-line reentrancy-events
        emit L2ERC1155Withdraw(
            rootToken,
            address(token),
            msg.sender,
            receiver,
            tokenId,
            amount
        );
    }

    function _withdrawBatch(
        IERC1155Token token,
        address[] calldata receivers,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) private onlyValidToken(token) {
        address rootToken = token.rootToken();

        require(
            rootTokenToToken[rootToken] == address(token),
            "ERC1155TokenPredicate: UNMAPPED_TOKEN"
        );
        // a mapped token should never have root token unset
        assert(rootToken != address(0));
        // a mapped token should never have predicate unset
        assert(token.predicate() == address(this));

        require(
            receivers.length == tokenIds.length &&
                tokenIds.length == amounts.length,
            "ERC1155TokenPredicate: INVALID_LENGTH"
        );

        require(
            token.burnBatch(msg.sender, tokenIds, amounts),
            "ERC1155TokenPredicate: BURN_FAILED"
        );

        l2StateSender.syncState(
            rootERC1155Predicate,
            abi.encode(
                WITHDRAW_BATCH_SIG,
                rootToken,
                msg.sender,
                receivers,
                tokenIds,
                amounts
            )
        );
        // slither-disable-next-line reentrancy-events
        emit L2ERC1155WithdrawBatch(
            rootToken,
            address(token),
            msg.sender,
            receivers,
            tokenIds,
            amounts
        );
    }

    function _deposit(bytes calldata data) private {
        (
            address depositToken,
            address depositor,
            address receiver,
            uint256 tokenId,
            uint256 amount
        ) = abi.decode(data, (address, address, address, uint256, uint256));

        IERC1155Token token = IERC1155Token(rootTokenToToken[depositToken]);

        require(
            address(token) != address(0),
            "ERC1155TokenPredicate: UNMAPPED_TOKEN"
        );
        // a mapped token should always pass specifications
        assert(_verifyContract(token));

        address rootToken = IERC1155Token(token).rootToken();

        // a mapped token should match deposited token
        assert(rootToken == depositToken);
        // a mapped token should never have root token unset
        assert(rootToken != address(0));
        // a mapped token should never have predicate unset
        assert(IERC1155Token(token).predicate() == address(this));
        require(
            IERC1155Token(token).mint(receiver, tokenId, amount),
            "ERC1155TokenPredicate: MINT_FAILED"
        );
        // slither-disable-next-line reentrancy-events
        emit L2ERC1155Deposit(
            depositToken,
            address(token),
            depositor,
            receiver,
            tokenId,
            amount
        );
    }

    function _depositBatch(bytes calldata data) private {
        (
            ,
            address depositToken,
            address depositor,
            address[] memory receivers,
            uint256[] memory tokenIds,
            uint256[] memory amounts
        ) = abi.decode(
                data,
                (bytes32, address, address, address[], uint256[], uint256[])
            );

        IERC1155Token token = IERC1155Token(rootTokenToToken[depositToken]);

        require(
            address(token) != address(0),
            "ERC1155TokenPredicate: UNMAPPED_TOKEN"
        );
        // a mapped token should always pass specifications
        assert(_verifyContract(token));

        address rootToken = IERC1155Token(token).rootToken();

        // a mapped token should match deposited token
        assert(rootToken == depositToken);
        // a mapped token should never have root token unset
        assert(rootToken != address(0));
        // a mapped token should never have predicate unset
        assert(IERC1155Token(token).predicate() == address(this));
        require(
            IERC1155Token(token).mintBatch(receivers, tokenIds, amounts),
            "ERC1155TokenPredicate: MINT_FAILED"
        );
        // slither-disable-next-line reentrancy-events
        emit L2ERC1155DepositBatch(
            depositToken,
            address(token),
            depositor,
            receivers,
            tokenIds,
            amounts
        );
    }

    /**
     * @notice Function to be used for mapping a root token to a token
     * @dev Allows for 1-to-1 mappings for any root token to a token
     */
    function _mapToken(bytes calldata data) private {
        (, address rootToken, string memory uri_) = abi.decode(
            data,
            (bytes32, address, string)
        );
        assert(rootToken != address(0)); // invariant since root predicate performs the same check
        assert(rootTokenToToken[rootToken] == address(0)); // invariant since root predicate performs the same check
        IERC1155Token token = IERC1155Token(
            Clones.cloneDeterministic(
                tokenTemplate,
                keccak256(abi.encodePacked(rootToken))
            )
        );
        rootTokenToToken[rootToken] = address(token);
        token.initialize(rootToken, uri_);

        // slither-disable-next-line reentrancy-events
        emit L2TokenMapped(rootToken, address(token));
    }

    // slither does not handle try-catch blocks correctly
    // slither-disable-next-line unused-return
    function _verifyContract(IERC1155Token token) private view returns (bool) {
        if (address(token).code.length == 0) {
            return false;
        }
        // slither-disable-next-line uninitialized-local,variable-scope
        try token.supportsInterface(0xd9b67a26) returns (bool support) {
            return support;
        } catch {
            return false;
        }
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
