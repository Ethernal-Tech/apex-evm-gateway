// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IERC20TokenPredicate.sol";
import "./interfaces/IERC20Token.sol";
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

    function initialize() public initializer {
        __Ownable_init();
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
            revert InvalidAddress();
        gateway = IGateway(_gateway);
        nativeToken = INativeERC20(_nativeToken);
    }

    /**
     * @notice Function to be used for token deposits
     * @param data Data sent by the sender
     * @dev Can be extended to include other signatures for more functionality
     */
    function deposit(bytes calldata data) external onlyGateway {
        _deposit(data);
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
        uint256 _feeAmount
    ) external {
        _withdraw(_destinationChainId, _receivers, _feeAmount);
    }

    /**
     * @notice Internal initialization function for ERC20TokenPredicate
     * @param _gateway Address of Gatewey to receive deposit information from
     * @param _nativeToken Address of token implementation to deploy clones of
     * @dev Can be called multiple times.
     */
    function _initialize(address _gateway, address _nativeToken) internal {
        require(
            _gateway != address(0) && _nativeToken != address(0),
            "ERC20TokenPredicate: BAD_INITIALIZATION"
        );
        gateway = IGateway(_gateway);
        nativeToken = INativeERC20(_nativeToken);
    }

    function _withdraw(
        uint8 _destinationChainId,
        ReceiverWithdraw[] calldata _receivers,
        uint256 _feeAmount
    ) private {
        uint256 _amountLength = _receivers.length;

        uint256 amountSum;

        for (uint256 i; i < _amountLength; i++) {
            amountSum += _receivers[i].amount;
        }

        require(
            nativeToken.burn(msg.sender, amountSum),
            "ERC20TokenPredicate: BURN_FAILED"
        );

        gateway.withdrawEvent(
            abi.encode(_destinationChainId, msg.sender, _receivers, _feeAmount)
        );
    }

    function _deposit(bytes calldata _data) private {
        (, uint256 ttlExpired, ReceiverDeposit[] memory _receivers) = abi
            .decode(_data, (uint64, uint64, ReceiverDeposit[]));

        if (ttlExpired < block.timestamp) {
            gateway.ttlEvent(_data);
            return;
        }

        uint256 _receiversLength = _receivers.length;

        for (uint256 i; i < _receiversLength; i++) {
            require(
                INativeERC20(nativeToken).mint(
                    _receivers[i].receiver,
                    _receivers[i].amount
                ),
                "ERC20TokenPredicate: MINT_FAILED"
            );
        }

        gateway.depositEvent(_data);
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;

    modifier onlyGateway() {
        if (msg.sender == address(gateway)) revert NotGateway();
        _;
    }
}
