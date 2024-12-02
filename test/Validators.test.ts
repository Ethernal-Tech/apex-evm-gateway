import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("Validators Contract", function () {
  it("setValidatorsChainData and validate initialization", async () => {
    const { owner, validators, validatorsc, validatorsCardanoData } = await loadFixture(deployGatewayFixtures);

    await expect(validatorsc.connect(owner).setValidatorsChainData(validatorsCardanoData)).not.to.be.reverted;

    const chainData = await validatorsc.getValidatorsChainData();

    for (let i = 0; i < validators.length; i++) {
      for (let j = 0; j < 4; j++) {
        expect(chainData[i].key[j]).to.equal(validatorsCardanoData[i].key[j]);
      }
    }
  });
  it("UpdateValidators should revert if validatorsSetNumber is not correct", async () => {
    const { validatorsc } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();

    const abiCoder = new ethers.AbiCoder();

    const dataUpdateValidatorsChainData = abiCoder.encode(
      ["uint256", "uint256", "tuple(uint256[4])[]"],
      [1, blockNumber + 100, [[[1, 2, 3, 4]]]]
    );

    await expect(validatorsc.updateValidatorsChainData(dataUpdateValidatorsChainData)).to.be.revertedWithCustomError(
      validatorsc,
      "WrongValidatorsSetValue()"
    );
  });
  it("UpdateValidators should emit event if TTL has passed and should not update set", async () => {
    const { gateway, validatorsc, validatorsCardanoData } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();

    const abiCoder = new ethers.AbiCoder();

    const dataUpdateValidatorsChainData = abiCoder.encode(
      ["uint256", "uint256", "tuple(uint256[4])[]"],
      [0, blockNumber - 1, [[[1, 2, 3, 4]]]]
    );

    expect(await validatorsc.updateValidatorsChainData(dataUpdateValidatorsChainData))
      .to.emit(gateway, "ValidatorsSetUpdated")
      .withArgs(dataUpdateValidatorsChainData);

    expect((await validatorsc.getValidatorsChainData()).length).to.equal(validatorsCardanoData.length);
  });
  it("UpdateValidators success", async () => {
    const { gateway, validatorsc, dataUpdateValidatorsChainData } = await loadFixture(deployGatewayFixtures);

    await gateway.updateValidatorsChainData(
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      "0x7465737400000000000000000000000000000000000000000000000000000000",
      dataUpdateValidatorsChainData
    );

    expect(await validatorsc.validatorsSetNumber()).to.equal(1);

    expect((await validatorsc.getValidatorsChainData()).length).to.equal(1);
    expect((await validatorsc.getValidatorsChainData())[0][0][0]).to.equal(1);
    expect((await validatorsc.getValidatorsChainData())[0][0][1]).to.equal(2);
    expect((await validatorsc.getValidatorsChainData())[0][0][2]).to.equal(3);
    expect((await validatorsc.getValidatorsChainData())[0][0][3]).to.equal(4);
  });
});
