// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {INativeTokenPredicate} from "./interfaces/INativeTokenPredicate.sol";
import {INativeTokenWallet} from "./interfaces/INativeTokenWallet.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";

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
    UUPSUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    address public gateway;
    INativeTokenWallet public nativeTokenWallet;
    mapping(uint64 => bool) public unused1; // remove it before deploying to production
    uint64 public unused2; // remove it before deploying to production

    /// @notice Tracks the ID of the last processed batch.
    uint64 public lastBatchId;

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
        address _gateway,
        address _nativeTokenWallet
    ) external onlyOwner {
        if (_gateway == address(0) || _nativeTokenWallet == address(0))
            revert ZeroAddress();
        gateway = _gateway;
        nativeTokenWallet = INativeTokenWallet(_nativeTokenWallet);
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
        address _relayer
    ) external onlyGateway nonReentrant returns (bool) {
        Deposits memory _deposits = abi.decode(_data, (Deposits));

        // _deposits.batchId can not go into past but can go into future
        // this is not a bug, this is a mandatory by design and how oracles work
        if (_deposits.batchId <= lastBatchId) {
            revert BatchAlreadyExecuted();
        }

        lastBatchId++;

        if (_deposits.ttlExpired < block.number) {
            return false;
        }

        ReceiverDeposit[] memory _receivers = _deposits.receivers;
        uint256 _receiversLength = _receivers.length;

        // If any nativeTokenWallet.deposit call fails, the entire execution must revert.
        // This is mandatory because all deposits (_receiversLength + fee)
        // must be executed as an atomic operation.
        for (uint256 i; i < _receiversLength; i++) {
            nativeTokenWallet.deposit(
                _receivers[i].receiver,
                _receivers[i].amount
            );
        }

        nativeTokenWallet.deposit(_relayer, _deposits.feeAmount);

        return true;
    }

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
