import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Validators Contract", function () {
  it("SetDependencies should fail if a validator is Zero Address", async () => {
    const { owner, validatorsc, validatorsCardanoData } = await loadFixture(deployGatewayFixtures);

    await expect(
      validatorsc.connect(owner).setDependencies(ethers.ZeroAddress, validatorsCardanoData)
    ).to.be.revertedWithCustomError(validatorsc, "ZeroAddress");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, validators, validatorsc, validatorsCardanoData } = await loadFixture(
      deployGatewayFixtures
    );

    await expect(validatorsc.connect(owner).setDependencies(gateway.target, validatorsCardanoData)).not.to.be
      .reverted;

    expect(await validatorsc.gatewayAddress()).to.be.equal(gateway.target);

    const chainData = await validatorsc.getValidatorsChainData();

    for (let i = 0; i < validators.length; i++) {
      for (let j = 0; j < 4; j++) {
        expect(chainData[i].key[j]).to.equal(validatorsCardanoData[i].key[j]);
      }
    }
  });
});
