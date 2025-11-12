import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployGatewayFixtures,
  impersonateAsContractAndMintFunds,
} from "./fixtures";

describe("Transfering LockUnlock tokens", function () {
  describe("Deposit/Locking of LockUnlock tokens", function () {
    it("Should revert if tokenId is not valid", async () => {
      await expect(
        gateway
          .connect(validators[1])
          .deposit(
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            data,
            1
          )
      )
        .to.be.revertedWithCustomError(gateway, "TokenNotRegistered")
        .withArgs(1);
    });

    it("Should lock required amount of tokens for the receiver", async () => {
      await gateway.connect(owner).registerToken(myToken.target, "", "");

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress()
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      const receiverbalance = await myToken.balanceOf(receiver.address);
      expect(receiverbalance).to.equal(10000);

      await myToken.connect(receiver).approve(nativeTokenWallet.target, 1000);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        data
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data,
        1
      );

      await expect(myToken.balanceOf(decodedAddress)).to.eventually.equal(
        receiverbalance - decodedAmount
      );

      await expect(
        myToken.balanceOf(nativeTokenWallet.target)
      ).to.eventually.equal(decodedAmount);
    });
  });
  describe("Withdraw/Unlocking of LockUnlock tokens", function () {
    it("Should unlock required amount of tokens for the sender (receiver)", async () => {
      await gateway.connect(owner).registerToken(myToken.target, "", "");

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress()
      );

      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      await myToken.connect(receiver).approve(nativeTokenWallet.target, 1000);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        data
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data,
        1
      );

      const receiverbalance = await myToken.balanceOf(receiver.address);
      const nativeTokenWalletBalance = await myToken.balanceOf(
        nativeTokenWallet.target
      );

      const value = { value: ethers.parseUnits("200", "wei") };

      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdraw, 100, 1, value);

      await expect(
        myToken.balanceOf(receiverWithdraw[0].receiver)
      ).to.eventually.equal(
        receiverbalance + BigInt(receiverWithdraw[0].amount)
      );

      await expect(
        myToken.balanceOf(nativeTokenWallet.target)
      ).to.eventually.equal(
        nativeTokenWalletBalance - BigInt(receiverWithdraw[0].amount)
      );
    });
    it("Should emit Withdraw event when LockUnlock tokens are unlocked", async () => {
      await gateway.connect(owner).registerToken(myToken.target, "", "");

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress()
      );

      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      await myToken.connect(receiver).approve(nativeTokenWallet.target, 1000);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        data
      );

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data,
        1
      );

      const value = { value: ethers.parseUnits("200", "wei") };

      const tx = await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdraw, 100, 1, value);
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "Withdraw"
      );

      expect(event?.args?.destinationChainId).to.equal(1);
      expect(event?.args?.sender).to.equal(receiver);
      expect(event?.args?.receivers[0].receiver).to.equal(receiver);
      expect(event?.args?.receivers[0].amount).to.equal(100);
      expect(event?.args?.feeAmount).to.equal(100);
      expect(event?.args?.tokenId).to.equal(1);
    });
  });

  let owner: any;
  let validators: any;
  let gateway: any;
  let myToken: any;
  let data: any;
  let nativeTokenWallet: any;
  let receiver: any;
  let receiverWithdraw: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    validators = fixture.validators;
    gateway = fixture.gateway;
    myToken = fixture.myToken;
    data = fixture.data;
    nativeTokenWallet = fixture.nativeTokenWallet;
    receiver = fixture.receiver;
    receiverWithdraw = fixture.receiverWithdraw;
  });
});
