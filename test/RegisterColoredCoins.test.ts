import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Register tokens tests", function () {
  describe("Register LockUnlock tokens", function () {
    it("Should revert if registerToken is not called by Owner", async () => {
      await expect(
        gateway.connect(validators[1]).registerToken(ethers.ZeroAddress, tokenID, "", "")
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("Should revert if _lockUnlockSCAddress is not zero and not contract address", async () => {
      await expect(gateway.connect(owner).registerToken(owner, tokenID, "", ""))
        .to.be.revertedWithCustomError(gateway, "NotContractAddress")
        .withArgs(owner);
    });

    it("Should revert if register token with zero token id", async () => {
      await expect(gateway.connect(owner).registerToken(myToken.target, 0, "", ""))
        .to.be.revertedWithCustomError(gateway, "ZeroTokenId");
    });

    it("Should revert if register token with the same token id", async () => {
      expect(await gateway.connect(owner).registerToken(myToken.target, tokenID, "", ""))
        .not.to.be.reverted;

      await expect(gateway.connect(owner).registerToken(myToken.target, tokenID, "", ""))
        .to.be.revertedWithCustomError(gateway, "TokenIdAlreadyRegistered")
        .withArgs(tokenID);
    });

    it("Should set tokenAddress on register LockUnlock token success", async () => {
      await gateway.connect(owner).registerToken(myToken.target, tokenID, "", "");

      expect(
        await nativeTokenWallet.tokenAddress(tokenID)
      ).to.equal(myToken.target);
    });

    it("Should set isLockUnlockToken to true when register LockUnlock token is success", async () => {
      await gateway.connect(owner).registerToken(myToken.target, tokenID, "", "");

      expect(
        await nativeTokenWallet.isLockUnlockToken(
          tokenID
        )
      ).to.equal(true);
    });

    it("Should emit TokenRegistered event when new LockUnlock token is registered", async () => {
      await expect(gateway.connect(owner).registerToken(myToken.target, tokenID, "", ""))
        .to.emit(gateway, "TokenRegistered")
        .withArgs("", "", 1, myToken.target, true);
    });

    it("Should revert if LockUnlock token is already registered", async () => {
      await expect(gateway.connect(owner).registerToken(myToken.target, tokenID, "", ""))
        .not.to.be.reverted;

      await expect(gateway.connect(owner).registerToken(myToken.target, tokenID + 1, "", ""))
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

    it("Should revert if register token with zero token id", async () => {
      await expect(gateway.connect(owner).registerToken(ethers.ZeroAddress, 0, "Test Token", "TTK"))
        .to.be.revertedWithCustomError(gateway, "ZeroTokenId");
    });

    it("Should revert if register token with the same token id", async () => {
      expect(await gateway.connect(owner).registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK"))
        .not.to.be.reverted;

      await expect(gateway.connect(owner).registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK"))
        .to.be.revertedWithCustomError(gateway, "TokenIdAlreadyRegistered")
        .withArgs(tokenID);
    });

    it("Should increase tokenId on register MintBurn token success", async () => {
      expect(
        await gateway
          .connect(owner)
          .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK")
      ).not.to.be.reverted;

      expect(
        await gateway
          .connect(owner)
          .registerToken(ethers.ZeroAddress, tokenID + 1, "Test Token2", "TTK2")
      ).not.to.be.reverted;
    });

    it("Should set isLockUnlockToken to false when register MintBurn token is success", async () => {
      await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK");

      expect(
        await nativeTokenWallet.isLockUnlockToken(
          tokenID
        )
      ).to.equal(false);
    });

    it("Should set tokenAddress on register MintBurn token", async () => {
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

      const contractAddress = event.args.contractAddress;

      expect(
        await nativeTokenWallet.tokenAddress(tokenID)
      ).to.equal(contractAddress);
    });

    it("Should emit tokenRegistered event when new MintBurn token is registered", async () => {
      await expect(
        gateway
          .connect(owner)
          .registerToken(ethers.ZeroAddress, tokenID, "Test Token", "TTK")
      )
        .to.emit(gateway, "TokenRegistered")
        .withArgs("Test Token", "TTK", 1, anyValue, false);
    });
  });

  const tokenID = 1
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
