import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Register colored coins tests", function () {
  describe("Register colored coin LayerZero", function () {
    it("Should revert if registerColoredCoin is not called by Owner", async () => {
      await expect(
        gateway
          .connect(validators[1])
          .registerColoredCoin(ethers.ZeroAddress, "", "")
      ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
    });

    it("Should revert if _lzERC20Address is not zero and not contract address", async () => {
      await expect(gateway.connect(owner).registerColoredCoin(owner, "", ""))
        .to.be.revertedWithCustomError(gateway, "NotContractAddress")
        .withArgs(owner);
    });

    it("Should increase coloredCoinAddressIdCounter on register colored coin LayerZero success", async () => {
      const coloredCoinIdBefore = await gateway.coloredCoinIdCounter();

      expect(
        await gateway.connect(owner).registerColoredCoin(myToken.target, "", "")
      ).not.to.be.reverted;

      expect(await gateway.coloredCoinIdCounter()).to.equal(
        coloredCoinIdBefore + BigInt(1)
      );
    });

    it("Should set coloredCoinAddress on register colored coin LayerZero success", async () => {
      await gateway.connect(owner).registerColoredCoin(myToken.target, "", "");

      expect(
        await nativeTokenWallet.coloredCoinAddress(
          await gateway.coloredCoinIdCounter()
        )
      ).to.equal(myToken.target);
    });

    it("Should emit coloredCoin registered event when new LayerZero colored coin is registered", async () => {
      expect(
        await gateway.connect(owner).registerColoredCoin(myToken.target, "", "")
      )
        .to.emit(gateway, "ColoredCoinRegistered")
        .withArgs(
          "",
          "",
          await gateway.coloredCoinIdCounter(),
          myToken.target,
          true
        );
    });
  });
  describe("Register colored coin ERC20", function () {
    it("Should increase coloredCoinAddressIdCounter on register colored coin ERC20 success", async () => {
      const coloredCoinIdBefore = await gateway.coloredCoinIdCounter();

      expect(
        await gateway
          .connect(owner)
          .registerColoredCoin(ethers.ZeroAddress, "Test Token", "TTK")
      ).not.to.be.reverted;

      expect(await gateway.coloredCoinIdCounter()).to.equal(
        coloredCoinIdBefore + BigInt(1)
      );
    });

    it("Should set coloredCoinAddress on register colored coin ERC20", async () => {
      const tx = await gateway
        .connect(owner)
        .registerColoredCoin(ethers.ZeroAddress, "Test Token", "TTK");

      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log && log.name === "ColoredCoinRegistered");

      const contractAddress = event.args.contractAddress;

      expect(
        await nativeTokenWallet.coloredCoinAddress(
          await gateway.coloredCoinIdCounter()
        )
      ).to.equal(contractAddress);
    });

    it("Should emit coloredCoin registered event when new ERC20 colored coin is registered", async () => {
      expect(
        await gateway
          .connect(owner)
          .registerColoredCoin(ethers.ZeroAddress, "Test Token", "TTK")
      )
        .to.emit(gateway, "ColoredCoinRegistered")
        .withArgs(
          "Test Token",
          "TTK",
          await gateway.coloredCoinIdCounter(),
          anyValue,
          false
        );
    });
  });

  let owner: any;
  let validators: any;
  let gateway: any;
  let myToken: any;

  let nativeTokenWallet: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    validators = fixture.validators;
    gateway = fixture.gateway;
    myToken = fixture.myToken;
    nativeTokenWallet = fixture.nativeTokenWallet;
  });
});
