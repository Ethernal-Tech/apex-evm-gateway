// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
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
    System,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20;

    IGateway public gateway;
    INativeERC20 public nativeToken;
    mapping(uint64 => bool) public usedBatches;

    // address immutable verifyingContract = address(this);
    // bytes32 constant salt =
    //     0x617065782d65766d2d6761746577617900000000000000000000000000000000;

    // string private constant RECEIVERWITHDRAWAL_TYPE =
    //     "ReceiverWithdrawal(string receiver,uint256 amount)";

    // string private constant WITHDRAWALS_TYPE =
    //     "Withdraw(uint8 destinationChainId,ReceiverWithdrawal[] receivers,uint256 feeAmount)ReceiverWithdrawal(string receiver,uint256 amount)";

    // string private constant EIP712_DOMAIN =
    //     "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)";

    // bytes32 private constant WITHDRAW_TYPEHASH =
    //     keccak256(abi.encodePacked(WITHDRAW_TYPE));

    // bytes32 private constant EIP712_DOMAIN_TYPEHASH =
    //     keccak256(abi.encodePacked(EIP712_DOMAIN));

    // bytes32 private immutable DOMAIN_SEPARATOR =
    //     keccak256(
    //         abi.encode(
    //             EIP712_DOMAIN_TYPEHASH,
    //             keccak256("Apex EVM Gateway"),
    //             keccak256("1"),
    //             verifyingContract,
    //             salt
    //         )
    //     );

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
     * @param _withdrawals withdrawals to be made
     */
    function withdraw(
        Withdrawals calldata _withdrawals,
        bytes memory _signature,
        address _caller
    ) external {
        if (!_verifyWithdrawal(_withdrawals, _signature, _caller)) {
            revert InvalidSignature();
        }

        uint256 _amountLength = _withdrawals.receivers.length;

        uint256 amountSum;

        for (uint256 i; i < _amountLength; i++) {
            amountSum += _withdrawals.receivers[i].amount;
        }

        amountSum = amountSum + _withdrawals.feeAmount;

        nativeToken.burn(_caller, amountSum);

        gateway.withdrawEvent(
            _withdrawals.destinationChainId,
            _caller,
            _withdrawals.receivers,
            _withdrawals.feeAmount
        );
    }

    function _verifyWithdrawal(
        Withdrawals calldata _withdrawals,
        bytes memory _signature,
        address _caller
    ) internal view returns (bool) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "Withdrawals(uint8 destinationChainId,address sender,ReceiverWithdrawal[] receivers,uint256 feeAmount)ReceiverWithdrawal(string receiver,uint256 amount)"
                    ),
                    _withdrawals.destinationChainId,
                    _withdrawals.sender,
                    _withdrawals.receivers,
                    _withdrawals.feeAmount
                )
            )
        );

        address signer = ECDSA.recover(digest, _signature);

        return signer == _caller && signer == _withdrawals.sender;
    }

    // function hashWithdrawals(
    //     Withdrawals calldata _withdrawals
    // ) private pure returns (bytes32) {
    //     return
    //         keccak256(
    //             abi.encode(
    //                 WITHDRAW_TYPEHASH,
    //                 _withdrawals.destinationChainId,
    //                 _withdrawals.receivers,
    //                 _withdrawals.feeAmount
    //             )
    //         );
    // }

    // function verify(
    //     address _signer,
    //     Withdrawals calldata _withdrawals,
    //     uint8 sigV,
    //     bytes32 sigR,
    //     bytes32 sigS
    // ) public pure returns (bool) {
    //     return
    //         _signer ==
    //         ecrecover(hashWithdrawals(_withdrawals), sigV, sigR, sigS);
    // }

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
