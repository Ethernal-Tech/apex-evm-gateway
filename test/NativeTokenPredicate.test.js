import hre from "hardhat";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("NativeTokenPredicate Contract", function () {
  it("SetDependencies should fail if Gateway or NetiveToken is Zero Address", async () => {
    await expect(
      nativeTokenPredicate
        .connect(owner)
        .setDependencies(
          connection.ethers.ZeroAddress,
          nativeTokenWallet.target
        )
    ).to.to.be.revertedWithCustomError(nativeTokenPredicate, "ZeroAddress");

    await expect(
      nativeTokenPredicate
        .connect(owner)
        .setDependencies(gateway.target, connection.ethers.ZeroAddress)
    ).to.to.be.revertedWithCustomError(nativeTokenPredicate, "ZeroAddress");
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
    ).to.not.be.revert(ethers);

    expect(await nativeTokenPredicate.gateway()).to.equal(gateway.target);
    expect(await nativeTokenPredicate.nativeTokenWallet()).to.equal(
      nativeTokenWallet.target
    );
  });

  it("Deposit should fail if not called by Gateway", async () => {
    const address = ethers.Wallet.createRandom().address;

    await expect(
      nativeTokenPredicate.connect(receiver).deposit(data, address)
    ).to.be.revertedWithCustomError(nativeTokenPredicate, "NotGateway");
  });

  it("Deposit should fail if batch is already executed", async () => {
    const address = ethers.Wallet.createRandom().address;

    const gatewayContract = await impersonateAsContractAndMintFunds(
      await gateway.target
    );

    await nativeTokenPredicate.connect(gatewayContract).deposit(data, address);

    await expect(
      nativeTokenPredicate.connect(gatewayContract).deposit(data, address)
    ).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "BatchAlreadyExecuted"
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
  let data;
  let fixture;
  let connection;
  let ethers;
  let provider;

  beforeEach(async function () {
    fixture = await deployGatewayFixtures(hre);

    gateway = fixture.gateway;
    nativeTokenPredicate = fixture.nativeTokenPredicate;
    nativeTokenWallet = fixture.nativeTokenWallet;
    validatorsc = fixture.validatorsc;
    owner = fixture.owner;
    receiver = fixture.receiver;
    data = fixture.data;
    connection = fixture.connection;
    ethers = fixture.ethers;
    provider = fixture.provider;
  });
});
