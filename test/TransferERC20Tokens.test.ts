import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Transfering ERC20 colored coins", function () {
  describe("Deposit/Minting of ERC20 tokens", function () {
    it("Should revert if coloredCoinId is not valid", async () => {
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
        .to.be.revertedWithCustomError(gateway, "ColoredCoinNotRegistered")
        .withArgs(1);
    });
  });
  describe("Withdraw/Burn of ERC20 tokens", function () {});

  let owner: any;
  let validators: any;
  let gateway: any;
  let myToken: any;
  let tokenFactory: any;
  let nativeTokenWallet: any;
  let data: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployGatewayFixtures);
    owner = fixture.owner;
    validators = fixture.validators;
    gateway = fixture.gateway;
    myToken = fixture.myToken;
    tokenFactory = fixture.tokenFactory;
    nativeTokenWallet = fixture.nativeTokenWallet;
    data = fixture.data;
  });
});
