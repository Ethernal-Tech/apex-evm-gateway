const { ethers, JsonRpcProvider } = require("ethers");
const { expect } = require("chai");
const config = require("./config.json");
const gatewayJson = require("../artifacts/contracts/Gateway.sol/Gateway.json");
const gatewayV2Json = require("../artifacts/contracts/GatewayV2.sol/GatewayV2.json");
const nativeTokenPredicateJson = require("../artifacts/contracts/NativeTokenPredicate.sol/NativeTokenPredicate.json");
const nativeTokenPredicateV2Json = require("../artifacts/contracts/NativeTokenPredicateV2.sol/NativeTokenPredicateV2.json");
const nativeTokenWalletJson = require("../artifacts/contracts/NativeTokenWallet.sol/NativeTokenWallet.json");
const nativeTokenWalletV2Json = require("../artifacts/contracts/NativeTokenWalletV2.sol/NativeTokenWalletV2.json");
const validatorsJson = require("../artifacts/contracts/Validators.sol/Validators.json");
const validatorsV2Json = require("../artifacts/contracts/ValidatorsV2.sol/ValidatorsV2.json");
const ERC1967ProxyJson = require("../artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json");

async function main() {
  if (process.argv.slice(2).length < 2) {
    console.log("Please provide 2 arguments: RPC_URL, PRIVATE_KEY");
    process.exit(1);
  }

  const RPC_URL = process.argv[2];
  const PRIVATE_KEY = process.argv[3];

  const provider = new JsonRpcProvider(RPC_URL);
  const owner = new ethers.Wallet(PRIVATE_KEY, provider);
  const ownerAddress = await owner.getAddress();

  console.log("--- Deploying the Logic Contracts");
  const gatewayFactory = new ethers.ContractFactory(gatewayJson.abi, gatewayJson.bytecode, owner);
  const gatewayLogic = await gatewayFactory.deploy();
  await gatewayLogic.waitForDeployment();
  console.log("Gateway logic", gatewayLogic.target);

  const nativeTokenPredicateFactory = new ethers.ContractFactory(
    nativeTokenPredicateJson.abi,
    nativeTokenPredicateJson.bytecode,
    owner
  );
  const nativeTokenPredicateLogic = await nativeTokenPredicateFactory.deploy();
  await nativeTokenPredicateLogic.waitForDeployment();
  console.log("NativeTokenPredicate logic", nativeTokenPredicateLogic.target);

  const nativeTokenWalletFactory = new ethers.ContractFactory(
    nativeTokenWalletJson.abi,
    nativeTokenWalletJson.bytecode,
    owner
  );
  const nativeTokenWalletLogic = await nativeTokenWalletFactory.deploy();
  await nativeTokenWalletLogic.waitForDeployment();
  console.log("NativeTokenWallet logic", nativeTokenWalletLogic.target);

  const validatorsFactory = new ethers.ContractFactory(validatorsJson.abi, validatorsJson.bytecode, owner);
  const validatorsLogic = await validatorsFactory.deploy();
  await validatorsLogic.waitForDeployment();
  console.log("Validators logic", validatorsLogic.target);

  console.log("--- Deploying the Proxy Contracts");
  const initDataGateway = gatewayLogic.interface.encodeFunctionData("initialize", [1, 1]);
  const ProxyFactory = new ethers.ContractFactory(ERC1967ProxyJson.abi, ERC1967ProxyJson.bytecode, owner);
  const gatewayProxyContract = await ProxyFactory.deploy(gatewayLogic.target, initDataGateway);
  await gatewayProxyContract.waitForDeployment();

  console.log(`Gateway Proxy contract deployed at: ${gatewayProxyContract.target}`);

  const initEmpty = nativeTokenPredicateLogic.interface.encodeFunctionData("initialize", []);

  const nativeTokenPredicateProxyContract = await ProxyFactory.deploy(nativeTokenPredicateLogic.target, initEmpty);
  await nativeTokenPredicateProxyContract.waitForDeployment();

  console.log(`NativeTokenPredicate Proxy contract deployed at: ${nativeTokenPredicateProxyContract.target}`);

  const nativeTokenWalletProxyContract = await ProxyFactory.deploy(nativeTokenWalletLogic.target, initEmpty);
  await nativeTokenWalletProxyContract.waitForDeployment();

  console.log(`NativeTokenWallet Proxy contract deployed at: ${nativeTokenWalletProxyContract.target}`);

  const validatorsProxyContract = await ProxyFactory.deploy(validatorsLogic.target, initEmpty);
  await validatorsProxyContract.waitForDeployment();

  console.log(`Validators Proxy contract deployed at: ${validatorsProxyContract.target}`);

  console.log("--- Upgrading smart contracts");

  // Gateway
  const proxyGateway = new ethers.Contract(gatewayProxyContract.target, nativeTokenPredicateJson.abi, owner);
  const proxyNativeTokenPredicate = new ethers.Contract(
    nativeTokenPredicateProxyContract.target,
    nativeTokenPredicateJson.abi,
    owner
  );
  const proxyNativeTokenWallet = new ethers.Contract(
    nativeTokenWalletProxyContract.target,
    nativeTokenWalletJson.abi,
    owner
  );
  const proxyValidators = new ethers.Contract(validatorsProxyContract.target, validatorsJson.abi, owner);

  let versionBefore = await proxyGateway.version();
  console.log("Gateway version before upgrade", versionBefore);
  expect(versionBefore).to.equal("1.0.0");
  let implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  let storage = await provider.getStorage(proxyGateway, implSlot);
  let implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Gateway implementation address before:", implementationAddress);

  const gatewayV2Factory = new ethers.ContractFactory(gatewayV2Json.abi, gatewayV2Json.bytecode, owner);
  const gatewayV2Logic = await gatewayV2Factory.deploy();
  await gatewayV2Logic.waitForDeployment();
  console.log("Gateway V2 logic", gatewayV2Logic.target);

  let newImplementationAddress = await gatewayV2Logic.getAddress();
  let upgradeTx = await proxyGateway.connect(owner).upgradeToAndCall(newImplementationAddress, "0x");
  await upgradeTx.wait();

  const proxyGatewayV2 = new ethers.Contract(gatewayProxyContract.target, gatewayV2Json.abi, owner);
  let versionAfter = await proxyGatewayV2.version();
  console.log("Gateway version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyGatewayV2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Gateway implementation address after", implementationAddress);
  expect(versionAfter).to.equal("1.0.1");
  let increaseTestValue = await proxyGatewayV2.increaseTestValue();
  await increaseTestValue.wait();
  expect(await proxyGatewayV2.testValue()).to.equal(1n);

  // NativeTokenPredicate
  versionBefore = await proxyNativeTokenPredicate.version();
  console.log("NativeTokenPredicate version before upgrade", versionBefore);
  expect(versionBefore).to.equal("1.0.0");
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyNativeTokenPredicate, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("NativeTokenPredicate implementation address before:", implementationAddress);

  const nativeTokenPredicateV2Factory = new ethers.ContractFactory(
    nativeTokenPredicateV2Json.abi,
    nativeTokenPredicateV2Json.bytecode,
    owner
  );
  const nativeTokenPredicateV2Logic = await nativeTokenPredicateV2Factory.deploy();
  await nativeTokenPredicateV2Logic.waitForDeployment();
  console.log("NativeTokenPredicate V2 logic", nativeTokenPredicateV2Logic.target);

  newImplementationAddress = await nativeTokenPredicateV2Logic.getAddress();
  upgradeTx = await proxyNativeTokenPredicate.connect(owner).upgradeToAndCall(newImplementationAddress, "0x");
  await upgradeTx.wait();

  const proxyNativeTokenPredicateV2 = new ethers.Contract(
    nativeTokenPredicateProxyContract.target,
    nativeTokenPredicateV2Json.abi,
    owner
  );
  versionAfter = await proxyNativeTokenPredicateV2.version();
  console.log("NativeTokenPredicate version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyNativeTokenPredicateV2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("NativeTokenPredicate implementation address after", implementationAddress);
  expect(versionAfter).to.equal("1.0.1");
  increaseTestValue = await proxyNativeTokenPredicateV2.increaseTestValue();
  await increaseTestValue.wait();
  expect(await proxyNativeTokenPredicateV2.testValue()).to.equal(1n);

  // NativeTokenWallet
  versionBefore = await proxyNativeTokenWallet.version();
  console.log("NativeTokenWallet version before upgrade", versionBefore);
  expect(versionBefore).to.equal("1.0.0");
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyNativeTokenWallet, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("NativeTokenWallet implementation address before:", implementationAddress);

  const nativeTokenWalletV2Factory = new ethers.ContractFactory(
    nativeTokenWalletV2Json.abi,
    nativeTokenWalletV2Json.bytecode,
    owner
  );
  const nativeTokenWalletV2Logic = await nativeTokenWalletV2Factory.deploy();
  await nativeTokenWalletV2Logic.waitForDeployment();
  console.log("NativeTokenWallet V2 logic", nativeTokenWalletV2Logic.target);

  newImplementationAddress = await nativeTokenWalletV2Logic.getAddress();
  upgradeTx = await proxyNativeTokenWallet.connect(owner).upgradeToAndCall(newImplementationAddress, "0x");
  await upgradeTx.wait();

  const proxyNativeTokenWalletV2 = new ethers.Contract(
    nativeTokenWalletProxyContract.target,
    nativeTokenWalletV2Json.abi,
    owner
  );
  versionAfter = await proxyNativeTokenWalletV2.version();
  console.log("NativeTokenWallet version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyNativeTokenWalletV2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("NativeTokenWallet implementation address after", implementationAddress);
  expect(versionAfter).to.equal("1.0.1");
  increaseTestValue = await proxyNativeTokenWalletV2.increaseTestValue();
  await increaseTestValue.wait();
  expect(await proxyNativeTokenWalletV2.testValue()).to.equal(1n);

  // Validators
  versionBefore = await proxyValidators.version();
  console.log("Validators version before upgrade", versionBefore);
  expect(versionBefore).to.equal("1.0.0");
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyValidators, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Validators implementation address before:", implementationAddress);

  const validatorsV2Factory = new ethers.ContractFactory(validatorsV2Json.abi, validatorsV2Json.bytecode, owner);
  const validatorsV2Logic = await validatorsV2Factory.deploy();
  await validatorsV2Logic.waitForDeployment();
  console.log("Validators V2 logic", validatorsV2Logic.target);

  newImplementationAddress = await validatorsV2Logic.getAddress();
  upgradeTx = await proxyValidators.connect(owner).upgradeToAndCall(newImplementationAddress, "0x");
  await upgradeTx.wait();

  const proxyValidatorsV2 = new ethers.Contract(validatorsProxyContract.target, validatorsV2Json.abi, owner);
  versionAfter = await proxyValidatorsV2.version();
  console.log("Validators version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyValidatorsV2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Validators implementation address after", implementationAddress);
  expect(versionAfter).to.equal("1.0.1");
  increaseTestValue = await proxyValidatorsV2.increaseTestValue();
  await increaseTestValue.wait();
  expect(await proxyValidatorsV2.testValue()).to.equal(1n);
}

main();
