import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Register tokens tests", function () {
  describe("Register LockUnlock tokens", function () {
    it("Should revert if registerToken is not called by Owner", async () => {
      await expect(
        gateway.connect(validators[1]).registerToken(ethers.ZeroAddress, "", "")
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("Should revert if _lockUnlockSCAddress is not zero and not contract address", async () => {
      await expect(gateway.connect(owner).registerToken(owner, "", ""))
        .to.be.revertedWithCustomError(gateway, "NotContractAddress")
        .withArgs(owner);
    });

    it("Should increase tokenIdCounter on register LockUnlock token success", async () => {
      const tokenIdBefore = await gateway.tokenIdCounter();

      expect(await gateway.connect(owner).registerToken(myToken.target, "", ""))
        .not.to.be.reverted;

      expect(await gateway.tokenIdCounter()).to.equal(
        tokenIdBefore + BigInt(1)
      );
    });

    it("Should set tokenAddress on register LockUnlock token success", async () => {
      await gateway.connect(owner).registerToken(myToken.target, "", "");

      expect(
        await nativeTokenWallet.tokenAddress(await gateway.tokenIdCounter())
      ).to.equal(myToken.target);
    });

    it("Should set isLockUnlockToken to true when register LockUnlock token is success", async () => {
      await gateway.connect(owner).registerToken(myToken.target, "", "");

      expect(
        await nativeTokenWallet.isLockUnlockToken(
          await gateway.tokenIdCounter()
        )
      ).to.equal(true);
    });

    it("Should emit TokenRegistered event when new LockUnlock token is registered", async () => {
      await expect(gateway.connect(owner).registerToken(myToken.target, "", ""))
        .to.emit(gateway, "TokenRegistered")
        .withArgs("", "", 1, myToken.target, true);
    });

    it("Should revert if LockUnlock token is already registered", async () => {
      await expect(gateway.connect(owner).registerToken(myToken.target, "", ""))
        .not.to.be.reverted;

      await expect(gateway.connect(owner).registerToken(myToken.target, "", ""))
        .to.be.revertedWithCustomError(
          nativeTokenWallet,
          "TokenAddressAlreadyRegistered"
        )
        .withArgs(myToken.target);
    });
  });
  describe("Register MintBurn token", function () {
    it("Should revert if createToken is not called by Gateway", async () => {
      await expect(
        tokenFactory.connect(validators[1]).createToken("", "")
      ).to.be.revertedWithCustomError(tokenFactory, "NotGateway");
    });
    it("Should increase tokenIdCounter on register MintBurn token success", async () => {
      const tokenIdBefore = await gateway.tokenIdCounter();

      expect(
        await gateway
          .connect(owner)
          .registerToken(ethers.ZeroAddress, "Test Token", "TTK")
      ).not.to.be.reverted;

      expect(await gateway.tokenIdCounter()).to.equal(
        tokenIdBefore + BigInt(1)
      );

      expect(
        await gateway
          .connect(owner)
          .registerToken(ethers.ZeroAddress, "Test Token2", "TTK2")
      ).not.to.be.reverted;

      expect(await gateway.tokenIdCounter()).to.equal(
        tokenIdBefore + BigInt(2)
      );
    });

    it("Should set isLockUnlockToken to false when register MintBurn token is success", async () => {
      await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, "Test Token", "TTK");

      expect(
        await nativeTokenWallet.isLockUnlockToken(
          await gateway.tokenIdCounter()
        )
      ).to.equal(false);
    });

    it("Should set tokenAddress on register MintBurn token", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, "Test Token", "TTK");

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

      const contractAddress = event.args.contractAddress;

      expect(
        await nativeTokenWallet.tokenAddress(await gateway.tokenIdCounter())
      ).to.equal(contractAddress);
    });

    it("Should emit tokenRegistered event when new MintBurn token is registered", async () => {
      await expect(
        gateway
          .connect(owner)
          .registerToken(ethers.ZeroAddress, "Test Token", "TTK")
      )
        .to.emit(gateway, "TokenRegistered")
        .withArgs("Test Token", "TTK", 1, anyValue, false);
    });
  });

  let owner: any;
  let validators: any;
  let gateway: any;
  let myToken: any;
  let tokenFactory: any;

  let nativeTokenWallet: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    validators = fixture.validators;
    gateway = fixture.gateway;
    myToken = fixture.myToken;
    tokenFactory = fixture.tokenFactory;
    nativeTokenWallet = fixture.nativeTokenWallet;
  });
});
