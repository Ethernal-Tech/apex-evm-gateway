import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures, impersonateAsContractAndMintFunds } from "./fixtures";

describe("Validators Contract", function () {
  it("Validate initialization", async () => {
    const { validatorsc, validators } = await loadFixture(deployGatewayFixtures);

    expect(await validatorsc.validatorsCount()).to.equal(validators.length);
    expect((await validatorsc.getValidatorsAddresses()).length).to.equal(validators.length);
    const validatorsAddresses = await validatorsc.getValidatorsAddresses();
    for (let i = 0; i < validators.length; i++) {
      expect(validatorsAddresses[i]).to.equal(validators[i].address);
    }
    for (let i = 0; i < validators.length; i++) {
      expect(await validatorsc.addressValidatorIndex(validatorsc.validatorsAddresses(i))).to.equal(i + 1);
    }
  });

  it("SetDependencies should fail if a validator is Zero Address", async () => {
    const { owner, validatorsc, validatorAddressCardanoData } = await loadFixture(deployGatewayFixtures);

    await expect(
      validatorsc.connect(owner).setDependencies(ethers.constants.AddressZero, validatorAddressCardanoData)
    ).to.be.revertedWithCustomError(validatorsc, "ZeroAddress");
  });

  it("SetDependencies should fail data does not match number of validators", async function () {
    const { gateway, validatorsc, owner, validators, validatorCardanoData } = await loadFixture(deployGatewayFixtures);

    const validatorAddressCardanoDataShort = [
      {
        addr: validators[0].address,
        data: validatorCardanoData,
      },
      {
        addr: validators[1].address,
        data: validatorCardanoData,
      },
      {
        addr: validators[2].address,
        data: validatorCardanoData,
      },
      {
        addr: validators[3].address,
        data: validatorCardanoData,
      },
    ];

    await expect(
      validatorsc.connect(owner).setDependencies(gateway.address, validatorAddressCardanoDataShort)
    ).to.be.revertedWithCustomError(gateway, "InvalidData");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, validators, validatorsc, validatorAddressCardanoData } = await loadFixture(
      deployGatewayFixtures
    );

    await expect(validatorsc.connect(owner).setDependencies(gateway.address, validatorAddressCardanoData)).not.to.be
      .reverted;

    expect(await validatorsc.gatewayAddress()).to.be.equal(gateway.address);

    const chainData = await validatorsc.getValidatorsChainData();

    for (let i = 0; i < validators.length; i++) {
      for (let j = 0; j < 4; j++) {
        expect(chainData[i].key[j]).to.equal(validatorAddressCardanoData[i].data.key[j]);
      }
    }
  });
});
