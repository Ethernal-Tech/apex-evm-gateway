import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";

describe("Validators Contract", function () {
  it("setValidatorsChainData and validate initialization", async () => {
    const { ownerGovernorContract, validators, validatorsc, validatorsCardanoData } = await loadFixture(
      deployGatewayFixtures
    );

    await expect(validatorsc.connect(ownerGovernorContract).setValidatorsChainData(validatorsCardanoData)).not.to.be
      .reverted;

    const chainData = await validatorsc.getValidatorsChainData();

    for (let i = 0; i < validators.length; i++) {
      for (let j = 0; j < 4; j++) {
        expect(chainData[i].key[j]).to.equal(validatorsCardanoData[i].key[j]);
      }
    }
  });
  it("UpdateValidators should revert if not called by Gateway", async () => {
    const { validatorsc, owner } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();

    const abiCoder = new ethers.AbiCoder();

    const dataUpdateValidatorsChainData = abiCoder.encode(
      ["uint256", "uint256", "tuple(uint256[4])[]"],
      [10, blockNumber + 100, [[[1, 2, 3, 4]]]]
    );

    await expect(
      validatorsc.connect(owner).updateValidatorsChainData(dataUpdateValidatorsChainData)
    ).to.be.revertedWithCustomError(validatorsc, "NotGateway()");
  });
  it("UpdateValidators should revert if validatorsSetNumber is not correct", async () => {
    const { gateway, validatorsc } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();

    const abiCoder = new ethers.AbiCoder();

    const dataUpdateValidatorsChainData = abiCoder.encode(
      ["uint256", "uint256", "tuple(uint256[4])[]"],
      [10, blockNumber + 100, [[[1, 2, 3, 4]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    await expect(
      validatorsc.connect(gatewayContract).updateValidatorsChainData(dataUpdateValidatorsChainData)
    ).to.be.revertedWithCustomError(validatorsc, "WrongValidatorsSetValue()");
  });
  it("UpdateValidators should emit event if TTL has passed and should not update set", async () => {
    const { gateway, validatorsc, validatorsCardanoData } = await loadFixture(deployGatewayFixtures);

    const blockNumber = await ethers.provider.getBlockNumber();

    const abiCoder = new ethers.AbiCoder();

    const dataUpdateValidatorsChainData = abiCoder.encode(
      ["uint256", "uint256", "tuple(uint256[4])[]"],
      [1, blockNumber - 1, [[[1, 2, 3, 4]]]]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    expect(await validatorsc.connect(gatewayContract).updateValidatorsChainData(dataUpdateValidatorsChainData))
      .to.emit(gateway, "ValidatorsSetUpdated")
      .withArgs(dataUpdateValidatorsChainData);

    expect((await validatorsc.getValidatorsChainData()).length).to.equal(validatorsCardanoData.length);
  });
  it("UpdateValidators success", async () => {
    const { ownerGovernorContract, gateway, validatorsc, dataUpdateValidatorsChainData } = await loadFixture(
      deployGatewayFixtures
    );

    await gateway
      .connect(ownerGovernorContract)
      .updateValidatorsChainData(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataUpdateValidatorsChainData
      );

    expect(await validatorsc.lastConfirmedValidatorsSet()).to.equal(1);

    expect((await validatorsc.getValidatorsChainData()).length).to.equal(1);
    expect((await validatorsc.getValidatorsChainData())[0][0][0]).to.equal(1);
    expect((await validatorsc.getValidatorsChainData())[0][0][1]).to.equal(2);
    expect((await validatorsc.getValidatorsChainData())[0][0][2]).to.equal(3);
    expect((await validatorsc.getValidatorsChainData())[0][0][3]).to.equal(4);
  });
});
