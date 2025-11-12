// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {IValidators} from "./interfaces/IValidators.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";
import {TokenFactory} from "./tokens/TokenFactory.sol";
import {Utils} from "./Utils.sol";

/// @title Gateway Contract
/// @notice This contract serves as a gateway for managing token deposits, withdrawals, and validator updates.
/// @dev Inherits functionality from OpenZeppelin's Initializable, OwnableUpgradeable, and UUPSUpgradeable.
contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    Utils,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    NativeTokenPredicate public nativeTokenPredicate;
    IValidators public validators;
    uint256 public minFeeAmount;
    uint256 public minBridgingAmount;

    //Mapping for previously registered LockUnlock tokens
    mapping(address => bool) public isLockUnlockTokenRegistered;

    TokenFactory public tokenFactory;

    uint256 public tokenIdCounter;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[48] private __gap;

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

    /// @notice Sets the external contract dependencies.
    /// @dev This function can only be called by the upgrade admin. It verifies that the provided address is a contract.
    /// @param _tokenFactoryAddresses The address of the deployed TokenFactory contract.
    function setAdditionalDependenciesAndSync(
        address _tokenFactoryAddresses
    ) external onlyOwner {
        if (!_isContract(_tokenFactoryAddresses))
            revert NotContractAddress(_tokenFactoryAddresses);

        tokenFactory = TokenFactory(_tokenFactoryAddresses);
    }

    function registerToken(
        address _lockUnlockSCAddress,
        string memory _name,
        string memory _symbol
    ) external onlyOwner {
        bool isLockUnlock = _lockUnlockSCAddress != address(0);
        address _contractAddress;
        if (!isLockUnlock) {
            _contractAddress = tokenFactory.createToken(_name, _symbol);
        } else if (!_isContract(_lockUnlockSCAddress)) {
            revert NotContractAddress(_lockUnlockSCAddress);
        } else if (isLockUnlockTokenRegistered[_lockUnlockSCAddress]) {
            revert TokenAddressAlreadyRegistered(_lockUnlockSCAddress);
        }

        nativeTokenPredicate.setTokenAddress(
            ++tokenIdCounter,
            (isLockUnlock ? _lockUnlockSCAddress : _contractAddress)
        );

        if (isLockUnlock) {
            isLockUnlockTokenRegistered[_lockUnlockSCAddress] = true;
            nativeTokenPredicate.setTokenAsLockUnlockToken(tokenIdCounter);
        }

        emit TokenRegistered(
            _name,
            _symbol,
            tokenIdCounter,
            (isLockUnlock ? _lockUnlockSCAddress : _contractAddress),
            isLockUnlock
        );
    }

    /// @notice Deposits tokens into the system
    /// @notice Case 1: currency - native tokens will be transferd from nativeTokenWallet to receivers address
    /// @notice Case 2: LockUnlock - token will be transfered from sender to nativeTokenWallet address
    /// on LockUnlock ERC20 address, even will be emited
    /// @notice Case 3: MintBurn - tokens will be minted and transfered to receivers account
    /// on MintBurn ERC20
    /// @param _signature The BLS signature for validation.
    /// @param _bitmap The bitmap associated with the BLS signature.
    /// @param _data The deposit data in bytes format.
    /// @dev Emits either a `Deposit` or `TTLExpired` event based on success.
    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data,
        uint256 _tokenId
    ) external {
        if (_tokenId > tokenIdCounter) revert TokenNotRegistered(_tokenId);

        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();

        bool success = nativeTokenPredicate.deposit(
            _data,
            msg.sender,
            _tokenId
        );

        if (success) {
            emit Deposit(_data, _tokenId);
        } else {
            emit TTLExpired(_data);
        }
    }

    /// @notice Withdraws tokens from the system.
    /// @notice Case 1: currency, native tokens will be transfered from senderto nativeTokenWallet
    /// @notice Case 2: LockUnlock tokens will be transfered from nativeTokenWallet address
    /// to receiver addres on LockUnlock ERC20, even will be emited
    /// @notice Case 3: MintBurn tokens swill be removed from senders address and burnt
    /// on MintBurn ERC20
    /// @param _destinationChainId The ID of the destination chain.
    /// @param _receivers The array of receivers and their withdrawal amounts.
    /// @param _feeAmount The fee for the withdrawal process.
    /// @dev Ensures that the sum of withdrawal amounts matches the value sent.
    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount,
        uint256 _tokenCoinId
    ) external payable {
        if (_tokenCoinId > tokenIdCounter)
            revert TokenNotRegistered(_tokenCoinId);

        if (_feeAmount < minFeeAmount)
            revert InsufficientFeeAmount(minFeeAmount, _feeAmount);

        uint256 amountSum;

        if (_tokenCoinId == 0) {
            uint256 _amountLength = _receivers.length;

            amountSum = _feeAmount;

            for (uint256 i; i < _amountLength; i++) {
                uint256 _amount = _receivers[i].amount;
                if (_amount < minBridgingAmount)
                    revert InvalidBridgingAmount(minBridgingAmount, _amount);
                amountSum += _amount;
            }

            if (msg.value != amountSum) {
                revert WrongValue(amountSum, msg.value);
            }

            _transferAmountToWallet(amountSum);
        } else {
            if (_receivers.length != 1) {
                revert InvalidNumberOfBurnOrLockAddresses(_receivers.length);
            }

            if (msg.sender != _stringToAddress(_receivers[0].receiver)) {
                revert InvalidBurnOrLockAddress(_receivers[0].receiver);
            }

            nativeTokenPredicate.withdraw(_receivers, _tokenCoinId);

            _transferAmountToWallet(_feeAmount);
        }

        emit Withdraw(
            _destinationChainId,
            msg.sender,
            _receivers,
            _feeAmount,
            (_tokenCoinId == 0 ? amountSum : _feeAmount),
            _tokenCoinId
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
    ) external {
        _validateSignature(_signature, _bitmap, _data);

        bool success = validators.updateValidatorsChainData(_data);
        if (success) {
            emit ValidatorSetUpdatedGW(_data);
        }
    }

    /// @notice Transfers an amount to the native token wallet.
    /// @param value The amount to be transferred.
    /// @dev Reverts if the transfer fails.
    function _transferAmountToWallet(uint256 value) internal {
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

    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    function _validateSignature(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) internal view {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();
    }

    /// @notice Handles receiving Ether and transfers it to the native token wallet.
    /// @dev Emits a `FundsDeposited` event upon receiving Ether.
    receive() external payable {
        _transferAmountToWallet(msg.value);

        emit FundsDeposited(msg.sender, msg.value);
    }

    function version() public pure returns (string memory) {
        return "1.1.0";
    }

    modifier onlyPredicate() {
        if (msg.sender != address(nativeTokenPredicate)) revert NotPredicate();
        _;
    }
}
