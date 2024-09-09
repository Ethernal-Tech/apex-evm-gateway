import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";

describe("NativeTokenWallet Contract", function () {
  it("SetDependencies should fail if Predicate is Zero Address", async () => {
    const { owner, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    await expect(nativeTokenWallet.connect(owner).setDependencies(ethers.ZeroAddress, 0)).to.be.revertedWithCustomError(
      nativeTokenWallet,
      "ZeroAddress"
    );
  });

  it("SetDependencies will fail if not called by owner", async () => {
    const { receiver, nativeTokenWallet, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeTokenWallet.connect(receiver).setDependencies(nativeTokenPredicate.target, 0)
    ).to.be.revertedWithCustomError(nativeTokenPredicate, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, nativeTokenWallet, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(nativeTokenWallet.connect(owner).setDependencies(nativeTokenPredicate.target, 0)).to.not.be.reverted;
    expect(await nativeTokenWallet.predicate()).to.equal(nativeTokenPredicate.target);
    expect(await nativeTokenWallet.owner()).to.equal(owner.address);
  });

  it("Mint will fail if not called by Predicate or Owner", async function () {
    const { nativeTokenWallet, receiver } = await loadFixture(deployGatewayFixtures);

    await expect(nativeTokenWallet.connect(receiver).deposit(receiver.address, 100)).to.be.revertedWithCustomError(
      nativeTokenWallet,
      "NotPredicateOrOwner"
    );
  });

  it("Deposit success", async function () {
    const { receiver, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    const totalSupplyBefore = await nativeTokenWallet.totalSupply();
    const receiverBalanceBefore = await ethers.provider.getBalance(receiver);
    const nativeTokenWalletBefore = await ethers.provider.getBalance(nativeTokenWalletAddress);

    await nativeTokenWallet.deposit(receiver.address, randomAmount);

    const totalSupplyAfter = await nativeTokenWallet.totalSupply();
    const receiverBalanceAfter = await ethers.provider.getBalance(receiver);
    const nativeTokenWalletAfter = await ethers.provider.getBalance(nativeTokenWalletAddress);

    expect(totalSupplyAfter).to.equal(totalSupplyBefore + BigInt(randomAmount));
    expect(receiverBalanceAfter).to.equal(receiverBalanceBefore + BigInt(randomAmount));
    expect(nativeTokenWalletAfter).to.equal(nativeTokenWalletBefore - BigInt(randomAmount));
  });

  it("Withdraw will fail in not called by Predicate or Owner", async function () {
    const { nativeTokenWallet, receiver } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeTokenWallet.deposit(receiver.address, randomAmount);

    await expect(nativeTokenWallet.connect(receiver).withdraw(1)).to.be.revertedWithCustomError(
      nativeTokenWallet,
      "NotPredicateOrOwner"
    );
  });

  it("Withdraw success", async function () {
    const { nativeTokenWallet, owner } = await loadFixture(deployGatewayFixtures);

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeTokenWallet.deposit(owner.address, randomAmount);

    const totalSupplyBefore = await nativeTokenWallet.totalSupply();

    await nativeTokenWallet.connect(owner).withdraw(100);

    const totalSupplyAfter = await nativeTokenWallet.totalSupply();

    expect(totalSupplyAfter).to.equal(totalSupplyBefore - BigInt(100));
  });
});
