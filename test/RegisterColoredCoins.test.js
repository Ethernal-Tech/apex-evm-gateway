import hre from "hardhat";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("Register tokens tests", function () {
  describe("Register LockUnlock tokens", function () {
    it("Should revert if registerToken is not called by Owner", async () => {
      await expect(
        gateway
          .connect(validators[1])
          .registerToken(ethers.ZeroAddress, tokenId, "", ""),
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("Should revert if _lockUnlockSCAddress is not zero and not contract address", async () => {
      await expect(gateway.connect(owner).registerToken(owner, tokenId, "", ""))
        .to.be.revertedWithCustomError(gateway, "NotContractAddress")
        .withArgs(owner);
    });

    it("Should revert if register token with currency token id", async () => {
      await expect(
        gateway.connect(owner).registerToken(myToken.target, 1, "", ""),
      ).to.be.revertedWithCustomError(gateway, "CurrencyTokenId");
    });

    it("Should revert when registering token with Id that was previously registered", async () => {
      expect(
        await gateway
          .connect(owner)
          .registerToken(myToken.target, tokenId, "", ""),
      ).not.to.be.revert(ethers);

      await expect(
        gateway.connect(owner).registerToken(myToken.target, tokenId, "", ""),
      )
        .to.be.revertedWithCustomError(gateway, "TokenIdAlreadyRegistered")
        .withArgs(tokenId);
    });

    it("Should set tokenAddress on register LockUnlock token success", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      expect((await nativeTokenWallet.getTokenInfo(tokenId))[0]).to.equal(
        myToken.target,
      );
    });

    it("Should set isLockUnlockToken to true when register LockUnlock token is success", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      expect((await nativeTokenWallet.getTokenInfo(tokenId))[1]).to.equal(true);
    });

    it("Should emit TokenRegistered event when new LockUnlock token is registered", async () => {
      await expect(
        gateway.connect(owner).registerToken(myToken.target, tokenId, "", ""),
      )
        .to.emit(gateway, "TokenRegistered")
        .withArgs("", "", tokenId, myToken.target, true);
    });

    it("Should not update token name and symbol when new LockUnlock token is registered", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");
      expect(await gateway.getTokenAddress(tokenId)).to.equal(myToken.target);

      expect(await myToken.name()).to.equal("Test Token");
      expect(await myToken.symbol()).to.equal("TTK");
    });
  });
  describe("Register MintBurn token", function () {
    it("Should revert if createToken is not called by Gateway", async () => {
      await expect(
        tokenFactory.connect(validators[1]).createToken("", ""),
      ).to.be.revertedWithCustomError(tokenFactory, "NotGateway");
    });

    it("Should set isLockUnlockToken to false when register MintBurn token is success", async () => {
      await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "Test Token", "TTK");

      expect((await nativeTokenWallet.getTokenInfo(tokenId))[1]).to.equal(
        false,
      );
    });

    it("Should set tokenAddress on register MintBurn token", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "Test Token", "TTK");

      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log && log.name === "TokenRegistered");

      const contractAddress = event.args.contractAddress;

      expect((await nativeTokenWallet.getTokenInfo(tokenId))[0]).to.equal(
        contractAddress,
      );
    });

    it("Should emit tokenRegistered event when new MintBurn token is registered", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "Test Token", "TTK");

      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => gateway.interface.parseLog(log))
        .find((e) => e?.name === "TokenRegistered");

      expect(event.args.name).to.equal("Test Token");
      expect(event.args.symbol).to.equal("TTK");
      expect(event.args.tokenId).to.equal(2);
    });

    it("Should set token name and symbol when new MintBurn token is registered", async () => {
      const tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId, "New Test Token", "NTTK");

      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log && log.name === "TokenRegistered");

      const contractAddress = event.args.contractAddress;

      expect(await gateway.getTokenAddress(tokenId)).to.equal(contractAddress);

      const newToken = await ethers.getContractAt("MyToken", contractAddress);

      expect(await newToken.name()).to.equal("New Test Token");
      expect(await newToken.symbol()).to.equal("NTTK");
    });
  });

  let tokenId = 2n;
  let gateway;
  let nativeTokenWallet;
  let myToken;
  let tokenFactory;
  let owner;
  let validators;
  let fixture;
  let ethers;

  beforeEach(async function () {
    fixture = await deployGatewayFixtures(hre);

    gateway = fixture.gateway;
    nativeTokenWallet = fixture.nativeTokenWallet;
    myToken = fixture.myToken;
    tokenFactory = fixture.tokenFactory;
    nativeTokenWallet = fixture.nativeTokenWallet;
    owner = fixture.owner;
    validators = fixture.validators;
    ethers = fixture.ethers;
  });
});
