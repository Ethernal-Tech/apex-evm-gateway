//SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC1155/ERC1155.sol)

pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "./lib/EIP712MetaTransaction.sol";
import "./interfaces/IERC1155Token.sol";

/**
    @title ERC1155Token
    @author Polygon Technology (@QEDK, @wschwab)
    @notice Token template for ERC1155Token predicate deployments
    @dev All tokens are clones of this contract. Burning and minting is controlled by respective predicates only.
 */
contract ERC1155Token is
    EIP712MetaTransaction,
    ERC1155Upgradeable,
    IERC1155Token
{
    using StringsUpgradeable for address;
    address private _predicate;
    address private _rootToken;

    modifier onlyPredicate() {
        require(
            msg.sender == _predicate,
            "ERC1155Token: Only predicate can call"
        );
        _;
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function initialize(
        address rootToken_,
        string calldata uri_
    ) external initializer {
        require(rootToken_ != address(0), "ERC1155Token: BAD_INITIALIZATION");
        _rootToken = rootToken_;
        _predicate = msg.sender;
        __ERC1155_init(uri_);
        _initializeEIP712(
            string.concat("ERC1155Token-", rootToken_.toHexString()),
            "1"
        );
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function predicate() external view virtual returns (address) {
        return _predicate;
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function rootToken() external view virtual returns (address) {
        return _rootToken;
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function mint(
        address account,
        uint256 id,
        uint256 amount
    ) external onlyPredicate returns (bool) {
        _mint(account, id, amount, "");

        return true;
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function mintBatch(
        address[] calldata accounts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyPredicate returns (bool) {
        uint256 length = accounts.length;
        require(
            length == tokenIds.length && length == amounts.length,
            "ERC1155Token: array len mismatch"
        );
        for (uint256 i = 0; i < length; ) {
            _mint(accounts[i], tokenIds[i], amounts[i], "");
            unchecked {
                ++i;
            }
        }
        return true;
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function burn(
        address from,
        uint256 id,
        uint256 amount
    ) external onlyPredicate returns (bool) {
        _burn(from, id, amount);

        return true;
    }

    /**
     * @inheritdoc IERC1155Token
     */
    function burnBatch(
        address from,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyPredicate returns (bool) {
        _burnBatch(from, tokenIds, amounts);

        return true;
    }

    function _msgSender()
        internal
        view
        virtual
        override(EIP712MetaTransaction, ContextUpgradeable)
        returns (address)
    {
        return EIP712MetaTransaction._msgSender();
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}