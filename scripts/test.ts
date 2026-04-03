import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("BLS Signature Verification Test\n");

  // Load deployment info
  const fs = require("fs");
  const deploymentInfo = JSON.parse(
    fs.readFileSync("deployment-amoy.json", "utf8")
  );
  const validatorsAddress = deploymentInfo.validators;

  // Get contract instance
  const Validators = await ethers.getContractFactory("Validators");
  const validators = Validators.attach(validatorsAddress) as any;

  // Test data
  const message = "b80f0dd569a839bcbbb34ef7d41c4ff993387a166ab3959c6d997a1a12cbbe70";
  const messageHash = "0x" + message;

  const publicKeys = [
    [
      "0x0fc289005343fbdb26c805a84c1f7d57920020f6505dc105af57c80d1e13c7c1",
      "0x20b93abd15b5c10e681a8b95b3620c16f8b2bd1b5e01c1a2fdd1fb772733c4ef",
      "0x1aaf664c7f5e6d6ef3f863b5bb57dffa5e754bc74fb2be9278eef97b751a2b39",
      "0x2bd8eeaea1a56b722a7a67260ddea04df63406ff281bcbbc3b2c9d2f3d6a5b54",
    ],
    [
      "0x14b7b342b3f8257527fced4658e85adfa5095579f551d4b38545443ad0214a01",
      "0x03f8144b965000021f2ada1b2c9970c6f1fc58530f092c8cd7cc12c97ccf04f6",
      "0x2b38edd5c9b817ac6f17d6800955b7d6b0d0f70917d19323675d41ba8782f105",
      "0x17f75adaa96722211fb7e2c920c2308498aedf2d1db673f8250af1de7cb73e26",
    ],
    [
      "0x1b7071d533e03e8318892a6a0095996f0adaa0dc40bdda5a942d84f0e1929a00",
      "0x27ee1824cc2d39346d068b1085be0b63f4d5a304c337e20f56081abd5f8b77ca",
      "0x304afe7dc2a585469a982db0a784f5be0a25894e6178ee4688acf41c079c1691",
      "0x30154b6d0990ade770bb150d0542a74c615d24436306f2f19f3868dc1cf20164",
    ],
    [
      "0x0f37016bba0d6412dd471e85d7c1991b947ebe8ffd05915186952fc30bf38875",
      "0x119c02240ca186dcc5177b91d188549b7ce957612cbdad007fb3e474ec3409a7",
      "0x14b61c74cb2dfe6b4cf32a5193bba5b56b8cf85050cfc9edd52be0b72070e27b",
      "0x1dbbbe29f93263651d6c5211a844edee141b84acef50d9eeed7fff2d547c6b37",
    ],
  ];

  const signature =
    "0x19addf7e72419ab4d67c663e62c1cd64428f57e2c510197405449eb49ba70e10" +
    "0c0893d7884bfbae9ff66253e00eb93d85525b05c49b3a80c4191c33e41f4dd0";

  const bitmap = 15; // All 4 validators

  console.log("Test Data:");
  console.log("Message:", messageHash);
  console.log("Signature:", signature);
  console.log("Bitmap:", bitmap, "(all 4 validators)\n");

  // Set validators
  console.log("Setting validator public keys...");
  const [signer] = await ethers.getSigners();

  try {
    const setTx = await validators.connect(signer).setValidatorsChainData(
      publicKeys.map(key => ({ key }))
    );
    await setTx.wait();
    console.log("✅ Validator keys set\n");
  } catch (error: any) {
    console.log("❌ Failed to set validator keys:", error.message);
    process.exitCode = 1;
    return;
  }

  // Verify signature
  console.log("Verifying BLS signature...");
  try {
    const result = await validators.isBlsSignatureValid(
      messageHash,
      signature,
      bitmap
    );

    console.log("Result:", result);

    if (result) {
      console.log("\n✅ BLS SIGNATURE VERIFICATION PASSED!");
    } else {
      console.log("\n❌ BLS SIGNATURE VERIFICATION FAILED");
    }
  } catch (error: any) {
    console.log("❌ Error during verification:", error.message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
