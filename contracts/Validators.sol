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

    address[] public validatorsAddresses;

    // mapping in case they could be added/removed
    mapping(address => uint8) public addressValidatorIndex;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] calldata _validators) public initializer {
        __Ownable_init(msg.sender);
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
    ) external {
        if (_gatewayAddress == address(0)) revert ZeroAddress();
        gatewayAddress = _gatewayAddress;
        _setValidatorsChainData(_chainDatas);
    }

    function _setValidatorsChainData(
        ValidatorAddressChainData[] calldata _chainDatas
    ) internal {
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

    modifier onlyGateway() {
        if (msg.sender != gatewayAddress) revert NotGateway();
        _;
    }
}
