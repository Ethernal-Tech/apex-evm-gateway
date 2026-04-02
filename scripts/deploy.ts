import hre from "hardhat";
const { ethers, upgrades } = hre;

async function main() {
  console.log("Deploying Validators contract to Polygon Amoy...\n");

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Deploying with account:", signer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");

  // Deploy Validators as UUPS proxy
  const Validators = await ethers.getContractFactory("Validators", signer);
  console.log("Deploying Validators proxy...");
  const validators = await upgrades.deployProxy(Validators, [], {
    kind: "uups",
  });
  await validators.waitForDeployment();
  const validatorsAddress = await validators.getAddress();
  console.log("✅ Validators proxy deployed to:", validatorsAddress);

  // Note: setDependencies is skipped during deployment
  // It requires a contract address as gateway, not an EOA
  // You can call it later with the actual Gateway contract address
  console.log(
    "\nℹ️  Gateway dependency NOT set (requires a contract address)"
  );
  console.log(
    "Call setDependencies(gatewayAddress) manually with the Gateway contract address"
  );

  console.log("\n✅ Deployment complete!");
  console.log("Validators address:", validatorsAddress);

  // Save addresses to a file
  const fs = require("fs");
  const deploymentInfo = {
    validators: validatorsAddress,
    network: "amoy",
    deployer: signer.address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    "deployment-amoy.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment-amoy.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
