// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./ERC20TokenPredicate.sol";
import "./Validators.sol";

contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    ERC20TokenPredicate public eRC20TokenPredicate;
    Validators public validators;
    address public relayer;
    uint256 public constant MAX_LENGTH = 2048;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setDependencies(
        address _eRC20TokenPredicate,
        address _validators,
        address _relayer
    ) external onlyOwner {
        if (
            _eRC20TokenPredicate == address(0) ||
            _validators == address(0) ||
            _relayer == address(0)
        ) revert ZeroAddress();
        eRC20TokenPredicate = ERC20TokenPredicate(_eRC20TokenPredicate);
        validators = Validators(_validators);
        relayer = _relayer;
    }

    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
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
        uint8 _destinationChainId,
        address _sender,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external onlyPredicate {
        emit Withdraw(_destinationChainId, _sender, _receivers, _feeAmount);
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
