// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
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

    //EIP712 block start
    mapping(address => uint256) public nonces;
    string public constant name = "Apex EVM Gateway";
    string public constant version = "1";
    bytes32 public constant salt =
        0x617065782d65766d2d6761746577617900000000000000000000000000000000;

    string private constant EIP712_DOMAIN =
        "EIP712Domain(string name,string version,uint8 chainID,address verifyingContract,bytes32 salt)";

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(abi.encodePacked(EIP712_DOMAIN));

    string private constant RECEIVERWITHDRAWAL_TYPE =
        "ReceiverWithdrawal(string receiver,uint256 amount)";

    bytes32 private constant RECEIVERWITHDRAWAL_TYPEHASH =
        keccak256(abi.encodePacked(RECEIVERWITHDRAWAL_TYPE));

    string private constant WITHDRAWALS_TYPE =
        "Withdraw(uint256 nounce,uint256 feeAmount,address sender,uint8 destinationChainId,ReceiverWithdrawal[] receivers)ReceiverWithdrawal(string receiver,uint256 amount)";

    bytes32 private constant WITHDRAWALS_TYPEHASH =
        keccak256(abi.encodePacked(WITHDRAWALS_TYPE, RECEIVERWITHDRAWAL_TYPE));

    bytes32 private immutable DOMAIN_SEPARATOR =
        keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(abi.encodePacked(name)),
                keccak256(abi.encodePacked(version)),
                address(this),
                salt
            )
        );

    //EIP712 block end

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
        if (!_verifyWithdrawal(_withdrawals, _signature)) {
            revert InvalidSignature();
        }
        nonces[_withdrawals.sender]++;

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
        bytes memory _signature
    ) internal view returns (bool) {
        return
            _withdrawals.sender ==
            ECDSA.recover(_hashWithdrawals(_withdrawals), _signature);
    }

    function _hashReceiverWithdrawal(
        ReceiverWithdrawal[] memory _receiverWithdrawals
    ) internal pure returns (bytes32) {
        uint256 _receiversLength = _receiverWithdrawals.length;
        bytes32[] memory receiversHashes = new bytes32[](_receiversLength);

        for (uint i = 0; i < _receiversLength; i++) {
            receiversHashes[i] = keccak256(
                abi.encode(
                    RECEIVERWITHDRAWAL_TYPEHASH,
                    _receiverWithdrawals[i].receiver,
                    _receiverWithdrawals[i].amount
                )
            );
        }

        return keccak256(abi.encodePacked(receiversHashes));
    }

    function _hashWithdrawals(
        Withdrawals memory _withdrawals
    ) private view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\\x19\\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            WITHDRAWALS_TYPEHASH,
                            _withdrawals.nonce,
                            _withdrawals.feeAmount,
                            _withdrawals.sender,
                            _withdrawals.destinationChainId,
                            _hashReceiverWithdrawal(_withdrawals.receivers)
                        )
                    )
                )
            );
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
