import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Gateway Contract", function () {
  it("SetDependencies should fail if Gateway or NetiveToken are Zero Address", async () => {
    const { owner, gateway, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      gateway.connect(owner).setDependencies(ethers.ZeroAddress, validatorsc.target)
    ).to.to.be.revertedWithCustomError(gateway, "ZeroAddress");
  });

  it("SetDependencies should fail if not called by owner", async () => {
    const { receiver, gateway, nativeTokenPredicate, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      gateway.connect(receiver).setDependencies(nativeTokenPredicate.target, validatorsc.target)
    ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, nativeTokenPredicate, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(gateway.connect(owner).setDependencies(nativeTokenPredicate.target, validatorsc.target)).to.not.be
      .reverted;

    expect(await gateway.nativeTokenPredicate()).to.equal(nativeTokenPredicate.target);
    expect(await gateway.validators()).to.equal(validatorsc.target);
  });

  it("Deposit success", async () => {
    const { owner, gateway, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[address, 100]]]]
    );

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    const depositTx = await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      data
    );
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

    expect(depositEvent?.args?.data).to.equal(data);
  });

  it("Withdraw sucess", async () => {
    const { owner, receiver, gateway, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[address, 1000]]]]
    );

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      data
    );

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const value = { value: ethers.parseUnits("200", "wei") };
    const withdrawTx = await gateway.connect(receiver).withdraw(1, receiverWithdraw, 100, value);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

    expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
    expect(withdrawEvent?.args?.sender).to.equal(receiver);
    expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("something");
    expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
    expect(withdrawEvent?.args?.feeAmount).to.equal(100);
    expect(withdrawEvent?.args?.value).to.equal(200);
  });

  it("Withdraw should fail if not enough value is submitted", async () => {
    const { owner, receiver, gateway, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[address, 1000]]]]
    );

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      data
    );

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const value = { value: ethers.parseUnits("1", "wei") };

    await expect(gateway.connect(receiver).withdraw(1, receiverWithdraw, 100, value)).to.to.be.revertedWithCustomError(
      gateway,
      "InsufficientValue"
    );
  });

  it("Bunch of consecutive deposits then consecutive withdrawals", async () => {
    const { owner, receiver, gateway, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("10", "ether"),
    });

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();

    let addresses = [];

    for (let i = 0; i < 100; i++) {
      addresses.push(ethers.Wallet.createRandom().address);
    }

    let dataArray = [];

    for (let i = 0; i < 100; i++) {
      const data = abiCoder.encode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        [[i, blockNumber + 100, 1, [[addresses[i], 200]]]]
      );
      dataArray.push(data);
    }

    const depositTXs = [];
    for (let i = 0; i < 100; i++) {
      const depositTX = await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataArray[i]
      );
      depositTXs.push(depositTX);
    }

    for (let i = 0; i < 100; i++) {
      const depositReceipt = await depositTXs[i].wait();
      const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

      expect(depositEvent?.args?.data).to.equal(dataArray[i]);
    }

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const value = { value: ethers.parseUnits("200", "wei") };

    for (let i = 0; i < 100; i++) {
      const withdrawTx = await gateway.connect(receiver).withdraw(1, receiverWithdraw, 100, value);
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

      expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
      expect(withdrawEvent?.args?.sender).to.equal(receiver);
      expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("something");
      expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
      expect(withdrawEvent?.args?.feeAmount).to.equal(100);
      expect(withdrawEvent?.args?.value).to.equal(200);
    }
  });

  it("Bunch of consecutive deposits/withraws", async () => {
    const { owner, receiver, gateway, nativeTokenWallet } = await loadFixture(deployGatewayFixtures);

    const gatewayContractAddress = await gateway.getAddress();

    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await owner.sendTransaction({
      to: gatewayContractAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    await owner.sendTransaction({
      to: nativeTokenWalletAddress,
      value: ethers.parseUnits("1", "ether"),
    });

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();

    let addresses = [];

    for (let i = 0; i < 100; i++) {
      addresses.push(ethers.Wallet.createRandom().address);
    }

    let dataArray = [];

    for (let i = 0; i < 100; i++) {
      const data = abiCoder.encode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        [[i, blockNumber + 100, 1, [[addresses[i], 200]]]]
      );
      dataArray.push(data);
    }

    const depositTXs = [];
    for (let i = 0; i < 100; i++) {
      const depositTX = await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataArray[i]
      );
      depositTXs.push(depositTX);
    }

    const receiverWithdraw = [
      {
        receiver: "something",
        amount: 100,
      },
    ];

    const value = { value: ethers.parseUnits("200", "wei") };

    for (let i = 0; i < 100; i++) {
      const depositReceipt = await depositTXs[i].wait();
      const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

      expect(depositEvent?.args?.data).to.equal(dataArray[i]);

      const withdrawTx = await gateway.connect(receiver).withdraw(1, receiverWithdraw, 100, value);
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

      expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
      expect(withdrawEvent?.args?.sender).to.equal(receiver);
      expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("something");
      expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
      expect(withdrawEvent?.args?.feeAmount).to.equal(100);
      expect(withdrawEvent?.args?.value).to.equal(200);
    }
  });
});
