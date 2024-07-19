import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";
import { ethers } from "hardhat";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";
import { alwaysFalseBytecode, alwaysRevertBytecode, alwaysTrueBytecode } from "./constants";

describe("ERC20TokenPredicate Contract", function () {
  it("Initialize should fail if Gateway or NetiveToken is Zero Address", async () => {
    const { owner, gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      eRC20TokenPredicate.connect(owner).setDependencies(ethers.constants.AddressZero, nativeERC20Mintable.address)
    ).to.to.be.revertedWithCustomError(eRC20TokenPredicate, "ZeroAddress");

    await expect(
      eRC20TokenPredicate.connect(owner).setDependencies(gateway.address, ethers.constants.AddressZero)
    ).to.to.be.revertedWithCustomError(eRC20TokenPredicate, "ZeroAddress");
  });

  it("initialize and validate initialization", async () => {
    const { owner, gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(eRC20TokenPredicate.connect(owner).setDependencies(gateway.address, nativeERC20Mintable.address)).to
      .not.be.reverted;

    expect(await eRC20TokenPredicate.gateway()).to.equal(gateway.address);
    expect(await eRC20TokenPredicate.nativeToken()).to.equal(nativeERC20Mintable.address);
  });

  it("Deposit should fail if not called by Gateway", async () => {
    const { receiver, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.utils.AbiCoder();
    const data = abiCoder.encode(
      ["uint8", "uint256", "tuple(uint8, address, uint256)[]"],
      [
        1,
        blockNumber,
        [
          [1, ethers.Wallet.createRandom().address, 100],
          [1, ethers.Wallet.createRandom().address, 200],
        ],
      ]
    );

    await expect(eRC20TokenPredicate.connect(receiver).deposit(data)).to.be.revertedWithCustomError(
      eRC20TokenPredicate,
      "NotGateway"
    );
  });

  it("Deposit should emit TTLExpired if TTL expired", async () => {
    const { gateway, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.utils.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["uint8", "uint256", "tuple(uint8, address, uint256)[]"],
      [1, blockNumber - 1, [[1, address, 100]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    const ttlTx = await eRC20TokenPredicate.connect(gatewayContract).deposit(data);
    const ttlReceipt = await ttlTx.wait();
    const ttlEvent = ttlReceipt?.events?.find((log) => log.event === "TTLExpired");
    const depositEvent = ttlReceipt?.events?.find((log) => log.event === "Deposit");

    expect(ttlEvent?.args?.data).to.equal(data);
    expect(depositEvent?.args?.data).to.be.undefined;
  });

  it("Deposit fails when Precopile Fails", async () => {
    const { gateway, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.utils.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["uint8", "uint256", "tuple(uint8, address, uint256)[]"],
      [1, blockNumber + 100, [[1, address, 100]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysFalseBytecode,
    ]);

    await expect(eRC20TokenPredicate.connect(gatewayContract).deposit(data)).to.be.revertedWithCustomError(
      eRC20TokenPredicate,
      "PrecompileCallFailed"
    );

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysTrueBytecode,
    ]);
  });

  it("Deposit success", async () => {
    const { gateway, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.utils.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["uint8", "uint256", "tuple(uint8, address, uint256)[]"],
      [1, blockNumber + 100, [[1, address, 100]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    const depositTx = await eRC20TokenPredicate.connect(gatewayContract).deposit(data);
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt?.events?.find((log) => log.event === "Deposit");

    expect(depositEvent?.args?.data).to.equal(data);
  });

  it("Withdraw fails when Precopile Fails", async () => {
    const { gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await nativeERC20Mintable.mint(gateway.address, 1000000);

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysFalseBytecode,
    ]);

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    await expect(
      eRC20TokenPredicate.connect(gatewayContract).withdraw(1, receiverWithdraw, 100)
    ).to.be.revertedWithCustomError(eRC20TokenPredicate, "PrecompileCallFailed");

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysTrueBytecode,
    ]);
  });
});
