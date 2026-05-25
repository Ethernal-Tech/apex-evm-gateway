// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../contracts/BLSVerifier.sol";
import { IGatewayStructs } from "../contracts/interfaces/IGatewayStructs.sol";

contract BLSVerifierTest {
    function verifyBLSSignature(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap,
        IGatewayStructs.ValidatorChainData[] memory _publicKeys,
        bytes memory _domain
    ) public view returns (bool) {
        return BLSVerifier.verifyBLSSignature(_hash, _signature, _bitmap, _publicKeys, _domain);
    }
}
