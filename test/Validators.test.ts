import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

describe("Validators Contract", function () {
  it("SetDependencies should fail if a validator is Zero Address", async () => {
    const { owner, validatorsc, validatorAddressCardanoData } = await loadFixture(deployGatewayFixtures);

    await expect(
      validatorsc.connect(owner).setDependencies(ethers.constants.AddressZero, validatorAddressCardanoData)
    ).to.be.revertedWithCustomError(validatorsc, "ZeroAddress");
  });

  it("addValidatorChainData from Validators SC should revert if not called by gateway SC", async function () {
    const { gateway, validatorsc, owner, validatorCardanoData } = await loadFixture(deployGatewayFixtures);

    await expect(
      validatorsc.connect(owner).addValidatorChainData(owner.address, validatorCardanoData)
    ).to.be.revertedWithCustomError(gateway, "NotGateway");
  });

  it("setValidatorsChainData from Validators SC should revert if not called by gateway SC", async function () {
    const { gateway, validatorsc, receiver, validatorAddressCardanoData } = await loadFixture(deployGatewayFixtures);

    await expect(
      validatorsc.connect(receiver).setValidatorsChainData(validatorAddressCardanoData)
    ).to.be.revertedWithCustomError(gateway, "NotGatewayOrOwner");
  });
});
