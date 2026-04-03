// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {BLS} from "@kevincharm/bls-bn254/contracts/BLS.sol";
import {IGatewayStructs} from "./interfaces/IGatewayStructs.sol";

/**
 * @title BLSVerifier
 * @notice Implements BLS signature verification for BN254 curve (Barreto-Naehrig curve).
 * @dev Uses BLS library for pairing check only (precompile 0x08).
 *      Custom hashToPoint uses SHA-256 (precompile 0x02) via expand_message_xmd to match
 *      the Go implementation (crypto/sha256 + Fouque-Tibouchi map-to-curve).
 *      Performs proper G2 elliptic curve point addition for public key aggregation.
 */
contract BLSVerifier {
    // Domain separation tag matching the Go implementation
    bytes private constant DOMAIN = bytes("ExpectedDomain");

    // BN254 base field modulus p
    uint256 private constant N =
        21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Go's modulus used for field reduction after expand_message_xmd (= r, the curve order)
    // 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
    uint256 private constant MODULUS =
        0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47;

    // 2^256 mod MODULUS — used to reduce 48-byte field elements in two 256-bit chunks
    uint256 private constant R2 =
        0xe0a77c19a07df2f666ea36f7879462c0a78eb28f5c70b3dd35d438dc58f0d9d;

    // Fouque-Tibouchi constants matching Go's z0 and z1
    // z0 = sqrt(-3) mod p
    uint256 private constant FT_Z0 =
        0x0000000000000000b3c4d79d41a91759a9e4c7e359b6b89eaec68e62effffffd;
    // z1 = (sqrt(-3) - 1) / 2 mod p
    uint256 private constant FT_Z1 =
        0x000000000000000059e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffe;

    // (N + 1) / 4 — exponent for square root since N ≡ 3 (mod 4)
    uint256 private constant SQRT_EXP =
        0xc19139cb84c680a6e14116da060561765e05aa45a1c72a34f082305b61f3f52;

    // (N - 1) / 2 — exponent for Legendre symbol
    uint256 private constant LEGENDRE_EXP =
        0x183227397098d014dc2822db40c0ac2ecbc0b548b438e5469e10460b6c3e7ea3;

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

        // Hash the message to a G1 point using SHA-256 based expand_message_xmd
        // and Fouque-Tibouchi map-to-curve — matching the Go implementation exactly
        uint256[2] memory messagePoint = _hashToPoint(abi.encodePacked(_hash));

        // Aggregate public keys using proper EC point addition on G2
        // First: find the first participating key
        uint256 i = 0;
        for (; i < _publicKeys.length; i++) {
            if ((_bitmap & (1 << i)) != 0) {
                break;
            }
        }

        uint256[4] memory aggregatedPubKey = _publicKeys[i].key;

        // Aggregate remaining participating keys
        for (i = i + 1; i < _publicKeys.length; i++) {
            if ((_bitmap & (1 << i)) == 0) {
                continue;
            }
            aggregatedPubKey = _addG2Points(aggregatedPubKey, _publicKeys[i].key);
        }

        // Verify the pairing: e(signature, -G2) * e(messagePoint, aggregatedPubKey) == 1
        (bool pairingValid, bool callSuccess) = BLS.verifySingle(
            signature,
            aggregatedPubKey,
            messagePoint
        );

        return callSuccess && pairingValid;
    }

    // ==================== Hash To Point ====================

    /**
     * @notice Maps an arbitrary message to a G1 point on BN254
     * @dev Mirrors Go's hashToPoint: expand_message_xmd(SHA-256) + Fouque-Tibouchi
     * @param message The message bytes to hash
     * @return A G1 point
     */
    function _hashToPoint(bytes memory message) internal view returns (uint256[2] memory) {
        (uint256 u0, uint256 u1) = _hashToField(message);
        uint256[2] memory p0 = _mapToPoint(u0);
        uint256[2] memory p1 = _mapToPoint(u1);

        // G1 addition via precompile 0x06
        uint256[4] memory bnAddInput;
        bnAddInput[0] = p0[0];
        bnAddInput[1] = p0[1];
        bnAddInput[2] = p1[0];
        bnAddInput[3] = p1[1];
        bool success;
        assembly {
            success := staticcall(gas(), 6, bnAddInput, 128, p0, 64)
        }
        require(success, "BLSVerifier: G1 addition failed");
        return p0;
    }

    /**
     * @notice Hashes message to two field elements, mirroring Go's hashToFpXMDSHA256
     * @dev Produces 96 bytes via expand_message_xmd(SHA-256), splits into two 48-byte
     *      chunks, reduces each mod MODULUS
     */
    function _hashToField(
        bytes memory message
    ) internal view returns (uint256 u0, uint256 u1) {
        bytes memory pseudo = _expandMsgSHA256XMD(message, DOMAIN, 96);
        u0 = _reduce48(pseudo, 0);
        u1 = _reduce48(pseudo, 48);
    }

    /**
     * @notice Reduces a 48-byte big-endian integer (at offset in buf) modulo MODULUS
     * @dev 48 bytes = 16-byte hi || 32-byte lo
     *      value = hi * 2^256 + lo
     *      value mod MODULUS = (hi * R2 + lo) mod MODULUS  where R2 = 2^256 mod MODULUS
     */
    function _reduce48(
        bytes memory buf,
        uint256 offset
    ) internal pure returns (uint256 result) {
        // Read the high 16 bytes (shifted to sit in the low 16 bytes of a uint256)
        uint256 hi;
        uint256 lo;
        assembly {
            // buf data starts at buf+32; add offset
            let ptr := add(add(buf, 32), offset)
            // hi: first 16 bytes of the 48-byte window — load 32 bytes, take the top 16
            // i.e. shift right by 128 bits
            hi := shr(128, mload(ptr))
            // lo: last 32 bytes of the 48-byte window
            lo := mload(add(ptr, 16))
        }
        // value mod MODULUS = (hi * R2 + lo) mod MODULUS
        // Both hi and lo fit in uint256; use addmod/mulmod
        uint256 hiContrib = mulmod(hi, R2, MODULUS);
        result = addmod(hiContrib, lo % MODULUS, MODULUS);
    }

    /**
     * @notice expand_message_xmd using SHA-256 (precompile 0x02), outLen = 96
     * @dev Exact translation of Go's expandMsgSHA256XMD.
     *      SHA-256 block size = 64 bytes, output size = 32 bytes, ell = 3
     *      out = b1 || b2 || b3
     *
     *      b0 = SHA256(zeros(64) || msg || 0x00 || 0x60 || 0x00 || DST || len(DST))
     *      b1 = SHA256(b0 || 0x01 || DST || len(DST))
     *      b2 = SHA256((b0 XOR b1) || 0x02 || DST || len(DST))
     *      b3 = SHA256((b0 XOR b2) || 0x03 || DST || len(DST))
     */
    function _expandMsgSHA256XMD(
        bytes memory message,
        bytes memory dst,
        uint256 outLen
    ) internal view returns (bytes memory out) {
        require(dst.length <= 255, "BLSVerifier: DST too long");
        require(outLen == 96, "BLSVerifier: only outLen=96 supported");

        uint8 dstLen = uint8(dst.length);

        // b0 = SHA256(zeros(64) || msg || uint16(96) || 0x00 || DST || uint8(len(DST)))
        bytes32 b0 = _sha256(abi.encodePacked(new bytes(64), message, uint8(0), uint8(96), uint8(0), dst, dstLen));

        // b1 = SHA256(b0 || 0x01 || DST || uint8(len(DST)))
        bytes32 b1 = _sha256(abi.encodePacked(b0, uint8(1), dst, dstLen));

        // b2 = SHA256((b0 XOR b1) || 0x02 || DST || uint8(len(DST)))
        bytes32 b2 = _sha256(abi.encodePacked(b0 ^ b1, uint8(2), dst, dstLen));

        // b3 = SHA256((b0 XOR b2) || 0x03 || DST || uint8(len(DST)))
        bytes32 b3 = _sha256(abi.encodePacked(b0 ^ b2, uint8(3), dst, dstLen));

        // out = b1 || b2 || b3 (96 bytes)
        out = abi.encodePacked(b1, b2, b3);
    }

    /**
     * @notice SHA-256 via precompile 0x02
     * @dev Output is written to scratch space at 0x00 and loaded back into result.
     *      Cannot use `result` directly as the output pointer because it is a stack
     *      value-type variable, not a memory address.
     */
    function _sha256(bytes memory data) internal view returns (bytes32 result) {
        assembly {
            if iszero(staticcall(gas(), 2, add(data, 32), mload(data), 0x00, 0x20)) {
                revert(0, 0)
            }
            result := mload(0x00)
        }
    }

    /**
     * @notice Maps a field element to a G1 point using Fouque-Tibouchi algorithm
     * @dev Exact translation of Go's mapToPoint in arithmetic.go
     *      Uses the same constants z0, z1 and the same three-candidate approach
     */
    function _mapToPoint(uint256 x) internal view returns (uint256[2] memory p) {
        // decision = isQR(x): true if x is a quadratic residue mod N
        bool decision = _isQR(x);

        // a0 = x^2 + 4
        uint256 a0 = addmod(mulmod(x, x, N), 4, N);
        // a1 = x * Z0
        uint256 a1 = mulmod(x, FT_Z0, N);
        // a2 = inverse(a1 * a0)
        uint256 a2 = _modInverse(mulmod(a1, a0, N));
        // a1 = a1^2 * a2
        a1 = mulmod(mulmod(a1, a1, N), a2, N);
        // a1 = x * a1
        a1 = mulmod(x, a1, N);

        // x1 = Z1 - a1
        uint256 x1 = addmod(FT_Z1, N - a1, N);
        // try x1: check if g(x1) = x1^3 + 3 is a QR
        uint256 gx1 = addmod(mulmod(mulmod(x1, x1, N), x1, N), 3, N);
        (uint256 y, bool found) = _sqrt(gx1);
        if (found) {
            p[0] = x1;
            p[1] = decision ? y : (N - y);
            return p;
        }

        // x2 = N - (x1 + 1)
        uint256 x2 = N - addmod(x1, 1, N);
        // try x2: check if g(x2) = x2^3 + 3 is a QR
        uint256 gx2 = addmod(mulmod(mulmod(x2, x2, N), x2, N), 3, N);
        (y, found) = _sqrt(gx2);
        if (found) {
            p[0] = x2;
            p[1] = decision ? y : (N - y);
            return p;
        }

        // x3 = a0^4 * a2^2 + 1
        uint256 a0sq = mulmod(a0, a0, N);
        uint256 x3 = addmod(mulmod(mulmod(a0sq, a0sq, N), mulmod(a2, a2, N), N), 1, N);
        // g(x3) must be a QR
        uint256 gx3 = addmod(mulmod(mulmod(x3, x3, N), x3, N), 3, N);
        (y, found) = _sqrt(gx3);
        require(found, "BLSVerifier: mapToPoint x3 not on curve");
        p[0] = x3;
        p[1] = decision ? y : (N - y);
    }

    /**
     * @notice Returns true if x is a quadratic residue mod N (Legendre symbol == 1)
     * @dev Legendre(x) = x^((N-1)/2) mod N; result == 1 means QR
     */
    function _isQR(uint256 x) internal view returns (bool) {
        uint256 result = _modExp(x, LEGENDRE_EXP, N);
        return result == 1;
    }

    /**
     * @notice Computes modular square root via x^((N+1)/4) mod N (since N ≡ 3 mod 4)
     * @return root The square root (if it exists)
     * @return found True if x is a perfect square mod N
     */
    function _sqrt(uint256 x) internal view returns (uint256 root, bool found) {
        root = _modExp(x, SQRT_EXP, N);
        found = mulmod(root, root, N) == x;
    }

    /**
     * @notice Computes modular inverse via Fermat's little theorem: a^(N-2) mod N
     */
    function _modInverse(uint256 a) internal view returns (uint256 result) {
        result = _modExp(a, N - 2, N);
    }

    /**
     * @notice Modular exponentiation via precompile 0x05
     */
    function _modExp(
        uint256 base,
        uint256 exponent,
        uint256 modulus
    ) internal view returns (uint256 result) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x20)
            mstore(add(ptr, 0x20), 0x20)
            mstore(add(ptr, 0x40), 0x20)
            mstore(add(ptr, 0x60), base)
            mstore(add(ptr, 0x80), exponent)
            mstore(add(ptr, 0xa0), modulus)
            if iszero(staticcall(gas(), 5, ptr, 0xc0, ptr, 0x20)) {
                revert(0, 0)
            }
            result := mload(ptr)
        }
    }

    // ==================== G2 Point Aggregation ====================

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
                // Same point: perform doubling
                if (p[2] == 0 && p[3] == 0) {
                    return r; // y = 0 => point at infinity
                }
                return _doubleG2Point(p);
            } else {
                // P + (-P) = point at infinity
                return r;
            }
        }

        // General case: lambda = (qy - py) / (qx - px)
        (uint256 a0, uint256 a1) = _fp2Sub(q[2], q[3], p[2], p[3]);
        (uint256 b0, uint256 b1) = _fp2Sub(q[0], q[1], p[0], p[1]);
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
     */
    function _doubleG2Point(
        uint256[4] memory p
    ) internal view returns (uint256[4] memory r) {
        // lambda = 3 * px^2 / (2 * py) in Fp2  (a = 0 for BN254)
        (uint256 a0, uint256 a1) = _fp2Mul(p[0], p[1], p[0], p[1]);
        (uint256 b0, uint256 b1) = _fp2Add(a0, a1, a0, a1);
        (a0, a1) = _fp2Add(b0, b1, a0, a1);
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

    function _fp2Add(
        uint256 a0, uint256 a1, uint256 b0, uint256 b1
    ) internal pure returns (uint256 c0, uint256 c1) {
        c0 = addmod(a0, b0, N);
        c1 = addmod(a1, b1, N);
    }

    function _fp2Sub(
        uint256 a0, uint256 a1, uint256 b0, uint256 b1
    ) internal pure returns (uint256 c0, uint256 c1) {
        c0 = addmod(a0, N - b0, N);
        c1 = addmod(a1, N - b1, N);
    }

    function _fp2Mul(
        uint256 a0, uint256 a1, uint256 b0, uint256 b1
    ) internal pure returns (uint256 c0, uint256 c1) {
        // (a0 + a1*u)(b0 + b1*u) = (a0*b0 - a1*b1) + (a0*b1 + a1*b0)*u
        uint256 t1 = mulmod(a0, b0, N);
        uint256 t2 = mulmod(a1, b1, N);
        c0 = addmod(t1, N - t2, N);
        c1 = addmod(mulmod(a0, b1, N), mulmod(a1, b0, N), N);
    }

    function _fp2Inv(
        uint256 a0, uint256 a1
    ) internal view returns (uint256 c0, uint256 c1) {
        // (a0 + a1*u)^{-1} = (a0 - a1*u) / (a0² + a1²)
        uint256 t2Inv = _modInverse(addmod(mulmod(a0, a0, N), mulmod(a1, a1, N), N));
        c0 = mulmod(a0, t2Inv, N);
        c1 = mulmod(N - a1, t2Inv, N);
    }
}
