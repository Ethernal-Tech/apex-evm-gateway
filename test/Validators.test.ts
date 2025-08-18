import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";

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
  it("UpdateValidators should revert if not called by Gateway", async () => {
    const { validatorsc, owner, validatorSetChange } = await loadFixture(deployGatewayFixtures);

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "tuple(uint64 batchId, uint256 _validatorsSetNumber, uint256 _ttl, tuple(uint256[4] key)[] _validatorsChainData)",
      ],
      [validatorSetChange]
    );

    await expect(validatorsc.connect(owner).updateValidatorsChainData(data)).to.be.revertedWithCustomError(
      validatorsc,
      "NotGateway()"
    );
  });
  it("UpdateValidators should revert if validatorsSetNumber is not correct", async () => {
    const { gateway, validatorsc, validatorSetChange } = await loadFixture(deployGatewayFixtures);

    validatorSetChange._validatorsSetNumber = 2n;

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "tuple(uint64 batchId, uint256 _validatorsSetNumber, uint256 _ttl, tuple(uint256[4] key)[] _validatorsChainData)",
      ],
      [validatorSetChange]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    await expect(validatorsc.connect(gatewayContract).updateValidatorsChainData(data)).to.be.revertedWithCustomError(
      validatorsc,
      "WrongValidatorsSetValue()"
    );

    validatorSetChange._validatorsSetNumber = 1n;
  });

  it("UpdateValidators should emit event if TTL has passed and should not update set", async () => {
    const { gateway, validatorsc, validatorsCardanoData, validatorSetChange } = await loadFixture(
      deployGatewayFixtures
    );

    const blockNumber = await ethers.provider.getBlockNumber();

    validatorSetChange._ttl = BigInt(blockNumber) - 1n;

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "tuple(uint64 batchId, uint256 _validatorsSetNumber, uint256 _ttl, tuple(uint256[4] key)[] _validatorsChainData)",
      ],
      [validatorSetChange]
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.getAddress());

    expect(await validatorsc.connect(gatewayContract).updateValidatorsChainData(data))
      .to.emit(gateway, "ValidatorsSetUpdated")
      .withArgs(data);

    expect((await validatorsc.getValidatorsChainData()).length).to.equal(validatorsCardanoData.length);

    validatorSetChange._ttl = 9999999999n;
  });

  it("UpdateValidators success", async () => {
    const { owner, gateway, validatorsc, validatorSetChange } = await loadFixture(deployGatewayFixtures);

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "tuple(uint64 batchId, uint256 _validatorsSetNumber, uint256 _ttl, tuple(uint256[4] key)[] _validatorsChainData)",
      ],
      [validatorSetChange]
    );

    await gateway
      .connect(owner)
      .updateValidatorsChainData(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        data
      );

    expect(await validatorsc.lastConfirmedValidatorsSet()).to.equal(1);

    expect((await validatorsc.getValidatorsChainData()).length).to.equal(1);
    expect((await validatorsc.getValidatorsChainData())[0][0][0]).to.equal(
      validatorSetChange._validatorsChainData[0].key[0]
    );
    expect((await validatorsc.getValidatorsChainData())[0][0][1]).to.equal(
      validatorSetChange._validatorsChainData[0].key[1]
    );
    expect((await validatorsc.getValidatorsChainData())[0][0][2]).to.equal(
      validatorSetChange._validatorsChainData[0].key[2]
    );
    expect((await validatorsc.getValidatorsChainData())[0][0][3]).to.equal(
      validatorSetChange._validatorsChainData[0].key[3]
    );
  });
});
