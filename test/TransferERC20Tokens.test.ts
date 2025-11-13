import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Transfering MintBurn tokens", function () {
  describe("Deposit/Minting of MintBurn tokens", function () {
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

    it("Should mint required amount of tokens for the receiver", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK");

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
        data
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        0
      );

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data,
        1
      );

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        decodedAmount
      );
    });
  });
  describe("Withdraw/Burn of MintBurn tokens", function () {
    it("Should revert if tokenId is not valid", async () => {
      const value = { value: ethers.parseUnits("200", "wei") };
      await expect(
        gateway.connect(receiver).withdraw(1, receiverWithdraw, 100, 1, value)
      )
        .to.be.revertedWithCustomError(gateway, "TokenNotRegistered")
        .withArgs(1);
    });

    it("Should revert with InvalidBurnAddress if function caller is not 'receiver'", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK");

      const value = { value: ethers.parseUnits("200", "wei") };
      await expect(gateway.withdraw(1, receiverWithdraw, 100, 1, value))
        .to.be.revertedWithCustomError(gateway, "InvalidBurnOrLockAddress")
        .withArgs(receiver.address);
    });

    it("Should revert with there is more then one address to burn MintBurn tokens from", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK");

      const receiverWithdrawDouble = [
        {
          receiver: receiver.address,
          amount: 100,
        },
        {
          receiver: receiver.address,
          amount: 100,
        },
      ];

      const value = { value: ethers.parseUnits("200", "wei") };
      await expect(gateway.withdraw(1, receiverWithdrawDouble, 100, 1, value))
        .to.be.revertedWithCustomError(
          gateway,
          "InvalidNumberOfBurnOrLockAddresses"
        )
        .withArgs(2);
    });

    it("Should burn required amount of tokens for the sender (receiver)", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK");

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
        data
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        0
      );

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data,
        1
      );

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        decodedAmount
      );

      const value = { value: ethers.parseUnits("200", "wei") };
      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdraw, 100, 1, value);

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        decodedAmount - BigInt(receiverWithdraw[0].amount)
      );
    });

    it("Should emit Withdraw event when tokens are ERC20 tokens are burnt", async () => {
      let tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK");

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
        ["tuple(uint64, uint64, uint256, tuple(address, uint256)[])"],
        data
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        0
      );

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data,
        1
      );

      await expect(myTokenERC20.balanceOf(decodedAddress)).to.eventually.equal(
        decodedAmount
      );

      const value = { value: ethers.parseUnits("200", "wei") };
      tx = await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdraw, 100, 1, value);
      receipt = await tx.wait();

      event = receipt.logs.find(
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

  const tokenID = 1
  let owner: any;
  let validators: any;
  let gateway: any;
  let data: any;
  let receiver: any;
  let receiverWithdraw: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    validators = fixture.validators;
    gateway = fixture.gateway;
    data = fixture.data;
    receiver = fixture.receiver;
    receiverWithdraw = fixture.receiverWithdraw;
  });
});
