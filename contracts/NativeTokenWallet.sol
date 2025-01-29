// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {INativeTokenWallet} from "./interfaces/INativeTokenWallet.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";

/**
 * @title NativeTokenWallet
 * @notice A wallet contract to manage native token deposits and interactions.
 * @dev Supports upgradeability using OpenZeppelin's UUPS module and adheres to IGatewayStructs and INativeTokenWallet interfaces.
 */
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
     * @notice Deposits an amount of native tokens to a specific account.
     * @param _account The address of the account to deposit tokens to.
     * @param _amount The amount of tokens to deposit.
     * @return success A boolean indicating whether the deposit was successful.
     * @dev Can only be called by the predicate contract or the contract owner.
     * Reverts if the transfer fails.
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
