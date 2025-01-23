// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./IGatewayStructs.sol";

interface IValidators is IGatewayStructs {
    function setValidatorsChainData(
        ValidatorChainData[] calldata _validatorsChainData
    ) external;

    function updateValidatorsChainData(bytes calldata _data) external;

    function getValidatorsChainData()
        external
        view
        returns (ValidatorChainData[] memory);

    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap
    ) external view returns (bool);
}
