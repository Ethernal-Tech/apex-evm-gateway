import { NativeERC20Mintable } from "./../typechain-types/contracts/NativeERC20Mintable";
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
    const { receiver, gateway, eRC20TokenPredicate, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      gateway.connect(receiver).setDependencies(eRC20TokenPredicate.target, validatorsc.target)
    ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, eRC20TokenPredicate, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(gateway.connect(owner).setDependencies(eRC20TokenPredicate.target, validatorsc.target)).to.not.be
      .reverted;

    expect(await gateway.eRC20TokenPredicate()).to.equal(eRC20TokenPredicate.target);
    expect(await gateway.validators()).to.equal(validatorsc.target);
  });

  it("Deposit success", async () => {
    const { gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

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
    const { receiver, gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

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
  });

  it("Withdraw should fail if not enough value is submitted", async () => {
    const { receiver, gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const data = abiCoder.encode(
      ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
      [[1, blockNumber + 100, 1, [[1, address, 100]]]]
    );

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

    const value = { value: ethers.parseUnits("100", "wei") };

    await expect(gateway.connect(receiver).withdraw(1, receiverWithdraw, 100, value)).to.to.be.revertedWithCustomError(
      gateway,
      "InsufficientValue"
    );
  });

  it("Bunch of consecutive deposits then consecutive withdrawals", async () => {
    const { receiver, gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();

    let addresses = [];

    for (let i = 0; i < 100; i++) {
      addresses.push(ethers.Wallet.createRandom().address);
    }

    let dataArray = [];

    for (let i = 0; i < 100; i++) {
      const data = abiCoder.encode(
        ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
        [[i, blockNumber + 100, 1, [[1, addresses[i], 100]]]]
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
    }
  });

  it("Bunch of consecutive deposits/withraws", async () => {
    const { receiver, gateway } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();

    let addresses = [];

    for (let i = 0; i < 100; i++) {
      addresses.push(ethers.Wallet.createRandom().address);
    }

    let dataArray = [];

    for (let i = 0; i < 100; i++) {
      const data = abiCoder.encode(
        ["tuple(uint64, uint64, uint256, tuple(uint8, address, uint256)[])"],
        [[i, blockNumber + 100, 1, [[1, addresses[i], 100]]]]
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
    }
  });
});
