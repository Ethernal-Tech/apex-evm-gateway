// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IGatewayStructs.sol";
import "./ERC20TokenPredicate.sol";
import "./Validators.sol";

contract Gateway is
    IGateway,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    ERC20TokenPredicate public eRC20TokenPredicate;
    Validators public validators;
    uint256 public constant MAX_LENGTH = 2048;

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
        address _eRC20TokenPredicate,
        address _validators
    ) external onlyOwner {
        if (_eRC20TokenPredicate == address(0) || _validators == address(0))
            revert ZeroAddress();
        eRC20TokenPredicate = ERC20TokenPredicate(_eRC20TokenPredicate);
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

        eRC20TokenPredicate.deposit(_data, msg.sender);
    }

    function withdraw(
        Withdrawals calldata _withdrawals,
        bytes memory _signature
    ) external {
        if (!_verifyWithdrawal(_withdrawals, _signature, msg.sender)) {
            revert InvalidSignature();
        }
        eRC20TokenPredicate.withdraw(_withdrawals);
    }

    function depositEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit Deposit(_data);
    }

    function withdrawEvent(
        uint8 _destinationChainId,
        address _sender,
        ReceiverWithdrawal[] calldata _receivers,
        uint256 _feeAmount
    ) external onlyPredicate {
        emit Withdraw(_destinationChainId, _sender, _receivers, _feeAmount);
    }

    function ttlEvent(
        bytes calldata _data
    ) external onlyPredicate maxLengthExceeded(_data) {
        emit TTLExpired(_data);
    }

    function _verifyWithdrawal(
        Withdrawals calldata _withdrawals,
        bytes memory _signature,
        address _caller
    ) internal view returns (bool) {
        // bytes32 digest = _hashTypedDataV4(
        //     keccak256(
        //         abi.encode(
        //             keccak256(
        //                 "Withdrawals(uint8 destinationChainId,address sender,ReceiverWithdrawal[] receivers,uint256 feeAmount)ReceiverWithdrawal(string receiver,uint256 amount)"
        //             ),
        //             _withdrawals.destinationChainId,
        //             _withdrawals.sender,
        //             _withdrawals.receivers,
        //             _withdrawals.feeAmount
        //         )
        //     )
        // );

        // address signer = ECDSA.recover(digest, _signature);

        // return signer == _caller && signer == _withdrawals.sender;
        return true;
    }

    modifier onlyPredicate() {
        if (msg.sender != address(eRC20TokenPredicate)) revert NotPredicate();
        _;
    }

    modifier maxLengthExceeded(bytes calldata _data) {
        if (_data.length > MAX_LENGTH) revert ExceedsMaxLength();
        _;
    }
}
