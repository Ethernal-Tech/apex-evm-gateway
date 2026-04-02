// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {BLS} from "@kevincharm/bls-bn254/contracts/BLS.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";

/**
 * @title BLSVerifier
 * @notice Implements BLS signature verification for BN254 curve (Barreto-Naehrig curve).
 * @dev Uses BLS library for pairing checks and hash-to-curve operations.
 *      Performs proper G2 elliptic curve point addition for public key aggregation.
 */
contract BLSVerifier {
    // Domain separation tag matching the Go implementation
    bytes private constant DOMAIN =
        abi.encodePacked(keccak256(bytes("DOMAIN_APEX_BRIDGE_EVM")));

    // BN254 base field modulus
    uint256 private constant N =
        21888242871839275222246405745257275088696311157297823662689037894645226208583;

    /**
     * @notice Verifies BLS signature using pairing check
     * @param _hash The hash of the message being signed
     * @param _signature The BLS signature (64 bytes representing G1 point)
     * @param _bitmap Bitmap representing which validators participated
     * @param _publicKeys Array of validator public keys (G2 points)
     * @return True if signature is valid
     */
    function verifyBLSSignature(
        bytes32 _hash,
        bytes calldata _signature,
        uint256 _bitmap,
        IGatewayStructs.ValidatorChainData[] calldata _publicKeys
    ) external view returns (bool) {
        if (_signature.length != 64) {
            return false;
        }

        if (_publicKeys.length == 0) {
            return false;
        }

        if (_bitmap == 0) {
            return false;
        }

        // Parse signature as G1 point (2 uint256 values)
        uint256[2] memory signature;
        signature[0] = uint256(bytes32(_signature[0:32]));
        signature[1] = uint256(bytes32(_signature[32:64]));

        // Hash the message to a point on G1
        uint256[2] memory messagePoint = BLS.hashToPoint(
            DOMAIN,
            abi.encodePacked(_hash)
        );

        // Aggregate public keys using proper EC point addition on G2
        // First loop: find the first participating key
        uint256 i = 0;
        for (; i < _publicKeys.length; i++) {
            if ((_bitmap & (1 << i)) != 0) {
                break;
            }
        }

        uint256[4] memory aggregatedPubKey = _publicKeys[i].key;

        // Second loop: aggregate remaining participating keys
        for (i = i + 1; i < _publicKeys.length; i++) {
            if ((_bitmap & (1 << i)) == 0) {
                continue;
            }
            aggregatedPubKey = _addG2Points(
                aggregatedPubKey,
                _publicKeys[i].key
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
     * @notice Adds two G2 points using proper elliptic curve addition over Fp2
     * @dev G2 points on BN254 twist: y² = x³ + b' over Fp2 = Fp[u]/(u² + 1)
     *      Point format: [x0, x1, y0, y1] where x = x0 + x1*u, y = y0 + y1*u
     *      [0, 0, 0, 0] represents the point at infinity (identity element)
     * @param p First G2 point
     * @param q Second G2 point
     * @return r The sum P + Q on the G2 curve
     */
    function _addG2Points(
        uint256[4] memory p,
        uint256[4] memory q
    ) internal view returns (uint256[4] memory r) {
        // Check for point at infinity (identity)
        if (p[0] == 0 && p[1] == 0 && p[2] == 0 && p[3] == 0) return q;
        if (q[0] == 0 && q[1] == 0 && q[2] == 0 && q[3] == 0) return p;

        // Check if x coordinates are equal (px == qx in Fp2)
        if (p[0] == q[0] && p[1] == q[1]) {
            if (p[2] == q[2] && p[3] == q[3]) {
                // Same point: perform doubling (P + P = 2P)
                if (p[2] == 0 && p[3] == 0) {
                    return r; // y = 0 => point at infinity
                }
                return _doubleG2Point(p);
            } else {
                // P + (-P) = point at infinity
                return r; // [0, 0, 0, 0]
            }
        }

        // General case: different x coordinates
        // a = dy = qy - py, b = dx = qx - px
        (uint256 a0, uint256 a1) = _fp2Sub(q[2], q[3], p[2], p[3]);
        (uint256 b0, uint256 b1) = _fp2Sub(q[0], q[1], p[0], p[1]);
        // lambda = dy / dx
        (b0, b1) = _fp2Inv(b0, b1);
        (a0, a1) = _fp2Mul(a0, a1, b0, b1);

        // rx = lambda^2 - px - qx
        (b0, b1) = _fp2Mul(a0, a1, a0, a1);
        (b0, b1) = _fp2Sub(b0, b1, p[0], p[1]);
        (b0, b1) = _fp2Sub(b0, b1, q[0], q[1]);

        // ry = lambda * (px - rx) - py
        (uint256 c0, uint256 c1) = _fp2Sub(p[0], p[1], b0, b1);
        (c0, c1) = _fp2Mul(a0, a1, c0, c1);
        (c0, c1) = _fp2Sub(c0, c1, p[2], p[3]);

        r[0] = b0;
        r[1] = b1;
        r[2] = c0;
        r[3] = c1;
    }

    /**
     * @notice Doubles a G2 point using EC doubling formula over Fp2
     * @param p G2 point to double
     * @return r The point 2P
     */
    function _doubleG2Point(
        uint256[4] memory p
    ) internal view returns (uint256[4] memory r) {
        // lambda = 3 * px^2 / (2 * py) in Fp2  (a = 0 for BN254)
        // a = px^2
        (uint256 a0, uint256 a1) = _fp2Mul(p[0], p[1], p[0], p[1]);
        // b = 2 * px^2, then a = 3 * px^2
        (uint256 b0, uint256 b1) = _fp2Add(a0, a1, a0, a1);
        (a0, a1) = _fp2Add(b0, b1, a0, a1);
        // b = 2 * py, then b = (2*py)^{-1}, then a = lambda
        (b0, b1) = _fp2Add(p[2], p[3], p[2], p[3]);
        (b0, b1) = _fp2Inv(b0, b1);
        (a0, a1) = _fp2Mul(a0, a1, b0, b1);

        // rx = lambda^2 - 2*px
        (b0, b1) = _fp2Mul(a0, a1, a0, a1);
        (b0, b1) = _fp2Sub(b0, b1, p[0], p[1]);
        (b0, b1) = _fp2Sub(b0, b1, p[0], p[1]);

        // ry = lambda * (px - rx) - py
        (uint256 c0, uint256 c1) = _fp2Sub(p[0], p[1], b0, b1);
        (c0, c1) = _fp2Mul(a0, a1, c0, c1);
        (c0, c1) = _fp2Sub(c0, c1, p[2], p[3]);

        r[0] = b0;
        r[1] = b1;
        r[2] = c0;
        r[3] = c1;
    }

    // ==================== Fp2 Arithmetic ====================
    // Fp2 = Fp[u] / (u² + 1), elements as (c0, c1) representing c0 + c1*u

    function _fp2Add(
        uint256 a0,
        uint256 a1,
        uint256 b0,
        uint256 b1
    ) internal pure returns (uint256 c0, uint256 c1) {
        c0 = addmod(a0, b0, N);
        c1 = addmod(a1, b1, N);
    }

    function _fp2Sub(
        uint256 a0,
        uint256 a1,
        uint256 b0,
        uint256 b1
    ) internal pure returns (uint256 c0, uint256 c1) {
        c0 = addmod(a0, N - b0, N);
        c1 = addmod(a1, N - b1, N);
    }

    function _fp2Mul(
        uint256 a0,
        uint256 a1,
        uint256 b0,
        uint256 b1
    ) internal pure returns (uint256 c0, uint256 c1) {
        // (a0 + a1*u)(b0 + b1*u) = (a0*b0 - a1*b1) + (a0*b1 + a1*b0)*u
        uint256 t1 = mulmod(a0, b0, N);
        uint256 t2 = mulmod(a1, b1, N);
        c0 = addmod(t1, N - t2, N);
        uint256 t3 = mulmod(a0, b1, N);
        uint256 t4 = mulmod(a1, b0, N);
        c1 = addmod(t3, t4, N);
    }

    function _fp2Inv(
        uint256 a0,
        uint256 a1
    ) internal view returns (uint256 c0, uint256 c1) {
        // (a0 + a1*u)^{-1} = (a0 - a1*u) / (a0² + a1²)
        uint256 t0 = mulmod(a0, a0, N);
        uint256 t1 = mulmod(a1, a1, N);
        uint256 t2 = addmod(t0, t1, N);
        uint256 t2Inv = _modInverse(t2);
        c0 = mulmod(a0, t2Inv, N);
        c1 = mulmod(N - a1, t2Inv, N);
    }

    /**
     * @notice Computes modular inverse via Fermat's little theorem using modexp precompile
     * @param a The value to invert (must be non-zero)
     * @return result a^(N-2) mod N
     */
    function _modInverse(uint256 a) internal view returns (uint256 result) {
        uint256 n = N;
        uint256 exponent = N - 2;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x20) // base length = 32 bytes
            mstore(add(ptr, 0x20), 0x20) // exponent length = 32 bytes
            mstore(add(ptr, 0x40), 0x20) // modulus length = 32 bytes
            mstore(add(ptr, 0x60), a) // base
            mstore(add(ptr, 0x80), exponent) // exponent
            mstore(add(ptr, 0xa0), n) // modulus
            if iszero(staticcall(gas(), 5, ptr, 0xc0, ptr, 0x20)) {
                revert(0, 0)
            }
            result := mload(ptr)
        }
    }
}
