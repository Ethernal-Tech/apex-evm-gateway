import hre from "hardhat";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("NativeTokenWallet Contract", function () {
  it("SetDependencies should fail if Predicate is Zero Address", async () => {
    await expect(
      nativeTokenWallet.connect(owner).setDependencies(ethers.ZeroAddress),
    )
      .to.be.revertedWithCustomError(nativeTokenWallet, "NotContractAddress")
      .withArgs(ethers.ZeroAddress);
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
    expect(await nativeTokenWallet.predicateAddress()).to.equal(
      nativeTokenPredicate.target,
    );
    expect(await nativeTokenWallet.owner()).to.equal(owner.address);
  });

  it("Mint will fail if not called by Predicate or Owner", async function () {
    await expect(
      nativeTokenWallet.deposit(receiver.address, 100, 1, true),
    ).to.be.revertedWithCustomError(nativeTokenWallet, "NotPredicate");
  });

  it("Deposit success", async function () {
    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    const receiverBalanceBefore = await ethers.provider.getBalance(receiver);
    const nativeTokenWalletBefore = await ethers.provider.getBalance(
      nativeTokenWalletAddress,
    );

    const nativeTokenPredicateContract =
      await impersonateAsContractAndMintFunds(
        await nativeTokenPredicate.target,
      );

    await nativeTokenWallet
      .connect(nativeTokenPredicateContract)
      .deposit(receiver.address, randomAmount, 1, true);

    const receiverBalanceAfter = await ethers.provider.getBalance(receiver);
    const nativeTokenWalletAfter = await ethers.provider.getBalance(
      nativeTokenWalletAddress,
    );

    expect(receiverBalanceAfter).to.equal(
      receiverBalanceBefore + BigInt(randomAmount),
    );
    expect(nativeTokenWalletAfter).to.equal(
      nativeTokenWalletBefore - BigInt(randomAmount),
    );
  });

  async function impersonateAsContractAndMintFunds(contractAddress) {
    const address = contractAddress.toLowerCase();

    // impersonate as a contract on specified address
    await provider.send("hardhat_impersonateAccount", [address]);

    const signer = await ethers.getSigner(address);

    // minting 100000000000000000000 tokens to signer
    await provider.send("hardhat_setBalance", [
      signer.address,
      "0x56BC75E2D63100000",
    ]);

    return signer;
  }

  let gateway;
  let nativeTokenPredicate;
  let nativeTokenWallet;
  let validatorsc;
  let owner;
  let receiver;
  let validators;
  let provider;
  let ethers;
  let fixture;

  beforeEach(async function () {
    fixture = await deployGatewayFixtures(hre);

    gateway = fixture.gateway;
    nativeTokenPredicate = fixture.nativeTokenPredicate;
    nativeTokenWallet = fixture.nativeTokenWallet;
    validatorsc = fixture.validatorsc;
    owner = fixture.owner;
    receiver = fixture.receiver;
    validators = fixture.validators;
    provider = fixture.provider;
    ethers = fixture.ethers;
  });
});
