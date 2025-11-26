import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Gateway Contract", function () {
  it("SetDependencies should fail if Gateway or NetiveToken are Zero Address", async () => {
    await expect(
      gateway
        .connect(owner)
        .setDependencies(
          ethers.ZeroAddress,
          tokenFactory.target,
          validatorsc.target
        )
    )
      .to.to.be.revertedWithCustomError(gateway, "NotContractAddress")
      .withArgs(ethers.ZeroAddress);
  });

  it("SetDependencies should fail if not called by owner", async () => {
    await expect(
      gateway
        .connect(receiver)
        .setDependencies(
          nativeTokenPredicate.target,
          tokenFactory.target,
          validatorsc.target
        )
    ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
  });

  it("SetDependencies and validate initialization", async () => {
    await expect(
      gateway
        .connect(owner)
        .setDependencies(
          nativeTokenPredicate.target,
          tokenFactory.target,
          validatorsc.target
        )
    ).to.not.be.reverted;

    expect(await gateway.nativeTokenPredicate()).to.equal(
      nativeTokenPredicate.target
    );
    expect(await gateway.validators()).to.equal(validatorsc.target);
  });

  it("Deposit success", async () => {
    const depositTx = await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      dataZeroToken
    );
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "Deposit"
    );

    expect(depositEvent?.args?.data).to.equal(dataZeroToken);
  });

  it("Withdraw sucess", async () => {
    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      dataZeroToken
    );

    const nativeTokenWalletBefore = await ethers.provider.getBalance(
      nativeTokenWalletAddress
    );

    const value = { value: ethers.parseUnits("200", "wei") };
    const withdrawTx = await gateway
      .connect(receiver)
      .withdraw(1, receiverWithdrawZeroToken, 100, value);
    const withdrawReceipt = await withdrawTx.wait();
    const withdrawEvent = withdrawReceipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "Withdraw"
    );

    const nativeTokenWalletAfter = await ethers.provider.getBalance(
      nativeTokenWalletAddress
    );

    expect(nativeTokenWalletAfter).to.equal(
      nativeTokenWalletBefore + BigInt(200)
    );

    expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
    expect(withdrawEvent?.args?.sender).to.equal(receiver);
    expect(withdrawEvent?.args?.receivers[0].receiver).to.equal(
      receiver.address
    );
    expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
    expect(withdrawEvent?.args?.feeAmount).to.equal(100);
    expect(withdrawEvent?.args?.value).to.equal(200);
  });

  it("Withdraw should fail if not enough value is submitted", async () => {
    await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      dataZeroToken
    );

    const value = { value: ethers.parseUnits("1", "wei") };

    await expect(
      gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawZeroToken, 100, value)
    ).to.to.be.revertedWithCustomError(gateway, "WrongValue");
  });

  it("Set feeAmount should fail if not called by owner", async () => {
    await expect(
      gateway.connect(receiver).setMinAmounts(200, 100)
    ).to.to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
  });

  it("Set feeAmount should succeed if called by owner", async () => {
    expect(await gateway.minFeeAmount()).to.equal(100);
    await gateway.connect(owner).setMinAmounts(200, 100);
    expect(await gateway.minFeeAmount()).to.equal(200);
    expect(await gateway.minBridgingAmount()).to.equal(100);
  });

  it("Withdraw should fail if briding amount is less then minBridgingAmount", async () => {
    await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      dataZeroToken
    );

    const value = { value: ethers.parseUnits("1", "wei") };

    const receiverWithdrawZeroTokenInvalidAmount = structuredClone(
      receiverWithdrawZeroToken
    );
    receiverWithdrawZeroTokenInvalidAmount[0].amount = 1;

    await expect(
      gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawZeroTokenInvalidAmount, 100, value)
    ).to.to.be.revertedWithCustomError(gateway, "InvalidBridgingAmount");
  });

  it("Withdraw should fail if colored coin briding amount is less then minBridgingAmount", async () => {
    await gateway.connect(owner).registerToken(myToken.target, tokenID, "", "");

    const value = { value: ethers.parseUnits("1", "wei") };

    const receiverWithdrawNonZeroTokenInvalidAmount = structuredClone(
      receiverWithdrawNonZeroToken
    );
    receiverWithdrawNonZeroTokenInvalidAmount[0].amount = 1;

    await expect(
      gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawNonZeroTokenInvalidAmount, 100, value)
    ).to.to.be.revertedWithCustomError(gateway, "InvalidBridgingAmount");
  });

  it("Bunch of consecutive deposits then consecutive withdrawals", async () => {
    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();

    let addresses = [];

    for (let i = 0; i < 100; i++) {
      addresses.push(ethers.Wallet.createRandom().address);
    }

    let dataArray = [];

    for (let i = 0; i < 100; i++) {
      const data = abiCoder.encode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        [[i + 1, blockNumber + 100, 1, [[addresses[i], 200, 0]]]]
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
      const depositEvent = depositReceipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "Deposit"
      );

      expect(depositEvent?.args?.data).to.equal(dataArray[i]);
    }

    const value = { value: ethers.parseUnits("200", "wei") };

    const nativeTokenWalletBefore = await ethers.provider.getBalance(
      nativeTokenWalletAddress
    );

    for (let i = 0; i < 100; i++) {
      const withdrawTx = await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawZeroToken, 100, value);
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawEvent = withdrawReceipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "Withdraw"
      );

      let nativeTokenWalletAfter = await ethers.provider.getBalance(
        nativeTokenWalletAddress
      );

      expect(nativeTokenWalletAfter).to.equal(
        nativeTokenWalletBefore + BigInt(200 * (i + 1))
      );

      expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
      expect(withdrawEvent?.args?.sender).to.equal(receiver);
      expect(withdrawEvent?.args?.receivers[0].receiver).to.equal(
        receiver.address
      );
      expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
      expect(withdrawEvent?.args?.feeAmount).to.equal(100);
      expect(withdrawEvent?.args?.value).to.equal(200);
    }
  });

  it("Bunch of consecutive deposits/withraws", async () => {
    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();

    let addresses = [];

    for (let i = 0; i < 100; i++) {
      addresses.push(ethers.Wallet.createRandom().address);
    }

    let dataArray = [];

    for (let i = 0; i < 100; i++) {
      const data = abiCoder.encode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        [[i + 1, blockNumber + 100, 1, [[addresses[i], 200, 0]]]]
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

    const value = { value: ethers.parseUnits("200", "wei") };

    let nativeTokenWalletBefore = await ethers.provider.getBalance(
      nativeTokenWalletAddress
    );

    for (let i = 0; i < 100; i++) {
      const depositReceipt = await depositTXs[i].wait();
      const depositEvent = depositReceipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "Deposit"
      );

      expect(depositEvent?.args?.data).to.equal(dataArray[i]);

      const withdrawTx = await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawZeroToken, 100, value);
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawEvent = withdrawReceipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "Withdraw"
      );

      let nativeTokenWalletAfter = await ethers.provider.getBalance(
        nativeTokenWalletAddress
      );

      expect(nativeTokenWalletAfter).to.equal(
        nativeTokenWalletBefore + BigInt(200 * (i + 1))
      );

      expect(withdrawEvent?.args?.destinationChainId).to.equal(1);
      expect(withdrawEvent?.args?.sender).to.equal(receiver);
      expect(withdrawEvent?.args?.receivers[0].receiver).to.equal(
        receiver.address
      );
      expect(withdrawEvent?.args?.receivers[0].amount).to.equal(100);
      expect(withdrawEvent?.args?.feeAmount).to.equal(100);
      expect(withdrawEvent?.args?.value).to.equal(200);
    }
  });
  it("Direct Deposit should emit FundsDeposited event", async function () {
    const gatewayAddress = await gateway.getAddress();
    const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

    const nativeTokenWalletBefore = await ethers.provider.getBalance(
      nativeTokenWalletAddress
    );

    await expect(
      owner.sendTransaction({
        to: gatewayAddress,
        value: ethers.parseUnits("100", "wei"),
      })
    )
      .to.emit(gateway, "FundsDeposited")
      .withArgs(owner.address, 100);

    const nativeTokenWalletAfter = await ethers.provider.getBalance(
      nativeTokenWalletAddress
    );

    expect(nativeTokenWalletAfter).to.equal(nativeTokenWalletBefore + 100n);
  });

  it("Deposit should emit TTLExpired if TTL expired", async () => {
    const blockNumber = await ethers.provider.getBlockNumber();
    const abiCoder = new ethers.AbiCoder();
    const address = ethers.Wallet.createRandom().address;
    const dataTTLExpired = abiCoder.encode(
      [
        "tuple(uint64, uint64, uint256, tuple(uint8, address, uint256, uint256)[])",
      ],
      [[1, blockNumber - 1, 1, [[1, address, 100, 0]]]]
    );

    const depositTx = await gateway.deposit(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      dataTTLExpired
    );
    const depositReceipt = await depositTx.wait();
    const ttlEvent = depositReceipt.logs.find(
      (log: any) => log.fragment.name === "TTLExpired"
    );
    const depositEvent = depositReceipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "Deposit"
    );

    expect(ttlEvent?.args?.data).to.equal(dataTTLExpired);
    expect(depositEvent?.args?.data).to.be.undefined;
  });

  let tokenID = 1;
  let owner: any;
  let receiver: any;
  let gateway: any;
  let nativeTokenPredicate: any;
  let nativeTokenWallet: any;
  let tokenFactory: any;
  let validatorsc: any;
  let receiverWithdrawZeroToken: any;
  let receiverWithdrawNonZeroToken: any;
  let dataZeroToken: any;
  let dataNonZeroToken: any;
  let myToken: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);

    owner = fixture.owner;
    receiver = fixture.receiver;
    gateway = fixture.gateway;
    nativeTokenPredicate = fixture.nativeTokenPredicate;
    nativeTokenWallet = fixture.nativeTokenWallet;
    tokenFactory = fixture.tokenFactory;
    validatorsc = fixture.validatorsc;
    receiverWithdrawZeroToken = fixture.receiverWithdrawZeroToken;
    receiverWithdrawNonZeroToken = fixture.receiverWithdrawNonZeroToken;
    dataZeroToken = fixture.dataZeroToken;
    dataNonZeroToken = fixture.dataNonZeroToken;
    myToken = fixture.myToken;
  });
});
