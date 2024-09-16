// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IGatewayStructs.sol";
import "./interfaces/INativeTokenWallet.sol";
import "./NativeTokenPredicate.sol";

/**
    @title NativeToken
    @notice Native token contract
 */
// solhint-disable reason-string
contract NativeTokenWallet is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IGatewayStructs,
    INativeTokenWallet
{
    address public predicate;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setDependencies(address _predicate) external onlyOwner {
        if (_predicate == address(0)) revert ZeroAddress();
        predicate = _predicate;
    }

    /**
     * @notice Deposits an amount of tokens to a particular address
     * @dev Can only be called by the predicate or owner address
     * @param _account Account of the user to mint the tokens to
     * @param _amount Amount of tokens to mint to the account
     * @return bool Returns true if function call is successful
     */
    function deposit(
        address _account,
        uint256 _amount
    ) external onlyPredicateOrOwner returns (bool) {
        (bool success, ) = _account.call{value: _amount}("");

        // Revert the transaction if the transfer fails
        if (!success) revert TransferFailed();

        return true;
    }

    receive() external payable {}

    modifier onlyPredicateOrOwner() {
        if (msg.sender != predicate && msg.sender != owner())
            revert NotPredicateOrOwner();

        _;
    }
}
