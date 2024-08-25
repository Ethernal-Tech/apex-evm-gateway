const { ethers } = require("hardhat");

async function main() {
  const config = require("./config.json");

  //deployment of contract logic
  const Gateway = await ethers.getContractFactory("Gateway");
  const gatewayLogic = await Gateway.deploy();

  const ERC20TokenPredicate = await ethers.getContractFactory("ERC20TokenPredicate");
  const eRC20TokenPredicateLogic = await ERC20TokenPredicate.deploy();

  const NativeERC20Mintable = await ethers.getContractFactory("NativeERC20Mintable");
  const nativeERC20MintableLogic = await NativeERC20Mintable.deploy();

  const System = await ethers.getContractFactory("System");
  const system = await System.deploy();

  const Validators = await ethers.getContractFactory("Validators");
  const validatorscLogic = await Validators.deploy();

  // deployment of contract proxy
  const GatewayProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ERC20TokenPredicateProxy = await ethers.getContractFactory("ERC1967Proxy");
  const NativeERC20MintableProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorsProxy = await ethers.getContractFactory("ERC1967Proxy");

  const gatewayProxy = await GatewayProxy.deploy(
    await gatewayLogic.getAddress(),
    Gateway.interface.encodeFunctionData("initialize", [])
  );

  const eRC20TokenPredicateProxy = await ERC20TokenPredicateProxy.deploy(
    await eRC20TokenPredicateLogic.getAddress(),
    ERC20TokenPredicate.interface.encodeFunctionData("initialize", [])
  );

  const nativeERC20MintableProxy = await NativeERC20MintableProxy.deploy(
    await nativeERC20MintableLogic.getAddress(),
    NativeERC20Mintable.interface.encodeFunctionData("initialize", [])
  );

  const validatorscProxy = await ValidatorsProxy.deploy(
    await validatorscLogic.getAddress(),
    Validators.interface.encodeFunctionData("initialize", [config.Validators])
  );

  //casting proxy to the logic
  const GatewayDeployed = await ethers.getContractFactory("Gateway");
  const gateway = GatewayDeployed.attach(gatewayProxy.target);
  const ERC20TokenPredicateDeployed = await ethers.getContractFactory("ERC20TokenPredicate");
  const eRC20TokenPredicate = ERC20TokenPredicateDeployed.attach(eRC20TokenPredicateProxy.target);
  const NativeERC20MintableDeployed = await ethers.getContractFactory("NativeERC20Mintable");
  const nativeERC20Mintable = NativeERC20MintableDeployed.attach(nativeERC20MintableProxy.target);
  const ValidatorscDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorscDeployed.attach(validatorscProxy.target);

  await gateway.setDependencies(eRC20TokenPredicateProxy.target, validatorscProxy.target);
  await eRC20TokenPredicate.setDependencies(gatewayProxy.target, nativeERC20MintableProxy.target);
  await nativeERC20Mintable.setDependencies(
    eRC20TokenPredicateProxy.target,
    config.NativeERC20Mintable.name,
    config.NativeERC20Mintable.symbol,
    config.NativeERC20Mintable.decimals,
    config.NativeERC20Mintable.tokenSupply
  );
  await validatorsc.setDependencies(gatewayProxy.target, config.ValidatorAddressChainData);

  console.log("GatewayLogic deployed at:", gatewayLogic.target);
  console.log("GatewayProxy deployed at:", gatewayProxy.target);
  console.log("---");
  console.log("GatewayLogic owner:", await gateway.owner());
  console.log("---");
  console.log("ERC20TokenPredicateLogic deployed at:", eRC20TokenPredicateLogic.target);
  console.log("ERC20TokenPredicateProxy deployed at:", eRC20TokenPredicateProxy.target);
  console.log("---");
  console.log("ERC20TokenPredicateLogic owner:", await eRC20TokenPredicate.owner());
  console.log("---");
  console.log("NativeERC20MintableLogic deployed at:", nativeERC20MintableLogic.target);
  console.log("NativeERC20MintableProxy deployed at:", nativeERC20MintableProxy.target);
  console.log("---");
  console.log("NativeERC20MintableLogic owner:", await nativeERC20Mintable.owner());
  console.log("---");
  console.log("ValidatorsLogic deployed at:", validatorscLogic.target);
  console.log("ValidatorsProxy deployed at:", validatorscProxy.target);
  console.log("---");
  console.log("ValidatorsLogic owner:", await validatorsc.owner());
  console.log("---");
  console.log("SystemLogic deployed at:", system.target);
  console.log("---");

  // Proxy Gateway upgrade test
  const GatewayV2 = await ethers.getContractFactory("GatewayV2");
  const gatewayV2Logic = await GatewayV2.deploy();

  //empty bytes for second parameter signifies that contract is only being upgraded
  await gateway.upgradeToAndCall(await gatewayV2Logic.getAddress(), "0x");

  const GatewayDeployedV2 = await ethers.getContractFactory("GatewayV2");
  const gatewayV2 = GatewayDeployedV2.attach(gatewayProxy.target);

  //function hello() added in BridgeV2 contract always returns true
  const result = await gatewayV2.hello();
  console.log("Hello call GatewayV2", result);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
