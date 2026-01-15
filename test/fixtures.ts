import { ethers } from "ethers";
import { BigNumberish } from "ethers";
import { alwaysTrueBytecode } from "./constants";

export async function deployGatewayFixtures(hre: any) {
  const connection = await hre.network.connect();
  const provider = connection.ethers.provider;
  // Contracts are deployed using the first signer/account by default
  const [
    owner,
    receiver,
    validator1,
    validator2,
    validator3,
    validator4,
    validator5,
  ] = await connection.ethers.getSigners();
  const validators = [
    validator1,
    validator2,
    validator3,
    validator4,
    validator5,
  ];

  const NativeTokenWallet = await connection.ethers.getContractFactory(
    "NativeTokenWallet"
  );
  const nativeTokenWalletLogic = await NativeTokenWallet.deploy();

  const NativeTokenPredicate = await connection.ethers.getContractFactory(
    "NativeTokenPredicate"
  );
  const nativeTokenPredicateLogic = await NativeTokenPredicate.deploy();

  const Validators = await connection.ethers.getContractFactory("Validators");
  const validatorscLogic = await Validators.deploy();

  const Gateway = await connection.ethers.getContractFactory("Gateway");
  const gatewayLogic = await Gateway.deploy();

  const MockPrecompileTrue = await connection.ethers.getContractFactory(
    "MockPrecompileTrue"
  );
  const mockPrecompileTrue = await MockPrecompileTrue.deploy();

  const MockPrecompileFalse = await connection.ethers.getContractFactory(
    "MockPrecompileFalse"
  );
  const mockPrecompileFalse = await MockPrecompileFalse.deploy();

  // // deployment of contract proxy
  const NativeTokenPredicateProxy = await connection.ethers.getContractFactory(
    "UUPSProxy"
  );
  const NativeTokenWalletProxy = await connection.ethers.getContractFactory(
    "UUPSProxy"
  );
  const ValidatorscProxy = await connection.ethers.getContractFactory(
    "UUPSProxy"
  );
  const GatewayProxy = await connection.ethers.getContractFactory("UUPSProxy");

  const nativeTokenPredicateProxy = await NativeTokenPredicateProxy.deploy(
    nativeTokenPredicateLogic.target,
    NativeTokenPredicate.interface.encodeFunctionData("initialize", [])
  );

  const nativeTokenWalletProxy = await NativeTokenWalletProxy.deploy(
    nativeTokenWalletLogic.target,
    NativeTokenWallet.interface.encodeFunctionData("initialize", [])
  );

  const validatorsAddresses = [
    validator1.address,
    validator2.address,
    validator3.address,
    validator4.address,
    validator5.address,
  ];

  const validatorsProxy = await ValidatorscProxy.deploy(
    validatorscLogic.target,
    Validators.interface.encodeFunctionData("initialize", [])
  );

  const gatewayProxy = await GatewayProxy.deploy(
    gatewayLogic.target,
    Gateway.interface.encodeFunctionData("initialize", [100, 50])
  );

  // //casting proxy contracts to contract logic
  const NativeTokenPredicateDeployed =
    await connection.ethers.getContractFactory("NativeTokenPredicate");
  const nativeTokenPredicate = NativeTokenPredicateDeployed.attach(
    nativeTokenPredicateProxy.target
  );

  const NativeTokenWalletDeployed = await connection.ethers.getContractFactory(
    "NativeTokenWallet"
  );
  const nativeTokenWallet = NativeTokenWalletDeployed.attach(
    nativeTokenWalletProxy.target
  );

  const ValidatorsDeployed = await connection.ethers.getContractFactory(
    "Validators"
  );
  const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target);

  const GatewayDeployed = await connection.ethers.getContractFactory("Gateway");
  const gateway = GatewayDeployed.attach(gatewayProxy.target);

  await gateway.setDependencies(
    nativeTokenPredicate.target,
    validatorsc.target
  );

  await nativeTokenPredicate.setDependencies(
    gateway.target,
    nativeTokenWallet.target
  );

  await nativeTokenWallet.setDependencies(nativeTokenPredicate.target);

  await validatorsc.setDependencies(gateway.target);

  await validatorsc.setAdditionalDependenciesAndSync(
    mockPrecompileTrue.target,
    true
  );

  const validatorsCardanoData = [
    {
      key: ["0x1", "0x2", "0x3", "0x4"] as [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish
      ],
    },
    {
      key: ["0x4", "0x2", "0x3", "0x4"] as [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish
      ],
    },
    {
      key: ["0x5", "0x2", "0x3", "0x4"] as [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish
      ],
    },
    {
      key: ["0x3", "0x2", "0x3", "0x4"] as [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish
      ],
    },
    {
      key: ["0x2", "0x2", "0x3", "0x4"] as [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish
      ],
    },
  ];

  const receiverWithdraw = [
    {
      receiver: "something",
      amount: 100,
    },
  ];

  await validatorsc.setValidatorsChainData(validatorsCardanoData);

  // await hre.network.provider.send("hardhat_setCode", [
  //   "0x0000000000000000000000000000000000002060",
  //   alwaysTrueBytecode,
  // ]);

  //funding
  const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

  await owner.sendTransaction({
    to: nativeTokenWalletAddress,
    value: ethers.parseUnits("1", "ether"),
  });

  const gatewayContractAddress = await gateway.getAddress();

  await owner.sendTransaction({
    to: gatewayContractAddress,
    value: ethers.parseUnits("1", "ether"),
  });

  //data encoding
  const blockNumber = await connection.ethers.provider.getBlockNumber();
  const abiCoder = new ethers.AbiCoder();
  const address = ethers.Wallet.createRandom().address;
  const data = abiCoder.encode(
    ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
    [[1, blockNumber + 100, 1, [[address, 1000]]]]
  );

  const validatorSetChange = {
    batchId: 1n,
    _validatorsSetNumber: 1n,
    _ttl: 9999999999n,
    _validatorsChainData: [{ key: [123n, 456n, 789n, 101112n] }],
  };

  return {
    hre,
    owner,
    receiver,
    validators,
    gateway,
    nativeTokenPredicate,
    nativeTokenWallet,
    validatorsc,
    validatorsCardanoData,
    receiverWithdraw,
    data,
    validatorsAddresses,
    validatorSetChange,
    provider,
    connection,
    ethers: connection.ethers,
  };
}
