const { ethers } = require("ethers");
const { JsonRpcProvider } = require("ethers");
const nativeTokenPredicateJson = require("../artifacts/contracts/NativeTokenPredicate.sol/NativeTokenPredicate.json");

const main = async () => {
  if (process.argv.slice(2).length < 3) {
    console.log("Please provide 3 arguments: NEXUS_RPC_URL, NEXUS_PRIVATE_KEY, PROXY_CONTRACT_ADDRESS");
    process.exit(1);
  }

  const NEXUS_RPC_URL = process.argv[2];
  const NEXUS_PRIVATE_KEY = process.argv[3];
  const PROXY_CONTRACT_ADDRESS = process.argv[4];

  console.log("--- Deploying the Logic Contracts");
  provider = new JsonRpcProvider(NEXUS_RPC_URL);

  const wallet = new ethers.Wallet(NEXUS_PRIVATE_KEY, provider);

  const nativeTokenPredicateFactory = new ethers.ContractFactory(
    nativeTokenPredicateJson.abi,
    nativeTokenPredicateJson.bytecode,
    wallet
  );
  const nativeTokenPredicateLogic = await nativeTokenPredicateFactory.deploy();
  await nativeTokenPredicateLogic.waitForDeployment();

  console.log("NativeTokenPredicate logic", nativeTokenPredicateLogic.target);

  //Upgrade the Proxy contract

  const nativeTokenPredicateLogicProxy = new ethers.Contract(
    PROXY_CONTRACT_ADDRESS,
    nativeTokenPredicateJson.abi,
    wallet
  );

  const tx = await nativeTokenPredicateLogicProxy.upgradeToAndCall(await nativeTokenPredicateLogic.getAddress(), "0x");
  await tx.wait();

  console.log("NativeTokenPredicate logic upgraded");
  //reading newly added value
  console.log("lastBatchId", await nativeTokenPredicateLogicProxy.lastBatchId());
};

main();
