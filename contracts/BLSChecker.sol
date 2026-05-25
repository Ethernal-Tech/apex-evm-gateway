// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";
import {BLSVerifier} from "./BLSVerifier.sol";

/**
 * @title Validators
 * @notice Manages validator chain data and BLS signature verification for the Gateway system.
 * @dev Supports upgradeability using OpenZeppelin's UUPS module. Implements the IValidators interface.
 */
contract BLSChecker is
    IGatewayStructs
{
    function isBlsSignatureValid(
        ValidatorChainData[] calldata _validatorsChainData,
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap,
        string calldata _domain
    ) external view returns (bool) {
        bytes memory blsDomain = abi.encodePacked(keccak256(abi.encodePacked(_domain)));
        
        return BLSVerifier.verifyBLSSignature(_hash, _signature, _bitmap, _validatorsChainData, blsDomain);
    }
}
