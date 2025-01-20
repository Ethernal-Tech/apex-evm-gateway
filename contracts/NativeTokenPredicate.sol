// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/INativeTokenPredicate.sol";
import "./interfaces/INativeTokenWallet.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";

/**
    @title ERC20TokenPredicate
    @author Polygon Technology (@QEDK)
    @notice Enables ERC20 token deposits and withdrawals across an arbitrary root chain and token chain
 */
// solhint-disable reason-string
contract NativeTokenPredicate is
    INativeTokenPredicate,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    address public gateway;
    INativeTokenWallet public nativeTokenWallet;
    mapping(uint64 => bool) public unused1; // remove it before deploying to production
    uint64 public unused2; // remove it before deploying to production
    uint64 public lastBatchId;

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
     * @notice Function to be used for token deposits
     * @param _data Data sent by the sender
     * @dev Can be extended to include other signatures for more functionality
     */
    function deposit(
        bytes calldata _data,
        address _relayer
    ) external onlyGateway returns (bool) {
        Deposits memory _deposits = abi.decode(_data, (Deposits));

        // _deposits.batchId can not go into past
        if (_deposits.batchId != lastBatchId + 1) {
            revert BatchAlreadyExecuted();
        }

        lastBatchId++;

        if (_deposits.ttlExpired < block.number) {
            return false;
        }

        ReceiverDeposit[] memory _receivers = _deposits.receivers;
        uint256 _receiversLength = _receivers.length;

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
