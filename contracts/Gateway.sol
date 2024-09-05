// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./Validators.sol";

contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    Validators public validators;
    uint256 public constant MAX_LENGTH = 2048;

    mapping(uint64 => bool) public usedBatches;
    uint256 public totalSupply;

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

    function setDependencies(address _validators) external onlyOwner {
        if (_validators == address(0)) revert ZeroAddress();
        validators = Validators(_validators);
    }

    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external {
        bytes32 _hash = keccak256(_data);
        (bool valid, ) = validators.isBlsSignatureValid(
            _hash,
            _signature,
            _bitmap
        );

        if (!valid) revert InvalidSignature();

        Deposits memory _deposits = abi.decode(_data, (Deposits));

        if (usedBatches[_deposits.batchId]) {
            revert BatchAlreadyExecuted();
        }

        if (_deposits.ttlExpired < block.number) {
            emit TTLExpired(_data);
            return;
        }

        ReceiverDeposit[] memory _receivers = _deposits.receivers;
        uint256 _receiversLength = _receivers.length;
        uint256 _amountSum;

        for (uint256 i; i < _receiversLength; i++) {
            if (_receivers[i].receiver == address(0)) revert ZeroAddress();

            (bool callSuccess, ) = _receivers[i].receiver.call{
                value: _receivers[i].amount
            }("");
            _amountSum = _amountSum + _receivers[i].amount;

            // Revert the transaction if the transfer fails
            require(callSuccess, "Failed to send Ether");
        }

        (bool success, ) = msg.sender.call{value: _deposits.feeAmount}("");

        // Revert the transaction if the transfer fails
        require(success, "Failed to send Ether");

        _amountSum = _amountSum + _deposits.feeAmount;

        totalSupply += _amountSum;

        usedBatches[_deposits.batchId] = true;

        emit Deposit(_data);
    }

    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) external payable {
        uint256 _amountLength = _receivers.length;

        uint256 _amountSum;

        for (uint256 i; i < _amountLength; i++) {
            _amountSum += _receivers[i].amount;
        }

        _amountSum = _amountSum + _feeAmount;

        if (msg.value < _amountSum) {
            emit Withdraw(
                _destinationChainId,
                msg.sender,
                _receivers,
                _feeAmount,
                msg.value,
                false
            );
            revert InsufficientValue();
        }

        totalSupply -= _amountSum;

        emit Withdraw(
            _destinationChainId,
            msg.sender,
            _receivers,
            _feeAmount,
            msg.value,
            true
        );
    }

    modifier maxLengthExceeded(bytes calldata _data) {
        if (_data.length > MAX_LENGTH) revert ExceedsMaxLength();
        _;
    }
}
