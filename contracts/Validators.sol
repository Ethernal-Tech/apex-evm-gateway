// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGatewayStructs.sol";
import "./System.sol";

contract Validators is
    IGatewayStructs,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    System
{
    address public gatewayAddress;

    // BlockchainId -> validator address -> ValidatorChainData
    mapping(address => ValidatorChainData) private chainDataPerAddress;
    // BlockchainId -> ValidatorChainData[]
    ValidatorChainData[] private chainData;

    // keep validatorsArrayAddresses because maybe
    address[] public validatorsAddresses;
    // mapping in case they could be added/removed
    mapping(address => uint8) public addressValidatorIndex;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] calldata _validators) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        for (uint8 i; i < _validators.length; i++) {
            addressValidatorIndex[_validators[i]] = i + 1;
            validatorsAddresses.push(_validators[i]);
        }
        validatorsCount = uint8(_validators.length);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setDependencies(
        address _gatewayAddress,
        ValidatorAddressChainData[] calldata _chainDatas
    ) external onlyOwner {
        if (_gatewayAddress == address(0)) revert ZeroAddress();
        gatewayAddress = _gatewayAddress;
        setValidatorsChainData(_chainDatas);
    }

    function setValidatorsChainData(
        ValidatorAddressChainData[] calldata _chainDatas
    ) public onlyGatewayOrOwner {
        uint256 _length = _chainDatas.length;
        if (validatorsCount != _length) {
            revert InvalidData("validators count");
        }
        // set validator chain data for each validator
        for (uint i; i < _length; i++) {
            ValidatorAddressChainData calldata dt = _chainDatas[i];
            chainDataPerAddress[dt.addr] = dt.data;
        }
        _updateValidatorChainData();
    }

    function addValidatorChainData(
        address _addr,
        ValidatorChainData calldata _data
    ) external onlyGateway {
        chainDataPerAddress[_addr] = _data;
        _updateValidatorChainData();
    }

    function _updateValidatorChainData() internal {
        // chainDataPerAddress must be set for all the validator addresses
        uint cnt = 0;
        uint256 validatorsAddressesLength = validatorsAddresses.length;
        for (uint i; i < validatorsAddressesLength; i++) {
            if (chainDataPerAddress[validatorsAddresses[i]].key[0] != 0) {
                cnt++;
            }
        }
        if (cnt != validatorsAddressesLength) {
            return;
        }
        delete chainData;
        for (uint i; i < validatorsAddressesLength; i++) {
            chainData.push(chainDataPerAddress[validatorsAddresses[i]]);
        }
    }

    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap
    ) external view returns (bool callSuccess, bytes memory returnData) {
        // verify signatures` for provided sig data and sigs bytes
        // solhint-disable-next-line avoid-low-level-calls
        // slither-disable-next-line low-level-calls,calls-loop
        (callSuccess, returnData) = VALIDATOR_BLS_PRECOMPILE.staticcall{
            gas: VALIDATOR_BLS_PRECOMPILE_GAS
        }(
            abi.encodePacked(
                uint8(1),
                abi.encode(_hash, _signature, chainData, _bitmap)
            )
        );

        return (callSuccess, returnData);
    }

    function getValidatorsAddresses() external view returns (address[] memory) {
        return validatorsAddresses;
    }

    function getValidatorsChainData()
        external
        view
        returns (ValidatorChainData[] memory)
    {
        return chainData;
    }

    function getChainData()
        external
        view
        returns (ValidatorChainData[] memory)
    {
        return chainData;
    }

    function getChainDataPerAddress(
        address _addr
    ) external view returns (ValidatorChainData memory) {
        return chainDataPerAddress[_addr];
    }

    modifier onlyGateway() {
        if (msg.sender != gatewayAddress) revert NotGateway();
        _;
    }

    modifier onlyGatewayOrOwner() {
        if (msg.sender != gatewayAddress && msg.sender != owner())
            revert NotGatewayOrOwner();
        _;
    }
}
