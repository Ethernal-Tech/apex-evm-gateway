import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Gateway Contract", function () {
  it("SetDependencies should fail if Gateway, NetiveToken or Relayer is Zero Address", async () => {
    const { owner, gateway, relayer, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      gateway.connect(owner).setDependencies(ethers.ZeroAddress, validatorsc.target, relayer.address)
    ).to.to.be.revertedWithCustomError(gateway, "ZeroAddress");
  });

  it("SetDependencies should fail if not called by owner", async () => {
    const { relayer, gateway, eRC20TokenPredicate, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      gateway.connect(relayer).setDependencies(eRC20TokenPredicate.target, validatorsc.target, relayer.address)
    ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, relayer, gateway, eRC20TokenPredicate, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      gateway.connect(owner).setDependencies(eRC20TokenPredicate.target, validatorsc.target, relayer.address)
    ).to.not.be.reverted;

    expect(await gateway.eRC20TokenPredicate()).to.equal(eRC20TokenPredicate.target);
    expect(await gateway.validators()).to.equal(validatorsc.target);
    expect(await gateway.relayer()).to.equal(relayer.address);
  });

  it("Deposit should fail if not called by Relayer", async () => {
    const { owner, gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const data = abiCoder.encode(
      ["uint64", "uint64", "tuple(uint8, address, uint256)[]"],
      [
        1,
        blockNumber,
        [
          [1, ethers.Wallet.createRandom().address, 100],
          [1, ethers.Wallet.createRandom().address, 200],
        ],
      ]
    );

    await expect(
      gateway
        .connect(owner)
        .deposit(
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          data
        )
    ).to.be.revertedWithCustomError(gateway, "NotRelayer");
  });

  it("Deposit success", async () => {
    const { relayer, gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["uint64", "uint64", "tuple(uint8, address, uint256)[]"],
      [1, blockNumber + 100, [[1, address, 100]]]
    );

    const depositTx = await gateway
      .connect(relayer)
      .deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data
      );
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt?.events?.find((log) => log.event === "Deposit");

    expect(depositEvent?.args?.data).to.equal(data);
  });

  it("Withdraw sucess", async () => {
    const { relayer, gateway, nativeERC20Mintable } = await loadFixture(deployGatewayFixtures);

    await nativeERC20Mintable.mint(gateway.target, 1000000);

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const withdrawTx = await gateway.connect(relayer).withdraw(1, receiverWithdraw, 100);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawEvent = withdrawReceipt?.events?.find((log) => log.event === "Withdraw");

    expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
    expect(withdrawEvent?.args?.sender).to.equal(gateway.target);
    expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("something");
    expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
    expect(withdrawEvent?.args?.feeAmount).to.equal(100);
  });
});
