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
    const { owner, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(
      validatorsc.connect(owner).setDependencies(ethers.constants.AddressZero)
    ).to.be.revertedWithCustomError(validatorsc, "ZeroAddress");
  });

  it("SetDependencies and validate initialization", async () => {
    const { owner, gateway, validatorsc } = await loadFixture(deployGatewayFixtures);

    await expect(validatorsc.connect(owner).setDependencies(gateway.address)).not.to.be.reverted;

    expect(await validatorsc.gatewayAddress()).to.be.equal(gateway.address);
  });

  it("setValidatorsChainData should fail if not called by Gateway or Owner", async function () {
    const { gateway, validatorsc, owner, receiver, validatorAddressCardanoData } = await loadFixture(
      deployGatewayFixtures
    );

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    await expect(validatorsc.connect(gatewayContract).setValidatorsChainData(validatorAddressCardanoData)).not.to.be
      .reverted;

    await expect(validatorsc.connect(owner).setValidatorsChainData(validatorAddressCardanoData)).not.to.be.reverted;

    await expect(
      validatorsc.connect(receiver).setValidatorsChainData(validatorAddressCardanoData)
    ).to.be.revertedWithCustomError(gateway, "NotGatewayOrOwner");
  });

  it("setValidatorsChainData should fail data does not match number of validators", async function () {
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
      validatorsc.connect(owner).setValidatorsChainData(validatorAddressCardanoDataShort)
    ).to.be.revertedWithCustomError(gateway, "InvalidData");
  });

  it("addValidatorChainData should fail if not called by Gateway", async function () {
    const { gateway, validatorsc, owner, validators, validatorCardanoData } = await loadFixture(deployGatewayFixtures);

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    await expect(
      validatorsc.connect(gatewayContract).addValidatorChainData(validators[0].address, validatorCardanoData)
    ).not.to.be.reverted;

    await expect(
      validatorsc.connect(owner).addValidatorChainData(validators[0].address, validatorCardanoData)
    ).to.be.revertedWithCustomError(gateway, "NotGateway");
  });

  it("addValidatorChainData should fail if not called by Gateway", async function () {
    const { gateway, validatorsc, owner, validators, validatorCardanoData } = await loadFixture(deployGatewayFixtures);

    const gatewayContract = await impersonateAsContractAndMintFunds(await gateway.address);

    await expect(
      validatorsc.connect(gatewayContract).addValidatorChainData(validators[0].address, validatorCardanoData)
    ).not.to.be.reverted;

    await expect(
      validatorsc.connect(owner).addValidatorChainData(owner.address, validatorCardanoData)
    ).to.be.revertedWithCustomError(gateway, "NotGateway");
  });
});
