// SPDX-License-Identifier: MIT
// Adapted from OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./lib/EIP712MetaTransaction.sol";
import "./interfaces/IERC20Token.sol";

/**
    @title ERC20Token
    @author Polygon Technology (@QEDK)
    @notice Token template for ERC20 predicate deployments
    @dev All tokens are clones of this contract. Burning and minting is controlled by respective predicates only.
 */
// solhint-disable reason-string
contract ERC20Token is EIP712MetaTransaction, ERC20Upgradeable, IERC20Token {
    address private _predicate;
    uint8 private _sourceTokenId;
    uint8 private _decimals;

    modifier onlyPredicate() {
        require(
            msg.sender == _predicate,
            "ERC20Token: Only predicate can call"
        );

        _;
    }

    /**
     * @inheritdoc IERC20Token
     */
    function initialize(
        uint8 sourceTokenId_,
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_
    ) external initializer {
        require(
            bytes(name_).length != 0 && bytes(symbol_).length != 0,
            "ERC20Token: BAD_INITIALIZATION"
        );
        _sourceTokenId = sourceTokenId_;
        _decimals = decimals_;
        _predicate = msg.sender;
        __ERC20_init(name_, symbol_);
        _initializeEIP712(name_, "1");
    }

    /**
     * @notice Returns the decimals places of the token
     * @return uint8 Returns the decimals places of the token.
     */
    function decimals()
        public
        view
        virtual
        override(ERC20Upgradeable, IERC20MetadataUpgradeable)
        returns (uint8)
    {
        return _decimals;
    }

    /**
     * @inheritdoc IERC20Token
     */
    function predicate() external view virtual returns (address) {
        return _predicate;
    }

    /**
     * @inheritdoc IERC20Token
     */
    function sourceTokenId() external view virtual returns (uint8) {
        return _sourceTokenId;
    }

    /**
     * @inheritdoc IERC20Token
     */
    function mint(
        address account,
        uint256 amount
    ) external virtual onlyPredicate returns (bool) {
        _mint(account, amount);

        return true;
    }

    /**
     * @inheritdoc IERC20Token
     */
    function burn(
        address account,
        uint256 amount
    ) external virtual onlyPredicate returns (bool) {
        _burn(account, amount);

        return true;
    }

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, EIP712MetaTransaction)
        returns (address)
    {
        return EIP712MetaTransaction._msgSender();
    }
}
