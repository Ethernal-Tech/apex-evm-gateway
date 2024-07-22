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

    ValidatorChainData[] private chainData;
    // current validators set addresses
    address[] private validatorsAddresses;
    // validator address index(+1) in chainData mapping
    mapping(address => uint8) private addressValidatorIndex;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] calldata _validators) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        for (uint8 i; i < _validators.length; i++) {
            if (_validators[i] == address(0)) revert ZeroAddress();
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

    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        bytes calldata _bitmap
    ) public view returns (bool callSuccess, bytes memory returnData) {
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
    }

    function setValidatorsChainData(
        ValidatorAddressChainData[] calldata _chainDatas
    ) public onlyGatewayOrOwner {
        if (validatorsCount != _chainDatas.length) {
            revert InvalidData("validators count");
        }

        // recreate array with n elements
        delete chainData;
        for (uint i; i < validatorsCount; i++) {
            chainData.push();
        }

        // set validator chain data for each validator
        for (uint i; i < validatorsCount; i++) {
            ValidatorAddressChainData calldata dt = _chainDatas[i];
            uint8 indx = addressValidatorIndex[dt.addr];
            if (indx == 0) {
                revert InvalidData("invalid address");
            }

            chainData[indx - 1] = dt.data;
        }
    }

    function addValidatorChainData(
        address _addr,
        ValidatorChainData calldata _data
    ) external onlyGateway {
        if (chainData.length == 0) {
            // recreate array with n elements
            delete chainData;
            for (uint i; i < validatorsCount; i++) {
                chainData.push();
            }
        }

        uint8 indx = addressValidatorIndex[_addr] - 1;
        chainData[indx] = _data;
    }

    function getChainData()
        external
        view
        returns (ValidatorChainData[] memory)
    {
        return chainData;
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
