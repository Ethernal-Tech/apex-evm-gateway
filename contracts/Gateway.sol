// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {IValidators} from "./interfaces/IValidators.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";

contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    NativeTokenPredicate public nativeTokenPredicate;
    IValidators public validators;
    uint256 public feeAmount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _feeAmount) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        feeAmount = _feeAmount;
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

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external payable {
        if (_feeAmount != feeAmount)
            revert WrongFeeAmount(feeAmount, _feeAmount);
        uint256 _amountLength = _receivers.length;

        uint256 amountSum = _feeAmount;

        for (uint256 i; i < _amountLength; i++) {
            uint256 _amount = _receivers[i].amount;
            if (_amount == 0) revert BridgingZeroAmount();
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

    function transferAmountToWallet(uint256 value) internal {
        address nativeTokenWalletAddress = address(
            nativeTokenPredicate.nativeTokenWallet()
        );
        (bool success, ) = nativeTokenWalletAddress.call{value: value}("");
        // Revert the transaction if the transfer fails
        if (!success) revert TransferFailed();
    }

    function setFeeAmount(uint256 _feeAmount) external onlyOwner {
        feeAmount = _feeAmount;

        emit FeeAmountUpdated(_feeAmount);
    }

    receive() external payable {
        transferAmountToWallet(msg.value);

        emit FundsDeposited(msg.sender, msg.value);
    }

    modifier onlyPredicate() {
        if (msg.sender != address(nativeTokenPredicate)) revert NotPredicate();
        _;
    }
}
