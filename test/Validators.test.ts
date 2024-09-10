import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("Validators Contract", function () {
  it("setValidatorsChainData and validate initialization", async () => {
    const { owner, validators, validatorsc, validatorsCardanoData } = await loadFixture(
      deployGatewayFixtures
    );

    await expect(validatorsc.connect(owner).setValidatorsChainData(validatorsCardanoData)).not.to.be
      .reverted;

    const chainData = await validatorsc.getValidatorsChainData();

    for (let i = 0; i < validators.length; i++) {
      for (let j = 0; j < 4; j++) {
        expect(chainData[i].key[j]).to.equal(validatorsCardanoData[i].key[j]);
      }
    }
  });
});
