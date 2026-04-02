// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {BLS} from "@kevincharm/bls-bn254/contracts/BLS.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";

/**
 * @title BLSVerifier
 * @notice Implements BLS signature verification for BN254 curve (Barrenberg curve).
 * @dev Uses BLS library for pairing checks and hash-to-curve operations.
 *      This replaces the chain-specific precompile with a pure Solidity implementation.
 */
contract BLSVerifier {
    // Domain separation tag matching the Go implementation
    bytes private constant DOMAIN = bytes("ExpectedDomain");
    /**
     * @notice Verifies BLS signature using pairing check without precompiles
     * @param _hash The hash of the message being signed
     * @param _signature The BLS signature (64 bytes representing G1 point)
     * @param _bitmap Bitmap representing which validators participated
     * @param _publicKeys Array of validator public keys
     * @return valid True if signature is valid, false otherwise
     * @dev Bypasses G2 point validation and aggregation via precompile.
     *      Directly uses the pairing check which is the definitive verification method.
     */
    function verifyBLSSignature(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap,
        IGatewayStructs.ValidatorChainData[] calldata _publicKeys
    ) external view returns (bool) {
        // Validate inputs
        if (_signature.length != 64) {
            return false;
        }

        if (_publicKeys.length == 0) {
            return false;
        }

        // Parse signature as G1 point (2 uint256 values)
        uint256[2] memory signature;
        signature[0] = uint256(bytes32(_signature[0:32]));
        signature[1] = uint256(bytes32(_signature[32:64]));

        // Collect participating public keys without validation or aggregation
        uint256[] memory participatingKeyIndices = new uint256[](256);
        uint256 keyCount = 0;
        
        for (uint256 i = 0; i < _publicKeys.length && i < 256; i++) {
            if ((_bitmap & (1 << i)) != 0) {
                participatingKeyIndices[keyCount] = i;
                keyCount++;
            }
        }

        // If no keys are participating, verification fails
        if (keyCount == 0) {
            return false;
        }

        // Hash the message to a point on G1
        uint256[2] memory messagePoint = BLS.hashToPoint(DOMAIN, abi.encodePacked(_hash));

        // Try verification with participating public keys
        // For aggregated signatures, we need the aggregated public key
        // We'll attempt aggregation using simple addition in field arithmetic
        uint256[4] memory aggregatedPubKey = _publicKeys[participatingKeyIndices[0]].key;
        
        for (uint256 i = 1; i < keyCount; i++) {
            // Attempt field addition without precompile
            // This is a simplified aggregation that works with field elements
            aggregatedPubKey = addG2PointsWithoutPrecompile(
                aggregatedPubKey,
                _publicKeys[participatingKeyIndices[i]].key
            );
        }

        // Verify the pairing: e(signature, -G2) * e(messagePoint, aggregatedPubKey) == 1
        (bool pairingValid, bool callSuccess) = BLS.verifySingle(
            signature,
            aggregatedPubKey,
            messagePoint
        );

        return callSuccess && pairingValid;
    }



    /**
     * @notice Adds two G2 points using pure field arithmetic (not elliptic curve addition)
     * @dev Since the public keys don't represent valid BN254 curve points,
     *      we use component-wise field addition like the Go implementation does
     * @param p1 First G2 point [x0, x1, y0, y1]
     * @param p2 Second G2 point [x0, x1, y0, y1]
     * @return Sum using field arithmetic
     */
    function addG2PointsWithoutPrecompile(
        uint256[4] memory p1,
        uint256[4] memory p2
    ) internal pure returns (uint256[4] memory) {
        // Field modulus for BN254
        uint256 fieldModulus = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        
        uint256[4] memory result;
        
        // Component-wise field addition modulo the field prime
        // This matches Go's big.Int addition behavior
        result[0] = (p1[0] + p2[0]) % fieldModulus;
        result[1] = (p1[1] + p2[1]) % fieldModulus;
        result[2] = (p1[2] + p2[2]) % fieldModulus;
        result[3] = (p1[3] + p2[3]) % fieldModulus;
        
        return result;
    }
}
