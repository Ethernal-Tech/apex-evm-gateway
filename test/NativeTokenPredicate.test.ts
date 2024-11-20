import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";

describe("NativeTokenPredicate Contract", function () {
  it("SetDependencies should fail if Gateway or NetiveToken is Zero Address", async () => {
    const { owner, gateway, nativeTokenWallet, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeTokenPredicate.connect(owner).setDependencies(ethers.ZeroAddress, nativeTokenWallet.target)
    ).to.to.be.revertedWithCustomError(nativeTokenPredicate, "ZeroAddress");

    await expect(
      nativeTokenPredicate.connect(owner).setDependencies(gateway.target, ethers.ZeroAddress)
    ).to.to.be.revertedWithCustomError(nativeTokenPredicate, "ZeroAddress");
  });

  it("SetDependencies should faild if not called by owner", async () => {
    const { receiver, gateway, nativeTokenWallet, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeTokenPredicate.connect(receiver).setDependencies(gateway.target, nativeTokenWallet.target)
    ).to.be.revertedWithCustomError(nativeTokenPredicate, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, nativeTokenWallet, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(nativeTokenPredicate.connect(owner).setDependencies(gateway.target, nativeTokenWallet.target)).to.not
      .be.reverted;

    expect(await nativeTokenPredicate.gateway()).to.equal(gateway.target);
    expect(await nativeTokenPredicate.nativeTokenWallet()).to.equal(nativeTokenWallet.target);
  });

  it("Deposit should fail if not called by Gateway", async () => {
    const { receiver, nativeTokenPredicate, data } = await loadFixture(deployGatewayFixtures);

    const address = ethers.Wallet.createRandom().address;

    await expect(nativeTokenPredicate.connect(receiver).deposit(data, address)).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "NotGateway"
    );
  });

  it("Deposit should emit TTLExpired if TTL expired", async () => {
    const { gateway, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const dataTTLExpired = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber - 1, 1, [[1, address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    const ttlTx = await nativeTokenPredicate.connect(gatewayContract).deposit(dataTTLExpired, address);
    const ttlReceipt = await ttlTx.wait();
    const ttlEvent = ttlReceipt.logs.find((log) => log.fragment.name === "TTLExpired");
    const depositEvent = ttlReceipt.logs.find((log) => log.fragment.name === "Deposit");

    expect(ttlEvent?.args?.data).to.equal(dataTTLExpired);
    expect(depositEvent?.args?.data).to.be.undefined;
  });

  it("Deposit should fail if batch is already executed", async () => {
    const { gateway, nativeTokenPredicate, data } = await loadFixture(deployGatewayFixtures);

    const address = ethers.Wallet.createRandom().address;

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.target);

    await nativeTokenPredicate.connect(gatewayContract).deposit(data, address);

    await expect(nativeTokenPredicate.connect(gatewayContract).deposit(data, address)).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "WrongBatchId"
    );
  });

  it("Deposit success", async () => {
    const { gateway, nativeTokenPredicate, data } = await loadFixture(deployGatewayFixtures);

    const address = ethers.Wallet.createRandom().address;

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.target);

    const depositTx = await nativeTokenPredicate.connect(gatewayContract).deposit(data, address);
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

    expect(depositEvent?.args?.data).to.equal(data);
  });
});
