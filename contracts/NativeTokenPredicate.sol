// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {INativeTokenPredicate} from "./interfaces/INativeTokenPredicate.sol";
import {NativeTokenWallet} from "./NativeTokenWallet.sol";
import {Utils} from "./Utils.sol";

/**
 * @title NativeTokenPredicate
 * @notice Facilitates deposits and withdrawals of native tokens across chains.
 * @dev Implements deposit functionality and manages dependencies for native token operations.
 * Inherits from OpenZeppelin's Initializable, OwnableUpgradeable, UUPSUpgradeable, and ReentrancyGuard.
 */
contract NativeTokenPredicate is
    INativeTokenPredicate,
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    Utils
{
    using SafeERC20 for IERC20;

    NativeTokenWallet public nativeTokenWallet;
    address public gateway;

    /// @notice Tracks the ID of the last processed batch.
    uint64 public lastBatchId;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[50] private __gap;

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
        address _gatewayAddress,
        address _nativeTokenWalletAddress
    ) external onlyOwner {
        if (!_isContract(_gatewayAddress))
            revert NotContractAddress(_gatewayAddress);
        if (!_isContract(_nativeTokenWalletAddress))
            revert NotContractAddress(_nativeTokenWalletAddress);

        gateway = _gatewayAddress;
        nativeTokenWallet = NativeTokenWallet(
            payable(_nativeTokenWalletAddress)
        );
    }

    function resetBatchId() external onlyOwner {
        lastBatchId = 0;
    }

    /**
     * @notice Handles token deposits.
     * @param _data Encoded deposit data, including batch ID, TTL, and receiver details.
     * @param _relayer Address of the relayer initiating the deposit.
     * @return success Indicates whether the deposit operation succeeded.
     * @dev Validates batch ID, TTL expiration, and performs deposits for receivers and the relayer.
     */
    function deposit(
        bytes calldata _data,
        address _relayer,
        uint16 _currencyTokenId
    ) external onlyGateway nonReentrant returns (bool) {
        Deposits memory _deposits = abi.decode(_data, (Deposits));

        // _deposits.batchId cannot go into the past but can go into the future.
        // This is not a bug; it is mandatory by design and aligns with how oracles work.
        if (_deposits.batchId <= lastBatchId) {
            revert BatchAlreadyExecuted();
        }

        lastBatchId = _deposits.batchId;

        if (_deposits.ttlExpired < block.number) {
            return false;
        }

        ReceiverDeposit[] memory _receivers = _deposits.receivers;
        uint256 _receiversLength = _receivers.length;

        // If any nativeTokenWallet.deposit call fails, the entire execution must revert.
        // This is mandatory because all deposits (_receiversLength + fee)
        // must be executed as an atomic operation.
        for (uint256 i; i < _receiversLength; i++) {
            uint16 _tokenId = _receivers[i].tokenId;
            nativeTokenWallet.deposit(
                _receivers[i].receiver,
                _receivers[i].amount,
                _tokenId,
                _tokenId == _currencyTokenId
            );
        }

        nativeTokenWallet.deposit(
            _relayer,
            _deposits.feeAmount,
            _currencyTokenId,
            true
        );

        return true;
    }

    function withdraw(
        address _sender,
        ReceiverWithdraw calldata _receiver
    ) external onlyGateway {
        nativeTokenWallet.withdraw(_sender, _receiver);
    }

    function setTokenAsLockUnlockToken(uint16 _tokenId) external onlyGateway {
        nativeTokenWallet.setTokenAsLockUnlockToken(_tokenId);
    }

    function setTokenAddress(
        uint16 _tokenId,
        address _tokenAddress
    ) external onlyGateway {
        nativeTokenWallet.setTokenAddress(_tokenId, _tokenAddress);
    }

    function getTokenAddress(uint16 _tokenId) external view returns (address) {
        return nativeTokenWallet.tokenAddress(_tokenId);
    }

    function isTokenRegistered(uint16 _tokenId) public view returns (bool) {
        return nativeTokenWallet.tokenAddress(_tokenId) != address(0);
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }
}
