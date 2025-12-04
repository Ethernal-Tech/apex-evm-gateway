import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployGatewayFixtures,
  impersonateAsContractAndMintFunds,
} from "./fixtures";

describe("LockMint/UnlockBurn", function () {
  describe("Working with mixed tokens", function () {
    it("Should unlock/burn required amount of tokens for the receiver", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      let tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId + 1n, "Test Token", "TTK");

      let receipt = await tx.wait();

      let event = receipt.logs
        .map((log: any) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log: any) => log && log.name === "TokenRegistered");

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "MyToken",
        contractAddress
      );

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress()
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      //minting tokens for receiver
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

      await myToken.connect(receiver).approve(nativeTokenWalletAddress, 1001);

      const receiverBalanceToken1 = await myToken.balanceOf(receiver.address);
      const receiverBalanceToken2 = await myTokenERC20.balanceOf(
        receiver.address
      );

      const walletBalanceToken1 = await myToken.balanceOf(
        nativeTokenWalletAddress
      );

      const value = { value: ethers.parseUnits("250", "wei") };
      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawMixTokens, 100, 50, value);

      expect(await myToken.balanceOf(receiver.address)).to.equal(
        receiverBalanceToken1 - BigInt(receiverWithdrawMixTokens[1].amount)
      );

      expect(await myToken.balanceOf(nativeTokenWalletAddress)).to.equal(
        walletBalanceToken1 + BigInt(receiverWithdrawMixTokens[1].amount)
      );

      expect(await myTokenERC20.balanceOf(receiver.address)).to.equal(
        receiverBalanceToken2 - BigInt(receiverWithdrawMixTokens[2].amount)
      );
    });

    it("Should lock/mint required amount of tokens for the receiver", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      let tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId + 1n, "Test Token", "TTK");

      let receipt = await tx.wait();

      let event = receipt.logs
        .map((log: any) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log: any) => log && log.name === "TokenRegistered");

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "MyToken",
        contractAddress
      );

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress()
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      //minting tokens for receiver
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

      await myToken.connect(receiver).approve(nativeTokenWalletAddress, 1001);

      const value = { value: ethers.parseUnits("250", "wei") };
      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawMixTokens, 100, 50, value);

      await myToken.connect(receiver).approve(nativeTokenWalletAddress, 1001);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        dataMixTokens
      );

      const [tupleValue] = decoded;
      const [[, ,], [, decodedAmount1], [, decodedAmount2]] = tupleValue[3];

      const receiverBalanceToken1 = await myToken.balanceOf(receiver.address);
      const walletBalanceToken1 = await myToken.balanceOf(
        nativeTokenWalletAddress
      );

      const receiverBalanceToken2 = await myTokenERC20.balanceOf(
        receiver.address
      );

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataMixTokens
      );

      expect(await myToken.balanceOf(receiver)).to.equal(
        receiverBalanceToken1 + decodedAmount1
      );

      expect(await myToken.balanceOf(nativeTokenWalletAddress)).to.equal(
        walletBalanceToken1 - decodedAmount1
      );

      expect(await myTokenERC20.balanceOf(receiver)).to.equal(
        receiverBalanceToken2 + decodedAmount2
      );
    });
  });

  let tokenId = 2n;
  let owner: any;
  let gateway: any;
  let myToken: any;
  let dataMixTokens: any;
  let nativeTokenWallet: any;
  let receiver: any;
  let receiverWithdrawMixTokens: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    gateway = fixture.gateway;
    myToken = fixture.myToken;
    dataMixTokens = fixture.dataMixTokens;
    nativeTokenWallet = fixture.nativeTokenWallet;
    receiver = fixture.receiver;
    receiverWithdrawMixTokens = fixture.receiverWithdrawMixTokens;
  });
});
