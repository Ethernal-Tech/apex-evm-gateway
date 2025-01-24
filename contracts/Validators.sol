// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IValidators.sol";
import "./interfaces/IGatewayStructs.sol";

contract Validators is
    IValidators,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    address public constant VALIDATOR_BLS_PRECOMPILE =
        0x0000000000000000000000000000000000002060;
    uint256 public constant VALIDATOR_BLS_PRECOMPILE_GAS = 150000;

    address private gateway;

    ValidatorChainData[] private validatorsChainData;

    uint256 public lastConfirmedValidatorsSet;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function setDependencies(address _gateway) external onlyOwner {
        if (_gateway == address(0)) revert ZeroAddress();
        gateway = _gateway;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function setValidatorsChainData(
        ValidatorChainData[] calldata _validatorsChainData
    ) external onlyOwner {
        delete validatorsChainData;
        for (uint i; i < _validatorsChainData.length; i++) {
            validatorsChainData.push(_validatorsChainData[i]);
        }
    }

    function updateValidatorsChainData(
        bytes calldata _data
    ) external onlyGateway {
        (
            uint256 _validatorsSetNumber,
            uint256 _ttl,
            ValidatorChainData[] memory _validatorsChainData
        ) = abi.decode(_data, (uint256, uint256, ValidatorChainData[]));

        if (_validatorsSetNumber != (lastConfirmedValidatorsSet + 1)) {
            revert WrongValidatorsSetValue();
        }

        lastConfirmedValidatorsSet++;

        if (_ttl < block.number) {
            emit TTLExpired(_data);
            return;
        }

        delete validatorsChainData;
        for (uint i; i < _validatorsChainData.length; i++) {
            validatorsChainData.push(_validatorsChainData[i]);
        }

        emit ValidatorsSetUpdated(_data);
    }

    function getValidatorsChainData()
        external
        view
        returns (ValidatorChainData[] memory)
    {
        return validatorsChainData;
    }

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

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert NotGateway();
        _;
    }
}
