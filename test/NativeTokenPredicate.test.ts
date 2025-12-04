import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployGatewayFixtures,
  impersonateAsContractAndMintFunds,
} from "./fixtures";

describe("NativeTokenPredicate Contract", function () {
  it("SetDependencies should fail if Gateway or NetiveToken is Zero Address", async () => {
    await expect(
      nativeTokenPredicate
        .connect(owner)
        .setDependencies(ethers.ZeroAddress, nativeTokenWallet.target)
    )
      .to.to.be.revertedWithCustomError(
        nativeTokenPredicate,
        "NotContractAddress"
      )
      .withArgs(ethers.ZeroAddress);

    await expect(
      nativeTokenPredicate
        .connect(owner)
        .setDependencies(gateway.target, ethers.ZeroAddress)
    )
      .to.to.be.revertedWithCustomError(
        nativeTokenPredicate,
        "NotContractAddress"
      )
      .withArgs(ethers.ZeroAddress);
  });

  it("SetDependencies should faild if not called by owner", async () => {
    await expect(
      nativeTokenPredicate
        .connect(receiver)
        .setDependencies(gateway.target, nativeTokenWallet.target)
    ).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "OwnableUnauthorizedAccount"
    );
  });

  it("SetDependencies and validate initialization", async () => {
    await expect(
      nativeTokenPredicate
        .connect(owner)
        .setDependencies(gateway.target, nativeTokenWallet.target)
    ).to.not.be.reverted;

    expect(await nativeTokenPredicate.gateway()).to.equal(gateway.target);
    expect(await nativeTokenPredicate.nativeTokenWallet()).to.equal(
      nativeTokenWallet.target
    );
  });

  it("Deposit should fail if not called by Gateway", async () => {
    const address = ethers.Wallet.createRandom().address;

    await expect(
      nativeTokenPredicate
        .connect(receiver)
        .deposit(dataCurrencyToken, address, 1)
    ).to.be.revertedWithCustomError(nativeTokenPredicate, "NotGateway");
  });

  it("Deposit should fail if batch is already executed", async () => {
    const address = ethers.Wallet.createRandom().address;

    const gatewayContract = await impersonateAsContractAndMintFunds(
      await gateway.target
    );

    await nativeTokenPredicate
      .connect(gatewayContract)
      .deposit(dataCurrencyToken, address, 1);

    await expect(
      nativeTokenPredicate
        .connect(gatewayContract)
        .deposit(dataCurrencyToken, address, 1)
    ).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "BatchAlreadyExecuted"
    );
  });

  let owner: any;
  let receiver: any;
  let gateway: any;
  let nativeTokenPredicate: any;
  let nativeTokenWallet: any;
  let validatorsc: any;
  let dataCurrencyToken: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);

    owner = fixture.owner;
    receiver = fixture.receiver;
    gateway = fixture.gateway;
    nativeTokenPredicate = fixture.nativeTokenPredicate;
    nativeTokenWallet = fixture.nativeTokenWallet;
    validatorsc = fixture.validatorsc;
    dataCurrencyToken = fixture.dataCurrencyToken;
  });
});
