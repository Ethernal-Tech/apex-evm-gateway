// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {NativeTokenPredicate} from "./NativeTokenPredicate.sol";
import {TokenFactory} from "./tokens/TokenFactory.sol";
import {Utils} from "./Utils.sol";
import {Validators} from "./Validators.sol";

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
    Validators public validators;
    TokenFactory public tokenFactory;
    uint256 public minFeeAmount;
    uint256 public minBridgingAmount;

    //Mapping for previously registered LockUnlock tokens
    mapping(address => bool) public isLockUnlockTokenRegistered;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[50] private __gap;

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
        address _nativeTokenPredicateAddress,
        address _tokenFactoryAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (!_isContract(_nativeTokenPredicateAddress))
            revert NotContractAddress(_nativeTokenPredicateAddress);

        if (!_isContract(_tokenFactoryAddress))
            revert NotContractAddress(_tokenFactoryAddress);

        if (!_isContract(_validatorsAddress))
            revert NotContractAddress(_validatorsAddress);

        nativeTokenPredicate = NativeTokenPredicate(
            _nativeTokenPredicateAddress
        );
        tokenFactory = TokenFactory(_tokenFactoryAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Registers a new token, either by deploying a new ERC20 token via the TokenFactory
    ///         or by linking an existing Lock/Unlock smart contract.
    /// @dev
    /// - If `_lockUnlockSCAddress` is the zero address, a new token is created using `tokenFactory`.
    /// - If `_lockUnlockSCAddress` is non-zero, the function validates that it is a contract
    ///   and not already registered as a Lock/Unlock token.
    /// - A new `tokenId` must be provided and must not be already registered.
    /// - Sets the token address in `nativeTokenPredicate` and, if applicable, marks it as a Lock/Unlock token.
    /// - Emits a `TokenRegistered` event with the token’s metadata.
    /// @param _lockUnlockSCAddress Address of an existing Lock/Unlock token contract,
    ///        or `address(0)` if a new token should be created.
    /// @param _tokenId Unique identifier for the token to register.
    /// @param _name Name of the token to be registered or created.
    /// @param _symbol Symbol of the token to be registered or created.
    /// @custom:modifier onlyOwner Only the contract owner can register tokens.
    /// @custom:reverts ZeroTokenId If `_tokenId` is zero.
    /// @custom:reverts TokenIdAlreadyRegistered If `_tokenId` has already been registered.
    /// @custom:reverts NotContractAddress If `_lockUnlockSCAddress` is not a valid contract.
    /// @custom:reverts TokenAddressAlreadyRegistered If `_lockUnlockSCAddress` was already registered.
    /// @custom:emits TokenRegistered Emitted after successful registration of a token.
    function registerToken(
        address _lockUnlockSCAddress,
        uint256 _tokenId,
        string memory _name,
        string memory _symbol
    ) external onlyOwner {
        if (_tokenId == 0) {
            revert ZeroTokenId();
        }

        if (nativeTokenPredicate.isTokenRegistered(_tokenId)) {
            revert TokenIdAlreadyRegistered(_tokenId);
        }

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
            _tokenId,
            (isLockUnlock ? _lockUnlockSCAddress : _contractAddress)
        );

        if (isLockUnlock) {
            isLockUnlockTokenRegistered[_lockUnlockSCAddress] = true;
            nativeTokenPredicate.setTokenAsLockUnlockToken(_tokenId);
        }

        emit TokenRegistered(
            _name,
            _symbol,
            _tokenId,
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
    /// @param _tokenId The token ID being deposited. Must be registered unless zero.
    /// @dev Emits either a `Deposit` or `TTLExpired` event based on success.
    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data,
        uint256 _tokenId
    ) external {
        if (_tokenId != 0 && !nativeTokenPredicate.isTokenRegistered(_tokenId))
            revert TokenNotRegistered(_tokenId);

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
    /// @param _tokenCoinId The token ID representing the asset type. Zero for native currency.
    /// @dev Ensures that the sum of withdrawal amounts matches the value sent.
    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount,
        uint256 _tokenCoinId
    ) external payable {
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
            if (!nativeTokenPredicate.isTokenRegistered(_tokenCoinId)) {
                revert TokenNotRegistered(_tokenCoinId);
            }

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

    function getTokenAddress(uint256 _tokenId) external view returns (address) {
        return nativeTokenPredicate.getTokenAddress(_tokenId);
    }

    /// @notice Validates the BLS signature.

    function _validateSignature(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) internal view {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();
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

    /// @notice Handles receiving Ether and transfers it to the native token wallet.
    /// @dev Emits a `FundsDeposited` event upon receiving Ether.
    receive() external payable {
        _transferAmountToWallet(msg.value);

        emit FundsDeposited(msg.sender, msg.value);
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyPredicate() {
        if (msg.sender != address(nativeTokenPredicate)) revert NotPredicate();
        _;
    }
}
