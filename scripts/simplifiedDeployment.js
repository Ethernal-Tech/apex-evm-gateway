const { ethers } = require("ethers");
const { JsonRpcProvider } = require("ethers");
const config = require("./config.json");
const gatewayJson = require("../artifacts/contracts/Gateway.sol/Gateway.json");
const nativeTokenPredicateJson = require("../artifacts/contracts/NativeTokenPredicate.sol/NativeTokenPredicate.json");
const nativeTokenWalletJson = require("../artifacts/contracts/NativeTokenWallet.sol/NativeTokenWallet.json");
const validatorsJson = require("../artifacts/contracts/Validators.sol/Validators.json");
const ERC1967ProxyJson = require("../artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json");

const main = async () => {
  if (process.argv.slice(2).length < 4) {
    console.log(
      "Please provide 4 arguments: BLADE_RPC_URL, BRIDGE_ADDRESS, NEXUS_RPC_URL, NEXUS_PRIVATE_KEY"
    );
    process.exit(1);
  }

  const BLADE_RPC_URL = process.argv[2];
  const BRIDGE_ADDRESS = process.argv[3];
  const NEXUS_RPC_URL = process.argv[4];
  const NEXUS_PRIVATE_KEY = process.argv[5];

  //Getting validatorsData from Blade
  let provider = new JsonRpcProvider(BLADE_RPC_URL);

  const contract = new ethers.Contract(
    BRIDGE_ADDRESS,
    config.Bridge.getValidatorsChainData,
    provider
  );

  console.log("--- Getting validatorsChainData from Blade");
  const validatorsChainData = await contract.getValidatorsChainData(2);

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

  console.log("--- Deploying the Logic Contracts");
  provider = new JsonRpcProvider(NEXUS_RPC_URL);

  const wallet = new ethers.Wallet(NEXUS_PRIVATE_KEY, provider);

  const gatewayFactory = new ethers.ContractFactory(
    gatewayJson.abi,
    gatewayJson.bytecode,
    wallet
  );
  const gatewayLogic = await gatewayFactory.deploy();
  await gatewayLogic.waitForDeployment();
  console.log("Gateway logic", gatewayLogic.target);

  const nativeTokenPredicateFactory = new ethers.ContractFactory(
    nativeTokenPredicateJson.abi,
    nativeTokenPredicateJson.bytecode,
    wallet
  );
  const nativeTokenPredicateLogic = await nativeTokenPredicateFactory.deploy();
  await nativeTokenPredicateLogic.waitForDeployment();

  console.log("NativeTokenPredicate logic", nativeTokenPredicateLogic.target);

  const nativeTokenWalletFactory = new ethers.ContractFactory(
    nativeTokenWalletJson.abi,
    nativeTokenWalletJson.bytecode,
    wallet
  );
  const nativeTokenWalletLogic = await nativeTokenWalletFactory.deploy();
  await nativeTokenWalletLogic.waitForDeployment();

  console.log("NativeTokenWallet logic", nativeTokenWalletLogic.target);

  const validatorscFactory = new ethers.ContractFactory(
    validatorsJson.abi,
    validatorsJson.bytecode,
    wallet
  );
  const validatorsLogic = await validatorscFactory.deploy();
  await validatorsLogic.waitForDeployment();

  console.log("Validators logic", validatorsLogic.target);

  console.log("--- Deploying the Proxy Contracts");
  const initData = gatewayLogic.interface.encodeFunctionData("initialize", []);

  const ProxyFactory = new ethers.ContractFactory(
    ERC1967ProxyJson.abi,
    ERC1967ProxyJson.bytecode,
    wallet
  );

  const gatewayProxyContract = await ProxyFactory.deploy(
    gatewayLogic.target,
    initData
  );
  await gatewayProxyContract.waitForDeployment();

  console.log(
    `Gateway Proxy contract deployed at: ${gatewayProxyContract.target}`
  );

  const nativeTokenPredicateProxyContract = await ProxyFactory.deploy(
    nativeTokenPredicateLogic.target,
    initData
  );
  await nativeTokenPredicateProxyContract.waitForDeployment();

  console.log(
    `NativeTokenPredicate Proxy contract deployed at: ${nativeTokenPredicateProxyContract.target}`
  );

  const nativeTokenWalletProxyContract = await ProxyFactory.deploy(
    nativeTokenWalletLogic.target,
    initData
  );
  await nativeTokenWalletProxyContract.waitForDeployment();

  console.log(
    `NativeTokenWallet Proxy contract deployed at: ${nativeTokenWalletProxyContract.target}`
  );

  const validatorsProxyContract = await ProxyFactory.deploy(
    validatorsLogic.target,
    initData
  );
  await validatorsProxyContract.waitForDeployment();

  console.log(
    `Validators Proxy contract deployed at: ${validatorsProxyContract.target}`
  );

  console.log("--- Setting dependencies");
  const proxyGateway = new ethers.Contract(
    gatewayProxyContract.target,
    gatewayJson.abi,
    wallet
  );

  await proxyGateway.setDependencies(
    nativeTokenPredicateProxyContract.target,
    validatorsProxyContract.target
  );

  const proxyNativeTokenPredicate = new ethers.Contract(
    nativeTokenPredicateProxyContract.target,
    nativeTokenPredicateJson.abi,
    wallet
  );

  await proxyNativeTokenPredicate.setDependencies(
    gatewayProxyContract.target,
    nativeTokenWalletProxyContract.target
  );

  const proxyNativeTokenWallet = new ethers.Contract(
    nativeTokenWalletProxyContract.target,
    nativeTokenWalletJson.abi,
    wallet
  );

  await proxyNativeTokenWallet.setDependencies(
    nativeTokenPredicateProxyContract.target
  );

  console.log("--- Setting validatorsChainData");
  const proxyValidators = new ethers.Contract(
    validatorsProxyContract.target,
    validatorsJson.abi,
    wallet
  );

  await proxyValidators.setValidatorsChainData(validatorsChainDataJson);
};

main();
