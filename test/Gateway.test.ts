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

    // withdraw start
    const eip712domain_type_definition = {
      EIP712Domain: [
        {
          name: "name",
          type: "string",
        },
        {
          name: "version",
          type: "string",
        },
        {
          name: "chainId",
          type: "uint256",
        },
        {
          name: "verifyingContract",
          type: "address",
        },
        {
          name: "salt",
          type: "butes32",
        },
      ],
    };

    const chainId = (await ethers.provider.getNetwork()).chainId;

    const eip712domain_domain = {
      name: "Apex EVM Gateway",
      version: "1",
      chainId: chainId,
      verifyingContract: gateway.target,
      salt: "0x617065782d65766d2d6761746577617900000000000000000000000000000000",
    };

    const withdraw_request = {
      types: {
        ...eip712domain_type_definition,
        WithdrawRequest: [
          {
            name: "to",
            type: "address",
          },
          {
            name: "amount",
            type: "uint256",
          },
        ],
      },
      primaryType: "TransferRequest",
      domain: karma_request_domain,
      message: {
        to: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
        amount: 1234,
      },
    };
    let signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [accounts[0], transfer_request],
    });

    const withdraw_request = {
      types: {
        ...eip712domain_type_definition,
        WithdrawalRequest: [
          {
            name: "to",
            type: "address",
          },
          {
            name: "amount",
            type: "uint256",
          },
        ],
      },
      primaryType: "TransferRequest",
      domain: karma_request_domain,
      message: {
        to: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
        amount: 1234,
      },
    };
    let signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [accounts[0], transfer_request],
    });
    // withdraw end

    const signature =
      "0x1c4509ccf4268a2473492289ad0570117607db35455b8da02047c32921c7fd9d2374d70e4a1e9f0a465352c3394244c980441aba26b8909e100bae35970081ddff";

    const withdrawals = {
      nonce: 123,
      feeAmount: 1,
      sender: receiver,
      destinationChainId: 1,
      receivers: [
        {
          receiver: "receiver1",
          amount: 100,
        },
        {
          receiver: "receiver2",
          amount: 200,
        },
      ],
    };

    const withdrawTx = await gateway.connect(receiver).withdraw(withdrawals, signature);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

    expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
    expect(withdrawEvent?.args?.sender).to.equal(receiver);
    expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("receiver1");
    expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
    expect(withdrawEvent?.args?.receivers[1].receiver).to.equal("receiver2");
    expect(withdrawEvent?.args?.receivers[1].amount).to.equal(200);
    expect(withdrawEvent?.args?.feeAmount).to.equal(1);
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

    const signature =
      "0x1c4509ccf4268a2473492289ad0570117607db35455b8da02047c32921c7fd9d2374d70e4a1e9f0a465352c3394244c980441aba26b8909e100bae35970081ddff";

    const withdrawals = {
      nonce: 123,
      feeAmount: 1,
      sender: receiver,
      destinationChainId: 1,
      receivers: [
        {
          receiver: "receiver1",
          amount: 100,
        },
        {
          receiver: "receiver2",
          amount: 200,
        },
      ],
    };

    for (let i = 0; i < 100; i++) {
      const withdrawTx = await gateway.connect(receiver).withdraw(withdrawals, signature);
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

      expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
      expect(withdrawEvent?.args?.sender).to.equal(receiver);
      expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("receiver1");
      expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
      expect(withdrawEvent?.args?.receivers[1].receiver).to.equal("receiver2");
      expect(withdrawEvent?.args?.receivers[1].amount).to.equal(200);
      expect(withdrawEvent?.args?.feeAmount).to.equal(1);
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

    const signature =
      "0x1c4509ccf4268a2473492289ad0570117607db35455b8da02047c32921c7fd9d2374d70e4a1e9f0a465352c3394244c980441aba26b8909e100bae35970081ddff";

    const withdrawals = {
      nonce: 123,
      feeAmount: 1,
      sender: receiver,
      destinationChainId: 1,
      receivers: [
        {
          receiver: "receiver1",
          amount: 100,
        },
        {
          receiver: "receiver2",
          amount: 200,
        },
      ],
    };

    for (let i = 0; i < 100; i++) {
      const depositReceipt = await depositTXs[i].wait();
      const depositEvent = depositReceipt.logs.find((log) => log.fragment && log.fragment.name === "Deposit");

      expect(depositEvent?.args?.data).to.equal(dataArray[i]);

      const withdrawTx = await gateway.connect(receiver).withdraw(withdrawals, signature);
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawEvent = withdrawReceipt.logs.find((log) => log.fragment && log.fragment.name === "Withdraw");

      expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
      expect(withdrawEvent?.args?.sender).to.equal(receiver);
      expect(withdrawEvent?.args?.receivers[0].receiver).to.equal("receiver1");
      expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
      expect(withdrawEvent?.args?.receivers[1].receiver).to.equal("receiver2");
      expect(withdrawEvent?.args?.receivers[1].amount).to.equal(200);
      expect(withdrawEvent?.args?.feeAmount).to.equal(1);
    }
  });
});
