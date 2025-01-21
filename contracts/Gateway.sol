// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./interfaces/IValidators.sol";
import "./NativeTokenPredicate.sol";

contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    NativeTokenPredicate public nativeTokenPredicate;
    IValidators public validators;

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
        uint256 _amountLength = _receivers.length;

        uint256 amountSum;

        for (uint256 i; i < _amountLength; i++) {
            amountSum += _receivers[i].amount;
        }

        amountSum = amountSum + _feeAmount;

        if (msg.value != amountSum) {
            revert WrongValue(amountSum, msg.value);
        }

        address nativeTokenWalletAddress = address(
            nativeTokenPredicate.nativeTokenWallet()
        );

        (bool success, ) = nativeTokenWalletAddress.call{value: amountSum}("");

        // Revert the transaction if the transfer fails
        if (!success) revert TransferFailed();

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
    ) external {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();

        validators.updateValidatorsChainData(_data);
    }

    receive() external payable {
        address nativeTokenWalletAddress = address(
            nativeTokenPredicate.nativeTokenWallet()
        );

        (bool success, ) = nativeTokenWalletAddress.call{value: msg.value}("");

        if (!success) revert TransferFailed();

        emit FundsDeposited(msg.sender, msg.value);
    }

    modifier onlyPredicate() {
        if (msg.sender != address(nativeTokenPredicate)) revert NotPredicate();
        _;
    }
}
