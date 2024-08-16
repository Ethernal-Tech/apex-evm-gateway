import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { alwaysTrueBytecode } from "./constants";

export async function deployGatewayFixtures() {
  // Contracts are deployed using the first signer/account by default
  const [owner, receiver, validator1, validator2, validator3, validator4, validator5, validator6] =
    await ethers.getSigners();
  const validators = [validator1, validator2, validator3, validator4, validator5];

  const hre = require("hardhat");

  const NativeERC20Mintable = await ethers.getContractFactory("NativeERC20Mintable");
  const nativeERC20MintableLogic = await NativeERC20Mintable.deploy();

  const ERC20TokenPredicate = await ethers.getContractFactory("ERC20TokenPredicate");
  const eRC20TokenPredicateLogic = await ERC20TokenPredicate.deploy();

  const Validators = await ethers.getContractFactory("Validators");
  const validatorscLogic = await Validators.deploy();

  const Gateway = await ethers.getContractFactory("Gateway");
  const gatewayLogic = await Gateway.deploy();

  // deployment of contract proxy
  const ERC20TokenPredicateProxy = await ethers.getContractFactory("ERC1967Proxy");
  const NativeERC20MintableProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");
  const GatewayProxy = await ethers.getContractFactory("ERC1967Proxy");

  const eRC20TokenPredicateProxy = await ERC20TokenPredicateProxy.deploy(
    eRC20TokenPredicateLogic.target,
    ERC20TokenPredicate.interface.encodeFunctionData("initialize", [])
  );

  const nativeERC20MintableProxy = await NativeERC20MintableProxy.deploy(
    nativeERC20MintableLogic.target,
    NativeERC20Mintable.interface.encodeFunctionData("initialize", [])
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
    Validators.interface.encodeFunctionData("initialize", [validatorsAddresses])
  );

  const gatewayProxy = await GatewayProxy.deploy(
    gatewayLogic.target,
    Gateway.interface.encodeFunctionData("initialize", [])
  );

  //casting proxy contracts to contract logic
  const ERC20TokenPredicateDeployed = await ethers.getContractFactory("ERC20TokenPredicate");
  const eRC20TokenPredicate = ERC20TokenPredicateDeployed.attach(eRC20TokenPredicateProxy.target);

  const NativeERC20MintableDeployed = await ethers.getContractFactory("NativeERC20Mintable");
  const nativeERC20Mintable = NativeERC20MintableDeployed.attach(nativeERC20MintableProxy.target);

  const ValidatorsDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target);

  const GatewayDeployed = await ethers.getContractFactory("Gateway");
  const gateway = GatewayDeployed.attach(gatewayProxy.target);

  await gateway.setDependencies(eRC20TokenPredicate.target, validatorsc.target);

  await eRC20TokenPredicate.setDependencies(gateway.target, nativeERC20Mintable.target);

  await nativeERC20Mintable.setDependencies(eRC20TokenPredicate.target, "TEST", "TEST", 18, 0);

  const validatorCardanoData = {
    key: ["0x1", "0x2", "0x3", "0x4"] as [BigNumberish, BigNumberish, BigNumberish, BigNumberish],
  };

  const validatorAddressCardanoData = [
    {
      addr: validator1.address,
      data: validatorCardanoData,
    },
    {
      addr: validator2.address,
      data: validatorCardanoData,
    },
    {
      addr: validator3.address,
      data: validatorCardanoData,
    },
    {
      addr: validator4.address,
      data: validatorCardanoData,
    },
    {
      addr: validator5.address,
      data: validatorCardanoData,
    },
  ];

  await validatorsc.setDependencies(gateway.target, validatorAddressCardanoData);

  await hre.network.provider.send("hardhat_setCode", [
    "0x0000000000000000000000000000000000002020",
    alwaysTrueBytecode, // native transfer pre-compile
  ]);

  await hre.network.provider.send("hardhat_setCode", [
    "0x0000000000000000000000000000000000002060",
    alwaysTrueBytecode,
  ]);

  return {
    hre,
    owner,
    receiver,
    validators,
    gateway,
    eRC20TokenPredicate,
    nativeERC20Mintable,
    validatorsc,
    validatorCardanoData,
    validatorAddressCardanoData,
  };
}

export async function impersonateAsContractAndMintFunds(contractAddress: string) {
  const hre = require("hardhat");
  const address = await contractAddress.toLowerCase();
  // impersonate as an contract on specified address
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  const signer = await ethers.getSigner(address);
  // minting 100000000000000000000 tokens to signer
  await ethers.provider.send("hardhat_setBalance", [signer.address, "0x56BC75E2D63100000"]);

  return signer;
}
