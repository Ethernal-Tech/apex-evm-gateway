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
  const message = "5d8448ae76011d2a8b220a489011c45f4099ad68ad7cbe166ce25e78c1a4e2d4";
  const messageHash = "0x" + message;

  const publicKeys = [
    [
      "0x20878845e9d2c8c9a98436405c924f2a7ab88399d3c782f2bb4097187ca31d08",
      "0x28e16cb932483b6011e40cc917b92249a4b221f0687335f3ab79c1817e41ed44",
      "0x15939bc934a2d117169bc72f8c830fd30f290dab52f52a3028396a43c0088ad2",
      "0x2f0425ae39391787aefd0b5e5f5ddfdd7ebcf93082fd67e91248001508fd3105",
    ],
    [
      "0x26182376f61d788cc29cbe505585fba0c2a9a9017232623856a1f1074f2b99bd",
      "0x126ac70e60f3facfc31b21f174714f603c7f836bf23e2ccf34b0a09f8551fba9",
      "0x018418fc12c53cac8e161765f9b8a31ed1d33e447ac38eb02fc095f5bf98ceaf",
      "0x067c6d6b2fb61270e5172c79536f18bffbc53e80c490a576d300d770a373cf15",
    ],
    [
      "0x1399dc20f064616fa5971623b6e5c8fbf513f8062d08a57dc1e38594ddc6045f",
      "0x0830d0fe625767a676db2fd1dc999b9fc5c95f4ec3780411ec4af920bbddda5a",
      "0x173cc5a871fe411598ae943dd8179902751d14c71bb128803a1c7eec0a5d398b",
      "0x27b37937dac139096737d10d9d1db1b2f640c354f0c290bb4f3f7e9418f9c9ab",
    ],
    [
      "0x092a66d45e973a0478c113e58c9961b98d888b78fc269c424a024324bb3283a4",
      "0x0cbfd8285f10f18274e653e45585fb2b1cce4ae28711359267999c78f21a6b03",
      "0x01642c5d9ffb0bc0baf9327e030e9ebc703be3b4dad0c00dce2601cc96069d7d",
      "0x1e8a70a94cb27039f711b1fc0addddfaa36d879ac947d6180098cca89df303d7",
    ],
  ];

  const signature =
    "0x033227931565164e68a263dd7bf68fab3ba55d9a63598678b546cff4c07a8e60" +
    "10052c962fa3a0d479d05ce694dabcf7a7060a2cf0682cb03acb61390a08e6a0";

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
