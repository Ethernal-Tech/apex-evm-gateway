// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IValidators} from "./interfaces/IValidators.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {Utils} from "./Utils.sol";

/**
 * @title Validators
 * @notice Manages validator chain data and BLS signature verification for the Gateway system.
 * @dev Supports upgradeability using OpenZeppelin's UUPS module. Implements the IValidators interface.
 */
contract Validators is
    IValidators,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    Utils
{
    address public constant VALIDATOR_BLS_PRECOMPILE =
        0x0000000000000000000000000000000000002060;
    uint256 public constant VALIDATOR_BLS_PRECOMPILE_GAS = 150000;

    address private gateway;

    ValidatorChainData[] private validatorsChainData;

    uint256 public lastConfirmedValidatorsSet;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function setDependencies(address _gatewayAddress) external onlyOwner {
        if (!_isContract(_gatewayAddress))
            revert NotContractAddress(_gatewayAddress);
        gateway = _gatewayAddress;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @notice Sets the initial validators chain data.
     * @param _validatorsChainData Array of validator chain data.
     * @dev Deletes any existing data and replaces it with the provided array.
     */
    function setValidatorsChainData(
        ValidatorChainData[] calldata _validatorsChainData
    ) external onlyOwner {
        delete validatorsChainData;
        for (uint i; i < _validatorsChainData.length; i++) {
            validatorsChainData.push(_validatorsChainData[i]);
        }
    }

    /**
     * @notice Updates the validators chain data with new values.
     * @param _data Encoded data containing the validators set number, TTL, and new validator chain data.
     * @dev Reverts if the provided validators set number is invalid. Emits `TTLExpired` if the TTL has expired.
     */
    function updateValidatorsChainData(
        bytes calldata _data
    ) external onlyGateway returns (bool) {
        ValidatorSetChange memory _validatorSetChange = abi.decode(
            _data,
            (ValidatorSetChange)
        );

        if (
            _validatorSetChange._validatorsSetNumber !=
            (lastConfirmedValidatorsSet + 1)
        ) {
            revert WrongValidatorsSetValue();
        }

        if (_validatorSetChange._ttl < block.number) {
            emit TTLExpired(_data);
            return false;
        }

        lastConfirmedValidatorsSet++;

        delete validatorsChainData;
        for (uint i; i < _validatorSetChange._validatorsChainData.length; i++) {
            validatorsChainData.push(
                _validatorSetChange._validatorsChainData[i]
            );
        }

        emit ValidatorsSetUpdated(_data);
        return true;
    }
    
    /**
     * @notice Retrieves the current validators chain data.
     * @return Array of validator chain data.
     */
    function getValidatorsChainData()
        external
        view
        returns (ValidatorChainData[] memory)
    {
        return validatorsChainData;
    }

    /**
     * @notice Verifies the validity of a BLS signature.
     * @param _hash Hash of the data to be verified.
     * @param _signature BLS signature to validate.
     * @param _bitmap Bitmap representing validator participation.
     * @return valid Boolean indicating whether the signature is valid.
     * @dev Calls the BLS precompile contract for verification. Uses gas limit `VALIDATOR_BLS_PRECOMPILE_GAS`.
     */
    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap
    ) external view returns (bool) {
        // verify signatures` for provided sig data and sigs bytes
        // solhint-disable-next-line avoid-low-level-calls
        // slither-disable-next-line low-level-calls,calls-loop
        (bool callSuccess, bytes memory returnData) = VALIDATOR_BLS_PRECOMPILE
            .staticcall{gas: VALIDATOR_BLS_PRECOMPILE_GAS}(
            abi.encodePacked(
                uint8(1),
                abi.encode(_hash, _signature, validatorsChainData, _bitmap)
            )
        );

        return callSuccess && abi.decode(returnData, (bool));
    }

    function version() public pure returns (string memory) {
        return "1.1.1";
    }

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }
}
