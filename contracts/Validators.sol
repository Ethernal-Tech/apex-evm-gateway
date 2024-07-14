// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IGatewayStructs.sol";

contract Validators is
    IGatewayStructs,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // slither-disable too-many-digits
    address constant VALIDATOR_BLS_PRECOMPILE =
        0x0000000000000000000000000000000000002060;
    uint256 constant VALIDATOR_BLS_PRECOMPILE_GAS = 50000;

    address private gatewayAddress;

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

    function setDependencies(address _gatewayAddress) external onlyOwner {
        gatewayAddress = _gatewayAddress;
    }

    function isValidator(address _addr) public view returns (bool) {
        return addressValidatorIndex[_addr] != 0;
    }

    function getValidatorIndex(address _addr) public view returns (uint8) {
        return addressValidatorIndex[_addr];
    }

    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        uint256[4] memory _verifyingKey
    ) public view returns (bool) {
        // verify signatures` for provided sig data and sigs bytes
        // solhint-disable-next-line avoid-low-level-calls
        // slither-disable-next-line low-level-calls,calls-loop
        (bool callSuccess, bytes memory returnData) = VALIDATOR_BLS_PRECOMPILE
            .staticcall{gas: VALIDATOR_BLS_PRECOMPILE_GAS}(
            abi.encodePacked(
                uint8(0),
                abi.encode(_hash, _signature, _verifyingKey)
            )
        );
        bool verified = abi.decode(returnData, (bool));
        return callSuccess && verified;
    }

    function isBlsSignatureValidByValidatorAddress(
        bytes32 _hash,
        bytes calldata _signature,
        address _validatorAddr
    ) public view returns (bool) {
        uint256 indx = addressValidatorIndex[_validatorAddr] - 1;
        uint256[4] memory key = chainData[indx].key;
        return isBlsSignatureValid(_hash, _signature, key);
    }

    function setValidatorsChainData(
        ValidatorAddressChainData[] calldata _chainDatas
    ) external onlyGateway {
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

    modifier onlyGateway() {
        if (msg.sender != gatewayAddress) revert NotRelayer();
        _;
    }
}
