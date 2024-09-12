const { ethers } = require("hardhat");
const { JsonRpcProvider } = require("ethers");
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function main(hre: HardhatRuntimeEnvironment) {
  const config = require("./config.json");

  // const provider = ethers.getDefaultProvider();
  const provider = new JsonRpcProvider(config.JsonRpcProvider.url);

  // Create a contract instance
  const contract = new ethers.Contract(config.Bridge.addr, config.Bridge.ABI, provider);

  const validatorsChainData = await contract.getValidatorsChainData(config.Bridge.chainId);

  const validatorsChainDataJson = [];

  for (let i = 0; i < validatorsChainData.length; i++) {
    validatorsChainDataJson.push({
      key: [
        validatorsChainData[i][0][0],
        validatorsChainData[i][0][1],
        validatorsChainData[i][0][2],
        validatorsChainData[i][0][3],
      ],
    });
  }

  // await hre.switchNetwork("sepolia");

  await hre.network.provider.request({
    method: "hardhat_switchNetwork",
    params: [{ networkName: "nexus" }],
  });

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
  await validatorsc.setValidatorsChainData(validatorsChainDataJson);

  console.log("GatewayLogic deployed at:", gatewayLogic.target);
  console.log("GatewayProxy deployed at:", gatewayProxy.target);
  console.log("---");
  console.log("NativeTokenPredicateLogic deployed at:", nativeTokenPredicateLogic.target);
  console.log("NativeTokenPredicateProxy deployed at:", nativeTokenPredicateProxy.target);
  console.log("---");
  console.log("NativeTokenWalletLogic deployed at:", nativeTokenWalletLogic.target);
  console.log("NativeTokenWalletProxy deployed at:", nativeTokenWalletProxy.target);
  console.log("---");
  console.log("ValidatorsLogic deployed at:", validatorscLogic.target);
  console.log("ValidatorsProxy deployed at:", validatorscProxy.target);
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

main(hre).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
