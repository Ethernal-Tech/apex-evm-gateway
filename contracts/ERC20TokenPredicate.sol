// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IERC20TokenPredicate.sol";
import "./interfaces/INativeERC20.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./System.sol";

/**
    @title ERC20TokenPredicate
    @author Polygon Technology (@QEDK)
    @notice Enables ERC20 token deposits and withdrawals across an arbitrary root chain and token chain
 */
// solhint-disable reason-string
contract ERC20TokenPredicate is
    IERC20TokenPredicate,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    System
{
    using SafeERC20 for IERC20;

    IGateway public gateway;
    INativeERC20 public nativeToken;
    mapping(uint64 => bool) public usedBatches;

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setDependencies(
        address _gateway,
        address _nativeToken
    ) external onlyOwner {
        if (_gateway == address(0) || _nativeToken == address(0))
            revert ZeroAddress();
        gateway = IGateway(_gateway);
        nativeToken = INativeERC20(_nativeToken);
    }

    /**
     * @notice Function to be used for token deposits
     * @param _data Data sent by the sender
     * @dev Can be extended to include other signatures for more functionality
     */
    function deposit(
        bytes calldata _data,
        address _relayer
    ) external onlyGateway {
        Deposits memory _deposits = abi.decode(_data, (Deposits));

        if (usedBatches[_deposits.batchId]) {
            revert BatchAlreadyExecuted();
        }

        if (_deposits.ttlExpired < block.number) {
            gateway.ttlEvent(_data);
            return;
        }

        usedBatches[_deposits.batchId] = true;

        ReceiverDeposit[] memory _receivers = _deposits.receivers;
        uint256 _receiversLength = _receivers.length;

        for (uint256 i; i < _receiversLength; i++) {
            nativeToken.mint(_receivers[i].receiver, _receivers[i].amount);
        }

        nativeToken.mint(_relayer, _deposits.feeAmount);

        gateway.depositEvent(_data);
    }

    /**
     * @notice Function to withdraw tokens from the withdrawer to receiver on the destination chain
     * @param _destinationChainId id of the destination chain
     * @param _receivers array of ReceiverWithdraw structs on the destination chain
     * @param _feeAmount amount to cover the fees
     */
    function withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount,
        address _caller,
        uint256 _amountSum
    ) external {
        nativeToken.burn(address(gateway), _amountSum);

        gateway.withdrawEvent(
            _destinationChainId,
            _caller,
            _receivers,
            _feeAmount
        );
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }
}
