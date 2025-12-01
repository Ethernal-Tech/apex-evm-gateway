import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";
import { token } from "../typechain-types/@openzeppelin/contracts";

describe("Transfering MintBurn tokens", function () {
  describe("Deposit/Minting of MintBurn tokens", function () {
    it("Should mint required amount of tokens for the receiver", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "Test Token", "TTK");

      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: any) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log: any) => log && log.name === "TokenRegistered");

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "IERC20",
        contractAddress
      );

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        dataNonCurrencyToken
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(0);

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataNonCurrencyToken
      );

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(
        decodedAmount
      );
    });
  });

  describe("Withdraw/Burn of MintBurn tokens", function () {
    it("Should revert if tokenId is not valid", async () => {
      const value = { value: ethers.parseUnits("200", "wei") };
      await expect(
        gateway
          .connect(receiver)
          .withdraw(1, receiverWithdrawNonCurrencyToken, 100, 50, value)
      )
        .to.be.revertedWithCustomError(gateway, "TokenNotRegistered")
        .withArgs(2);
    });

    it("Should burn required amount of tokens for the sender (receiver)", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "Test Token", "TTK");

      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: any) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log: any) => log && log.name === "TokenRegistered");

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "IERC20",
        contractAddress
      );

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        dataNonCurrencyToken
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(0);

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataNonCurrencyToken
      );

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(
        decodedAmount
      );

      const value = { value: ethers.parseUnits("150", "wei") };
      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawNonCurrencyToken, 100, 50, value);

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(
        decodedAmount - BigInt(receiverWithdrawNonCurrencyToken[0].amount)
      );
    });

    it("Should emit Withdraw event when ERC20 tokens are burnt", async () => {
      let tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "Test Token", "TTK");

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

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "IERC20",
        contractAddress
      );

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        dataNonCurrencyToken
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(0);

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataNonCurrencyToken
      );

      expect(await myTokenERC20.balanceOf(decodedAddress)).to.equal(
        decodedAmount
      );

      const value = { value: ethers.parseUnits("150", "wei") };
      tx = await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawNonCurrencyToken, 100, 50, value);
      receipt = await tx.wait();

      event = receipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "Withdraw"
      );

      expect(event?.args?.destinationChainId).to.equal(1);
      expect(event?.args?.sender).to.equal(receiver);
      expect(event?.args?.receivers[0].receiver).to.equal(receiver);
      expect(event?.args?.receivers[0].amount).to.equal(100);
      expect(event?.args?.fee).to.equal(100);
      expect(event?.args?.operationFee).to.equal(50);
      expect(event?.args?.value).to.equal(150);
    });
  });

  let owner: any;
  let validators: any;
  let gateway: any;
  let dataNonCurrencyToken: any;
  let receiver: any;
  let receiverWithdrawNonCurrencyToken: any;
  let receiverWithdrawCurrencyToken: any;
  let tokenId: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    validators = fixture.validators;
    gateway = fixture.gateway;
    dataNonCurrencyToken = fixture.dataNonCurrencyToken;
    receiver = fixture.receiver;
    receiverWithdrawNonCurrencyToken = fixture.receiverWithdrawNonCurrencyToken;
    receiverWithdrawCurrencyToken = fixture.receiverWithdrawCurrencyToken;
    tokenId = fixture.tokenId;
  });
});
