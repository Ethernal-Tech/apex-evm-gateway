// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./NativeTokenPredicate.sol";
import "./Validators.sol";

contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    NativeTokenPredicate public nativeTokenPredicate;
    Validators public validators;
    uint256 public constant MAX_LENGTH = 2048;

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
        validators = Validators(_validators);
    }

    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();

        nativeTokenPredicate.deposit(_data, msg.sender);
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

        if (msg.value < amountSum) {
            emit WithdrawInsufficientValue(
                _destinationChainId,
                msg.sender,
                _receivers,
                _feeAmount,
                msg.value
            );
            revert InsufficientValue();
        }

        (bool success, ) = address(nativeTokenPredicate.nativeTokenWallet())
            .call{value: amountSum}("");

        // Revert the transaction if the transfer fails
        if (!success) revert TransferFailed();

        nativeTokenPredicate.withdraw(
            _destinationChainId,
            _receivers,
            _feeAmount,
            msg.sender,
            amountSum,
            msg.value
        );
    }

    function depositEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit Deposit(_data);
    }

    function withdrawEvent(
        uint8 _destinationChainId,
        address _sender,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount,
        uint256 _value
    ) external onlyPredicate {
        emit Withdraw(
            _destinationChainId,
            _sender,
            _receivers,
            _feeAmount,
            _value
        );
    }

    function ttlEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit TTLExpired(_data);
    }

    receive() external payable {}

    modifier onlyPredicate() {
        if (msg.sender != address(nativeTokenPredicate)) revert NotPredicate();
        _;
    }

    modifier maxLengthExceeded(bytes calldata _data) {
        if (_data.length > MAX_LENGTH) revert ExceedsMaxLength();
        _;
    }
}
