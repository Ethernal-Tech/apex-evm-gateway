// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {INativeTokenPredicate} from "./interfaces/INativeTokenPredicate.sol";
import {TokenFactory} from "./tokens/TokenFactory.sol";
import {Utils} from "./Utils.sol";
import {IValidators} from "./Validators.sol";

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

    INativeTokenPredicate public nativeTokenPredicate;
    IValidators public validators;
    TokenFactory public tokenFactory;
    uint256 public minFee;
    uint256 public minBridgingAmount;
    uint256 public minTokenBridgingAmount;
    uint256 public minOperationFee;
    uint16 public currencyTokenId;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _minFee,
        uint256 _minBridgingAmount,
        uint256 _minTokenBridgingAmount,
        uint256 _minOperationFee,
        uint16 _currencyTokenId
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        minFee = _minFee;
        minBridgingAmount = _minBridgingAmount;
        minTokenBridgingAmount = _minTokenBridgingAmount;
        minOperationFee = _minOperationFee;
        currencyTokenId = _currencyTokenId;
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

        nativeTokenPredicate = INativeTokenPredicate(
            _nativeTokenPredicateAddress
        );
        tokenFactory = TokenFactory(_tokenFactoryAddress);
        validators = IValidators(_validatorsAddress);
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
    /// @custom:reverts CurrencyTokenId If `_tokenId` is the currency token ID.
    /// @custom:reverts TokenIdAlreadyRegistered If `_tokenId` has already been registered.
    /// @custom:reverts NotContractAddress If `_lockUnlockSCAddress` is not a valid contract.
    /// @custom:reverts TokenAddressAlreadyRegistered If `_lockUnlockSCAddress` was already registered.
    /// @custom:emits TokenRegistered Emitted after successful registration of a token.
    function registerToken(
        address _lockUnlockSCAddress,
        uint16 _tokenId,
        string memory _name,
        string memory _symbol
    ) external onlyOwner {
        if (_tokenId == currencyTokenId) {
            revert CurrencyTokenId();
        }

        if (nativeTokenPredicate.getTokenInfo(_tokenId).addr != address(0)) {
            revert TokenIdAlreadyRegistered(_tokenId);
        }

        bool isLockUnlock = _lockUnlockSCAddress != address(0);
        address _contractAddress;
        if (!isLockUnlock) {
            _contractAddress = tokenFactory.createToken(_name, _symbol);
        } else if (!_isContract(_lockUnlockSCAddress)) {
            revert NotContractAddress(_lockUnlockSCAddress);
        }

        nativeTokenPredicate.setTokenInfo(
            _tokenId,
            isLockUnlock ? _lockUnlockSCAddress : _contractAddress,
            isLockUnlock
        );

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
    /// @dev Emits either a `Deposit` or `TTLExpired` event based on success.
    function deposit(
        bytes calldata _signature,
        uint256 _bitmap,
        bytes calldata _data
    ) external {
        bytes32 _hash = keccak256(_data);
        bool valid = validators.isBlsSignatureValid(_hash, _signature, _bitmap);

        if (!valid) revert InvalidSignature();

        bool success = nativeTokenPredicate.deposit(
            _data,
            msg.sender,
            currencyTokenId
        );

        if (success) {
            emit Deposit(_data);
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
    /// @param _fee The fee for the withdrawal process.
    /// @param _operationFee The operation fee for the withdrawal process.
    /// @dev Ensures that the sum of withdrawal amounts matches the value sent.
    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _fee,
        uint256 _operationFee
    ) external payable {
        if (_fee < minFee || _operationFee < minOperationFee) {
            revert InsufficientFee(
                _fee < minFee ? minFee : minOperationFee,
                _fee < minFee ? _fee : _operationFee
            );
        }

        uint256 amountSum = _fee + _operationFee;

        for (uint256 i; i < _receivers.length; i++) {
            uint16 _tokenCoinId = _receivers[i].tokenId;
            uint256 _amount = _receivers[i].amount;

            if (_tokenCoinId == currencyTokenId) {
                if (_amount < minBridgingAmount)
                    revert InvalidBridgingAmount(minBridgingAmount, _amount);
                amountSum += _amount;
            } else {
                if (
                    nativeTokenPredicate.getTokenInfo(_tokenCoinId).addr ==
                    address(0)
                ) {
                    revert TokenNotRegistered(_tokenCoinId);
                }

                if (_amount < minTokenBridgingAmount)
                    revert InvalidBridgingAmount(
                        minTokenBridgingAmount,
                        _amount
                    );

                nativeTokenPredicate.withdraw(msg.sender, _receivers[i]);
            }

            if (msg.value != amountSum) {
                revert WrongValue(amountSum, msg.value);
            }
        }
        _transferAmountToWallet(amountSum);

        emit Withdraw(
            _destinationChainId,
            msg.sender,
            _receivers,
            _fee,
            _operationFee,
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
    ) external {
        _validateSignature(_signature, _bitmap, _data);

        bool success = validators.updateValidatorsChainData(_data);
        if (success) {
            emit ValidatorSetUpdatedGW(_data);
        }
    }

    /// @notice Sets the minimal amounts for fee and bridging.
    /// @param _minFee The minimal fee amount to set
    /// @param _minBridgingAmount The minimal bridging amount to set
    /// @param _minOperationFee The minimal operation fee to set
    /// @dev Restricted to the owner of the contract.
    function setMinAmounts(
        uint256 _minFee,
        uint256 _minBridgingAmount,
        uint256 _minTokenBridgingAmount,
        uint256 _minOperationFee
    ) external onlyOwner {
        minFee = _minFee;
        minBridgingAmount = _minBridgingAmount;
        minTokenBridgingAmount = _minTokenBridgingAmount;
        minOperationFee = _minOperationFee;

        emit MinAmountsUpdated(
            _minFee,
            _minBridgingAmount,
            _minTokenBridgingAmount,
            _minOperationFee
        );
    }

    function getTokenAddress(uint16 _tokenId) external view returns (address) {
        return nativeTokenPredicate.getTokenInfo(_tokenId).addr;
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
        address nativeTokenWalletAddress = nativeTokenPredicate
            .getNativeTokenWalletAddress();
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
