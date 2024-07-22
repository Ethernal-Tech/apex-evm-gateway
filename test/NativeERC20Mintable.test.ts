import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import * as hre from "hardhat";
import { ethers } from "hardhat";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";
import { alwaysFalseBytecode, alwaysRevertBytecode, alwaysTrueBytecode } from "./constants";

describe("NativeERC20Mintable Contract", function () {
  it("SetDependencies should fail if Owner or Predicate is Zero Address", async () => {
    const { owner, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable
        .connect(owner)
        .setDependencies(eRC20TokenPredicate.address, ethers.constants.AddressZero, "TEST", "TEST", 18, 0)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");

    await expect(
      nativeERC20Mintable
        .connect(owner)
        .setDependencies(ethers.constants.AddressZero, owner.address, "TEST", "TEST", 18, 0)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("SetDependencies will fail if not called by owner", async () => {
    const { owner, receiver, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable
        .connect(receiver)
        .setDependencies(eRC20TokenPredicate.address, owner.address, "TEST", "TEST", 18, 0)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable
        .connect(owner)
        .setDependencies(eRC20TokenPredicate.address, owner.address, "TEST", "TEST", 18, 0)
    ).to.not.be.reverted;
    expect(await nativeERC20Mintable.name()).to.equal("TEST");
    expect(await nativeERC20Mintable.symbol()).to.equal("TEST");
    expect(await nativeERC20Mintable.decimals()).to.equal(18);
    expect(await nativeERC20Mintable.totalSupply()).to.equal(0);
    expect(await nativeERC20Mintable.predicate()).to.equal(eRC20TokenPredicate.address);
    expect(await nativeERC20Mintable.owner()).to.equal(owner.address);
  });

  it("Mint will fail if not called by Predicate or Owner", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    await expect(nativeERC20Mintable.connect(receiver).mint(receiver.address, 100)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "NotPredicateOrOwner"
    );
  });

  it("Mint will fail if minting to Zero Address", async function () {
    const { nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const eRC20TokenPredicateContract = await impersonateAsContractAndMintFunds(await eRC20TokenPredicate.address);

    await expect(
      nativeERC20Mintable.connect(eRC20TokenPredicateContract).mint(ethers.constants.AddressZero, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("Mint will fail in case of Precompile Fails", async function () {
    const { nativeERC20Mintable } = await loadFixture(deployGatewayFixtures);

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysFalseBytecode,
    ]);
    await expect(nativeERC20Mintable.mint(ethers.Wallet.createRandom().address, 1)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "PrecompileCallFailed"
    );
    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysTrueBytecode,
    ]);
  });

  it("Mint will fail in case of Precompile Reverts", async function () {
    const { nativeERC20Mintable } = await loadFixture(deployGatewayFixtures);

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysRevertBytecode,
    ]);
    await expect(nativeERC20Mintable.mint(ethers.Wallet.createRandom().address, 1)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "PrecompileCallFailed"
    );
    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysTrueBytecode,
    ]);
  });

  it("Mint token success", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);
    const totalSupplyBefore = await nativeERC20Mintable.totalSupply();

    const mintTx = await nativeERC20Mintable.mint(receiver.address, randomAmount);
    const mintReceipt = await mintTx.wait();
    const transferEvent = mintReceipt?.events?.find((log) => log.event === "Transfer");

    expect(await nativeERC20Mintable.totalSupply()).to.equal(totalSupplyBefore.add(randomAmount));

    expect(transferEvent?.args?.from).to.equal(ethers.constants.AddressZero);
    expect(transferEvent?.args?.to).to.equal(receiver.address);
    expect(transferEvent?.args?.value).to.equal(randomAmount);
  });

  it("Transfer will fail from Zero Address", async function () {
    const { nativeERC20Mintable } = await loadFixture(deployGatewayFixtures);

    const addressZeroFunded = await impersonateAsContractAndMintFunds(ethers.constants.AddressZero);

    await expect(
      nativeERC20Mintable.connect(addressZeroFunded).transfer(ethers.constants.AddressZero, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("Transfer will fail to Zero Address", async function () {
    const { nativeERC20Mintable, owner } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable.connect(owner).transfer(ethers.constants.AddressZero, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("Transfer token success", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    const transferTx = await nativeERC20Mintable.transfer(receiver.address, randomAmount);
    const transferReceipt = await transferTx.wait();
    const transferEvent = transferReceipt?.events?.find((log) => log.event === "Transfer");

    expect(transferEvent?.args?.from).to.equal(owner.address);
    expect(transferEvent?.args?.to).to.equal(receiver.address);
    expect(transferEvent?.args?.value).to.equal(randomAmount);
  });

  it("Approve fails if to is Zero Address", async function () {
    const { nativeERC20Mintable, owner } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable.connect(owner).approve(ethers.constants.AddressZero, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("TransferFrom fails if not appoved", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable.connect(owner).transferFrom(receiver.address, owner.address, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "InsufficientAllowance");
  });

  it("Approve fails if from is Zero Address", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    const addressZeroFunded = await impersonateAsContractAndMintFunds(ethers.constants.AddressZero);

    await expect(
      nativeERC20Mintable.connect(addressZeroFunded).approve(receiver.address, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("Approve fails if to is Zero Address", async function () {
    const { nativeERC20Mintable, owner } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable.connect(owner).approve(ethers.constants.AddressZero, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("Approve success", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    const balance = await nativeERC20Mintable.balanceOf(owner.address);

    const approveTx = await nativeERC20Mintable.approve(receiver.address, balance);
    const approveReceipt = await approveTx.wait();
    const approveEvent = approveReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveEvent?.args?.owner).to.equal(owner.address);
    expect(approveEvent?.args?.spender).to.equal(receiver.address);
    expect(approveEvent?.args?.value).to.equal(balance);

    expect(await nativeERC20Mintable.allowance(owner.address, receiver.address)).to.equal(balance);
  });

  it("TransferFrom success", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    const balanceOwnerBefore = await nativeERC20Mintable.balanceOf(owner.address);

    const approveTx = await nativeERC20Mintable.approve(receiver.address, balanceOwnerBefore);
    const approveReceipt = await approveTx.wait();
    const approveEvent = approveReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveEvent?.args?.owner).to.equal(owner.address);
    expect(approveEvent?.args?.spender).to.equal(receiver.address);
    expect(approveEvent?.args?.value).to.equal(balanceOwnerBefore);

    expect(await nativeERC20Mintable.allowance(owner.address, receiver.address)).to.equal(balanceOwnerBefore);

    const transferTx = await nativeERC20Mintable
      .connect(receiver)
      .transferFrom(owner.address, receiver.address, balanceOwnerBefore);
    const transferReceipt = await transferTx.wait();
    const transferEvent = transferReceipt?.events?.find((log) => log.event === "Transfer");

    expect(transferEvent?.args?.from).to.equal(owner.address);
    expect(transferEvent?.args?.to).to.equal(receiver.address);
    expect(transferEvent?.args?.value).to.equal(balanceOwnerBefore);

    expect(await nativeERC20Mintable.allowance(owner.address, receiver.address)).to.equal(0);
  });

  it("Increase allowance success", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    const approveTx = await nativeERC20Mintable.approve(receiver.address, 1000000000000);
    const approveReceipt = await approveTx.wait();
    const approveEvent = approveReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveEvent?.args?.owner).to.equal(owner.address);
    expect(approveEvent?.args?.spender).to.equal(receiver.address);
    expect(approveEvent?.args?.value).to.equal(1000000000000);

    const approveIncreaseTx = await nativeERC20Mintable.increaseAllowance(receiver.address, 1000000000000);
    const approveIncreaseReceipt = await approveIncreaseTx.wait();
    const approveIncreaseEvent = approveIncreaseReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveIncreaseEvent?.args?.owner).to.equal(owner.address);
    expect(approveIncreaseEvent?.args?.spender).to.equal(receiver.address);
    expect(approveIncreaseEvent?.args?.value).to.equal(2000000000000);
  });

  it("Decrease allowance fail undeflow", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    const approveTx = await nativeERC20Mintable.approve(receiver.address, 1000000000000);
    const approveReceipt = await approveTx.wait();
    const approveEvent = approveReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveEvent?.args?.owner).to.equal(owner.address);
    expect(approveEvent?.args?.spender).to.equal(receiver.address);
    expect(approveEvent?.args?.value).to.equal(1000000000000);

    await expect(nativeERC20Mintable.decreaseAllowance(receiver.address, 10000000000000)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "DecresedAllowenceBelowZero"
    );
  });

  it("Decrease allowance success", async function () {
    const { nativeERC20Mintable, owner, receiver } = await loadFixture(deployGatewayFixtures);

    const approveTx = await nativeERC20Mintable.approve(receiver.address, 1000000000000);
    const approveReceipt = await approveTx.wait();
    const approveEvent = approveReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveEvent?.args?.owner).to.equal(owner.address);
    expect(approveEvent?.args?.spender).to.equal(receiver.address);
    expect(approveEvent?.args?.value).to.equal(1000000000000);

    const approveDecreaseTx = await nativeERC20Mintable.decreaseAllowance(receiver.address, 1000000000000);
    const approveDecreaseReceipt = await approveDecreaseTx.wait();
    const approveDecreaseEvent = approveDecreaseReceipt?.events?.find((log) => log.event === "Approval");

    expect(approveDecreaseEvent?.args?.owner).to.equal(owner.address);
    expect(approveDecreaseEvent?.args?.spender).to.equal(receiver.address);
    expect(approveDecreaseEvent?.args?.value).to.equal(0);
  });

  it("Burn will fail in case of Precompile Fails", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeERC20Mintable.mint(receiver.address, randomAmount);

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysFalseBytecode,
    ]);
    await expect(nativeERC20Mintable.burn(receiver.address, 1)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "PrecompileCallFailed"
    );
    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysTrueBytecode,
    ]);
  });

  it("Burn will fail in case of Precompile Reverts", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeERC20Mintable.mint(receiver.address, randomAmount);

    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysRevertBytecode,
    ]);
    await expect(nativeERC20Mintable.burn(receiver.address, 1)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "PrecompileCallFailed"
    );
    await hre.network.provider.send("hardhat_setCode", [
      "0x0000000000000000000000000000000000002020",
      alwaysTrueBytecode,
    ]);
  });

  it("Burn will fail in not called by Predicate or Owner", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeERC20Mintable.mint(receiver.address, randomAmount);

    await expect(nativeERC20Mintable.connect(receiver).burn(receiver.address, 1)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "NotPredicateOrOwner"
    );
  });

  it("Burn will fail if burning from Zero Address", async function () {
    const { nativeERC20Mintable, owner } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeERC20Mintable.mint(owner.address, randomAmount);

    await expect(
      nativeERC20Mintable.connect(owner).burn(ethers.constants.AddressZero, 100)
    ).to.be.revertedWithCustomError(nativeERC20Mintable, "ZeroAddress");
  });

  it("Burn success", async function () {
    const { nativeERC20Mintable, owner } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeERC20Mintable.mint(owner.address, randomAmount);

    const burnTx = await nativeERC20Mintable.connect(owner).burn(owner.address, 100);
    const burnReceipt = await burnTx.wait();
    const burnEvent = burnReceipt?.events?.find((log) => log.event === "Transfer");

    expect(burnEvent?.args?.from).to.equal(owner.address);
    expect(burnEvent?.args?.to).to.equal(ethers.constants.AddressZero);
    expect(burnEvent?.args?.value).to.equal(100);
  });
});
