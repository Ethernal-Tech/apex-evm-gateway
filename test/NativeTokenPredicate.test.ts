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
    const { receiver, nativeTokenPredicate } = await loadFixture(deployGatewayFixtures);

    const address = ethers.Wallet.createRandom().address;
    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

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
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber - 1, 1, [[1, address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    const ttlTx = await nativeTokenPredicate.connect(gatewayContract).deposit(data, address);
    const ttlReceipt = await ttlTx.wait();
    const ttlEvent = ttlReceipt.logs.find((log) => log.fragment.name === "TTLExpired");
    const depositEvent = ttlReceipt.logs.find((log) => log.fragment.name === "Deposit");

    expect(ttlEvent?.args?.data).to.equal(data);
    expect(depositEvent?.args?.data).to.be.undefined;
  });

  it("Deposit should fail if batch is already executed", async () => {
    const { gateway, owner, nativeTokenPredicate, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.target);

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: gatewayContract,
      value: ethers.parseUnits("1", "ether"),
    });

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    await nativeTokenPredicate.connect(gatewayContract).deposit(data, address);

    await expect(nativeTokenPredicate.connect(gatewayContract).deposit(data, address)).to.be.revertedWithCustomError(
      nativeTokenPredicate,
      "BatchAlreadyExecuted"
    );
  });

  it("Deposit success", async () => {
    const { owner, gateway, nativeTokenPredicate, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.target);

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: gatewayContract,
      value: ethers.parseUnits("1", "ether"),
    });

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    const depositTx = await nativeTokenPredicate.connect(gatewayContract).deposit(data, address);
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

    expect(depositEvent?.args?.data).to.equal(data);
  });

  it("Withdraw sucess", async () => {
    const { owner, receiver, gateway, nativeTokenWallet, nativeTokenPredicate } = await loadFixture(
      deployGatewayFixtures
    );

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    const randomAmount = Math.floor(Math.random() * 1000000 + 1);

    await nativeTokenWallet.deposit(owner.address, randomAmount);

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const withdrawTx = await nativeTokenPredicate
      .connect(gatewayContract)
      .withdraw(1, receiverWithdraw, 100, receiver, 200, 200);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

    expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
    expect(withdrawEvent?.args?.sender).to.equal(receiver);
    expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("something");
    expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
    expect(withdrawEvent?.args?.feeAmount).to.equal(100);
    expect(withdrawEvent?.args?.value).to.equal(200);
  });
});
