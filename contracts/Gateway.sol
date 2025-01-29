// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {IValidators} from "./interfaces/IValidators.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";

/// @title Gateway Contract
/// @notice This contract serves as a gateway for managing token deposits, withdrawals, and validator updates.
/// @dev Inherits functionality from OpenZeppelin's Initializable, OwnableUpgradeable, and UUPSUpgradeable.
contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    NativeTokenPredicate public nativeTokenPredicate;
    IValidators public validators;
    uint256 public minFeeAmount;
    uint256 public minBridgingAmount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _minFeeAmount,
        uint256 _minBridgingAmount
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        minFeeAmount = _minFeeAmount;
        minBridgingAmount = _minBridgingAmount;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setDependencies(
        address _nativeTokenPredicate,
        address _validators
    ) external onlyOwner {
        if (_nativeTokenPredicate == address(0) || _validators == address(0))
            revert ZeroAddress();
        nativeTokenPredicate = NativeTokenPredicate(_nativeTokenPredicate);
        validators = IValidators(_validators);
    }

    /// @notice Deposits tokens into the system.
    /// @param _signature The BLS signature for validation.
    /// @param _bitmap The bitmap associated with the BLS signature.
    /// @param _data The deposit data in bytes format.
    /// @dev Emits either a `Deposit` or `TTLExpired` event based on success.
    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();

        bool success = nativeTokenPredicate.deposit(_data, msg.sender);
        if (success) {
            emit Deposit(_data);
        } else {
            emit TTLExpired(_data);
        }
    }

    /// @notice Withdraws tokens from the system.
    /// @param _destinationChainId The ID of the destination chain.
    /// @param _receivers The array of receivers and their withdrawal amounts.
    /// @param _feeAmount The fee for the withdrawal process.
    /// @dev Ensures that the sum of withdrawal amounts matches the value sent.
    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external payable {
        if (_feeAmount < minFeeAmount)
            revert InsufficientFeeAmount(minFeeAmount, _feeAmount);
        uint256 _amountLength = _receivers.length;

        uint256 amountSum = _feeAmount;

        for (uint256 i; i < _amountLength; i++) {
            uint256 _amount = _receivers[i].amount;
            if (_amount < minBridgingAmount) revert InvalidBridgingAmount(minBridgingAmount, _amount);
            amountSum += _amount;
        }

        if (msg.value != amountSum) {
            revert WrongValue(amountSum, msg.value);
        }

        transferAmountToWallet(amountSum);

        emit Withdraw(
            _destinationChainId,
            msg.sender,
            _receivers,
            _feeAmount,
            amountSum
        );
    }

    /// @notice Updates validator chain data.
    /// @param _signature The BLS signature for validation.
    /// @param _bitmap The bitmap associated with the BLS signature.
    /// @param _data The new validator chain data in bytes format.
    /// @dev Restricted to the owner of the contract.
    function updateValidatorsChainData(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external onlyOwner {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();

        validators.updateValidatorsChainData(_data);
    }

    /// @notice Transfers an amount to the native token wallet.
    /// @param value The amount to be transferred.
    /// @dev Reverts if the transfer fails.
    function transferAmountToWallet(uint256 value) internal {
        address nativeTokenWalletAddress = address(
            nativeTokenPredicate.nativeTokenWallet()
        );
        (bool success, ) = nativeTokenWalletAddress.call{value: value}("");
        // Revert the transaction if the transfer fails
        if (!success) revert TransferFailed();
    }

    /// @notice Sets the minimal amounts for fee and bridging.
    /// @param _minFeeAmount The minimal fee amount to set
    /// @param _minBridgingAmount The minimal bridging amount to set
    /// @dev Restricted to the owner of the contract.
    function setMinAmounts(
        uint256 _minFeeAmount,
        uint256 _minBridgingAmount
    ) external onlyOwner {
        minFeeAmount = _minFeeAmount;
        minBridgingAmount = _minBridgingAmount;

        emit MinAmountsUpdated(_minFeeAmount, _minBridgingAmount);
    }

    /// @notice Handles receiving Ether and transfers it to the native token wallet.
    /// @dev Emits a `FundsDeposited` event upon receiving Ether.
    receive() external payable {
        transferAmountToWallet(msg.value);

        emit FundsDeposited(msg.sender, msg.value);
    }

    modifier onlyPredicate() {
        if (msg.sender != address(nativeTokenPredicate)) revert NotPredicate();
        _;
    }
}
