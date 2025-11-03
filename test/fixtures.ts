import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { alwaysTrueBytecode } from "./constants";

export async function deployGatewayFixtures() {
  // Contracts are deployed using the first signer/account by default
  const [
    owner,
    receiver,
    validator1,
    validator2,
    validator3,
    validator4,
    validator5,
  ] = await ethers.getSigners();
  const validators = [
    validator1,
    validator2,
    validator3,
    validator4,
    validator5,
  ];

  const hre = require("hardhat");

  const NativeTokenWallet = await ethers.getContractFactory(
    "NativeTokenWallet"
  );
  const nativeTokenWalletLogic = await NativeTokenWallet.deploy();

  const NativeTokenPredicate = await ethers.getContractFactory(
    "NativeTokenPredicate"
  );
  const nativeTokenPredicateLogic = await NativeTokenPredicate.deploy();

  const Validators = await ethers.getContractFactory("Validators");
  const validatorscLogic = await Validators.deploy();

  const Gateway = await ethers.getContractFactory("Gateway");
  const gatewayLogic = await Gateway.deploy();

  // // deployment of contract proxy
  const NativeTokenPredicateProxy = await ethers.getContractFactory(
    "ERC1967Proxy"
  );
  const NativeTokenWalletProxy = await ethers.getContractFactory(
    "ERC1967Proxy"
  );
  const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");
  const GatewayProxy = await ethers.getContractFactory("ERC1967Proxy");

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
  const NativeTokenPredicateDeployed = await ethers.getContractFactory(
    "NativeTokenPredicate"
  );
  const nativeTokenPredicate = NativeTokenPredicateDeployed.attach(
    nativeTokenPredicateProxy.target
  );

  const NativeTokenWalletDeployed = await ethers.getContractFactory(
    "NativeTokenWallet"
  );
  const nativeTokenWallet = NativeTokenWalletDeployed.attach(
    nativeTokenWalletProxy.target
  );

  const ValidatorsDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target);

  const GatewayDeployed = await ethers.getContractFactory("Gateway");
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

  await hre.network.provider.send("hardhat_setCode", [
    "0x0000000000000000000000000000000000002060",
    alwaysTrueBytecode,
  ]);

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
  const blockNumber = await ethers.provider.getBlockNumber();
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
  };
}

export async function impersonateAsContractAndMintFunds(
  contractAddress: string
) {
  const hre = require("hardhat");
  const address = await contractAddress.toLowerCase();
  // impersonate as an contract on specified address
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  const signer = await ethers.getSigner(address);
  // minting 100000000000000000000 tokens to signer
  await ethers.provider.send("hardhat_setBalance", [
    signer.address,
    "0x56BC75E2D63100000",
  ]);

  return signer;
}
