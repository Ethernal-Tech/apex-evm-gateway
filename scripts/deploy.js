const { ethers } = require("hardhat");

async function main() {
  const config = require("./config.json");

  //get address of bridge smart contract from config file

  // Use the default provider (this automatically connects to a provider service)
  const provider = ethers.getDefaultProvider(); // Connects to mainnet

  // Create a contract instance
  const contract = new ethers.Contract(config.Bridge.addr, config.Bridge.ABI, provider);

  let validatorsChainData = await contract.getValidatorsChainData(config.Bridge.chainId);

  const BridgeDeployed = await ethers.getContractFactory("Bridge");
  const bridge = BridgeDeployed.attach(bridgeAddress);

  //deployment of contract logic
  const Gateway = await ethers.getContractFactory("Gateway");
  const gatewayLogic = await Gateway.deploy();

  const NativeTokenPredicate = await ethers.getContractFactory("NativeTokenPredicate");
  const nativeTokenPredicateLogic = await NativeTokenPredicate.deploy();

  const NativeTokenWallet = await ethers.getContractFactory("NativeTokenWallet");
  const nativeTokenWalletLogic = await NativeTokenWallet.deploy();

  const Validators = await ethers.getContractFactory("Validators");
  const validatorscLogic = await Validators.deploy();

  // deployment of contract proxy
  const GatewayProxy = await ethers.getContractFactory("ERC1967Proxy");
  const NativeTokenPredicateProxy = await ethers.getContractFactory("ERC1967Proxy");
  const NativeTokenWalletProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorsProxy = await ethers.getContractFactory("ERC1967Proxy");

  const gatewayProxy = await GatewayProxy.deploy(
    await gatewayLogic.getAddress(),
    Gateway.interface.encodeFunctionData("initialize", [])
  );

  const nativeTokenPredicateProxy = await NativeTokenPredicateProxy.deploy(
    await nativeTokenPredicateLogic.getAddress(),
    NativeTokenPredicate.interface.encodeFunctionData("initialize", [])
  );

  const nativeTokenWalletProxy = await NativeTokenWalletProxy.deploy(
    await nativeTokenWalletLogic.getAddress(),
    NativeTokenWallet.interface.encodeFunctionData("initialize", [])
  );

  const validatorscProxy = await ValidatorsProxy.deploy(
    await validatorscLogic.getAddress(),
    Validators.interface.encodeFunctionData("initialize", [])
  );

  //casting proxy to the logic
  const GatewayDeployed = await ethers.getContractFactory("Gateway");
  const gateway = GatewayDeployed.attach(gatewayProxy.target);
  const NativeTokenPredicateDeployed = await ethers.getContractFactory("NativeTokenPredicate");
  const nativeTokenPredicate = NativeTokenPredicateDeployed.attach(nativeTokenPredicateProxy.target);
  const NativeTOkenWalletDeployed = await ethers.getContractFactory("NativeTokenWallet");
  const nativeTokenWallet = NativeTOkenWalletDeployed.attach(nativeTokenWalletProxy.target);
  const ValidatorscDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorscDeployed.attach(validatorscProxy.target);

  await gateway.setDependencies(nativeTokenPredicateProxy.target, validatorscProxy.target);
  await nativeTokenPredicate.setDependencies(gatewayProxy.target, nativeTokenWalletProxy.target);
  await nativeTokenWallet.setDependencies(nativeTokenPredicateProxy.target, config.NativeToken.tokenSupply);
  await validatorsc.setValidatorsChainData(validatorsChainData);

  console.log("GatewayLogic deployed at:", gatewayLogic.target);
  console.log("GatewayProxy deployed at:", gatewayProxy.target);
  console.log("---");
  console.log("GatewayLogic owner:", await gateway.owner());
  console.log("---");
  console.log("NativeTokenPredicateLogic deployed at:", nativeTokenPredicateLogic.target);
  console.log("NativeTokenPredicateProxy deployed at:", nativeTokenPredicateProxy.target);
  console.log("---");
  console.log("NativeTokenPredicateLogic owner:", await nativeTokenPredicate.owner());
  console.log("---");
  console.log("NativeTokenWalletLogic deployed at:", nativeTokenWalletLogic.target);
  console.log("NativeTokenWalletProxy deployed at:", nativeTokenWalletProxy.target);
  console.log("---");
  console.log("NativeTokenWalletLogic owner:", await nativeTokenWallet.owner());
  console.log("---");
  console.log("ValidatorsLogic deployed at:", validatorscLogic.target);
  console.log("ValidatorsProxy deployed at:", validatorscProxy.target);
  console.log("---");
  console.log("ValidatorsLogic owner:", await validatorsc.owner());
  console.log("---");

  // Proxy Gateway upgrade test
  // const GatewayV2 = await ethers.getContractFactory("GatewayV2");
  // const gatewayV2Logic = await GatewayV2.deploy();

  //empty bytes for second parameter signifies that contract is only being upgraded
  // await gateway.upgradeToAndCall(await gatewayV2Logic.getAddress(), "0x");

  // const GatewayDeployedV2 = await ethers.getContractFactory("GatewayV2");
  // const gatewayV2 = GatewayDeployedV2.attach(gatewayProxy.target);

  //function hello() added in BridgeV2 contract always returns true
  // const result = await gatewayV2.hello();
  // console.log("Hello call GatewayV2", result);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});