import hre from "hardhat";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("NativeTokenWallet Contract", function () {
  it("SetDependencies should fail if Predicate is Zero Address", async () => {
    await expect(
      nativeTokenWallet
        .connect(owner)
        .setDependencies(connection.ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(nativeTokenWallet, "ZeroAddress");
  });

  it("SetDependencies will fail if not called by owner", async () => {
    await expect(
      nativeTokenWallet
        .connect(receiver)
        .setDependencies(nativeTokenPredicate.target),
    ).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "OwnableUnauthorizedAccount",
    );
  });

  it("SetDependencies and validate initialization", async () => {
    await expect(
      nativeTokenWallet
        .connect(owner)
        .setDependencies(nativeTokenPredicate.target),
    ).to.not.be.revert(ethers);
    expect(await nativeTokenWallet.predicate()).to.equal(
      nativeTokenPredicate.target,
    );
    expect(await nativeTokenWallet.owner()).to.equal(owner.address);
  });

  it("Mint will fail if not called by Predicate or Owner", async function () {
    await expect(
      nativeTokenWallet.connect(receiver).deposit(receiver.address, 100),
    ).to.be.revertedWithCustomError(nativeTokenWallet, "NotPredicateOrOwner");
  });

  it("Deposit success", async function () {
    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    const receiverBalanceBefore = await provider.getBalance(receiver);
    const nativeTokenWalletBefore = await provider.getBalance(
      nativeTokenWalletAddress,
    );

    await nativeTokenWallet.deposit(receiver.address, randomAmount);

    const receiverBalanceAfter = await provider.getBalance(receiver);
    const nativeTokenWalletAfter = await provider.getBalance(
      nativeTokenWalletAddress,
    );

    expect(receiverBalanceAfter).to.equal(
      receiverBalanceBefore + BigInt(randomAmount),
    );
    expect(nativeTokenWalletAfter).to.equal(
      nativeTokenWalletBefore - BigInt(randomAmount),
    );
  });

  let gateway;
  let nativeTokenPredicate;
  let nativeTokenWallet;
  let validatorsc;
  let owner;
  let receiver;
  let provider;
  let fixture;
  let connection;
  let ethers;

  beforeEach(async function () {
    fixture = await deployGatewayFixtures(hre);

    gateway = fixture.gateway;
    nativeTokenPredicate = fixture.nativeTokenPredicate;
    nativeTokenWallet = fixture.nativeTokenWallet;
    validatorsc = fixture.validatorsc;
    owner = fixture.owner;
    receiver = fixture.receiver;
    provider = fixture.provider;
    connection = fixture.connection;
    ethers = fixture.ethers;
  });
});
