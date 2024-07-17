// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./interfaces/IStateSender.sol";
import "./interfaces/IStateReceiver.sol";
import "./ERC20TokenPredicate.sol";
import "./Validators.sol";

contract Gateway is IGateway {
    ERC20TokenPredicate private eRC20TokenPredicate;
    Validators private validators;
    uint256 public constant MAX_LENGTH = 2048;
    address private relayer;
    address private owner;

    //TODO: make upgradable
    constructor() {
        owner = msg.sender;
    }

    function setDependencies(
        ERC20TokenPredicate _eRC20TokenPredicate,
        Validators _validators,
        address _relayer
    ) external onlyOwner {
        eRC20TokenPredicate = _eRC20TokenPredicate;
        validators = _validators;
        relayer = _relayer;
    }

    function deposit(
        bytes calldata _signature,
        bytes calldata _bitmap,
        bytes calldata _data
    ) external onlyRelayer {
        bytes32 _hash = keccak256(_data);
        (bool valid, ) = validators.isBlsSignatureValid(
            _hash,
            _signature,
            _bitmap
        );

        if (!valid) revert InvalidSignature();

        eRC20TokenPredicate.deposit(_data);
    }

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external {
        eRC20TokenPredicate.withdraw(
            _destinationChainId,
            _receivers,
            _feeAmount
        );
    }

    function depositEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit Deposit(_data);
    }

    function withdrawEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit Withdraw(_data);
    }

    function ttlEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit TTLExpired(_data);
    }

    function setValidatorsChainData(
        ValidatorAddressChainData[] calldata _chainDatas
    ) external onlyOwner {
        validators.setValidatorsChainData(_chainDatas);
    }

    function addValidatorChainData(
        address _addr,
        ValidatorChainData calldata _data
    ) external onlyOwner {
        validators.addValidatorChainData(_addr, _data);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    modifier onlyPredicate() {
        if (msg.sender != address(eRC20TokenPredicate)) revert NotPredicate();
        _;
    }

    modifier maxLengthExceeded(bytes calldata _data) {
        if (_data.length > MAX_LENGTH) revert ExceedsMaxLength();
        _;
    }
}
