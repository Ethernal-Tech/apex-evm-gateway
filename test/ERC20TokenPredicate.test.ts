import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";

describe("ERC20TokenPredicate Contract", function () {
  it("SetDependencies should fail if Gateway or NetiveToken is Zero Address", async () => {
    const { owner, gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      eRC20TokenPredicate.connect(owner).setDependencies(ethers.ZeroAddress, nativeERC20Mintable.target)
    ).to.to.be.revertedWithCustomError(eRC20TokenPredicate, "ZeroAddress");

    await expect(
      eRC20TokenPredicate.connect(owner).setDependencies(gateway.target, ethers.ZeroAddress)
    ).to.to.be.revertedWithCustomError(eRC20TokenPredicate, "ZeroAddress");
  });

  it("SetDependencies should faild if not called by owner", async () => {
    const { receiver, gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      eRC20TokenPredicate.connect(receiver).setDependencies(gateway.target, nativeERC20Mintable.target)
    ).to.be.revertedWithCustomError(eRC20TokenPredicate, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(eRC20TokenPredicate.connect(owner).setDependencies(gateway.target, nativeERC20Mintable.target)).to.not
      .be.reverted;

    expect(await eRC20TokenPredicate.gateway()).to.equal(gateway.target);
    expect(await eRC20TokenPredicate.nativeToken()).to.equal(nativeERC20Mintable.target);
  });

  it("Deposit should fail if not called by Gateway", async () => {
    const { receiver, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const address = ethers.Wallet.createRandom().address;
    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

    await expect(eRC20TokenPredicate.connect(receiver).deposit(data, address)).to.be.revertedWithCustomError(
      eRC20TokenPredicate,
      "NotGateway"
    );
  });

  it("Deposit should fail if batch is already executed", async () => {
    const { gateway, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    const ttlTx = await eRC20TokenPredicate.connect(gatewayContract).deposit(data, address);
    const ttlReceipt = await ttlTx.wait();
    const ttlEvent = ttlReceipt.logs.find((log) => log.fragment.name === "TTLExpired");
    const depositEvent = ttlReceipt.logs.find((log) => log.fragment.name === "Deposit");

    expect(ttlEvent?.args?.data).to.equal(data);
    expect(depositEvent?.args?.data).to.be.undefined;
  });

  it("Deposit should emit TTLExpired if TTL expired", async () => {
    const { gateway, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber - 1, 1, [[1, address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    await expect(eRC20TokenPredicate.connect(gatewayContract).deposit(data, address)).not.to.be.rejected;
    await expect(eRC20TokenPredicate.connect(gatewayContract).deposit(data, address)).to.be.revertedWithCustomError(
      eRC20TokenPredicate,
      "BatchAlreadyExecuted"
    );
  });

  it("Deposit success", async () => {
    const { gateway, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.target);

    const depositTx = await eRC20TokenPredicate.connect(gatewayContract).deposit(data);
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

    expect(depositEvent?.args?.data).to.equal(data);
  });

  it("Withdraw sucess", async () => {
    const { gateway, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await nativeERC20Mintable.mint(gateway.target, 1000000);

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const withdrawTx = await eRC20TokenPredicate.connect(gatewayContract).withdraw(1, receiverWithdraw, 100);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

    expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
    expect(withdrawEvent?.args?.sender).to.equal(gateway.target);
    expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("something");
    expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
    expect(withdrawEvent?.args?.feeAmount).to.equal(100);
  });
});
