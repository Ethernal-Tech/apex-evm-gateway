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
    address public constant VALIDATOR_BLS_PRECOMPILE =
        0x0000000000000000000000000000000000002060;
    uint256 public constant VALIDATOR_BLS_PRECOMPILE_GAS = 150000;

    ValidatorChainData[] private validatorsChainData;

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

    function setValidatorsChainData(
        ValidatorChainData[] calldata _validatorsChainData
    ) external onlyOwner {
        delete validatorsChainData;
        for (uint i; i < _validatorsChainData.length; i++) {
            validatorsChainData.push(_validatorsChainData[i]);
        }
    }

    function getValidatorsChainData()
        external
        view
        returns (ValidatorChainData[] memory)
    {
        return validatorsChainData;
    }

    struct BlsSigCheck {
        bytes32 _hash;
        bytes _signature;
        ValidatorChainData[] validatorsChainData;
        uint256 _bitmap;
    }

    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap
    ) external view returns (bool) {
        // verify signatures` for provided sig data and sigs bytes
        // solhint-disable-next-line avoid-low-level-calls
        // slither-disable-next-line low-level-calls,calls-loop

        BlsSigCheck memory data = BlsSigCheck({
            _hash: _hash,
            _signature: _signature,
            validatorsChainData: validatorsChainData,
            _bitmap: _bitmap
        });

        (bool callSuccess, bytes memory returnData) = VALIDATOR_BLS_PRECOMPILE
            .staticcall{gas: VALIDATOR_BLS_PRECOMPILE_GAS}(
            abi.encodePacked(
                uint8(1),
                abi.encode(data)
            )
        );

        return callSuccess && abi.decode(returnData, (bool));
    }
}
