import { NativeERC20Mintable } from "./../typechain-types/contracts/NativeERC20Mintable";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("NativeERC20Mintable Contract", function () {
  it("initialize and validate initialization", async () => {
    const { owner, nativeERC20Mintable, eRC20TokenPredicate } = await loadFixture(deployGatewayFixtures);

    await expect(
      nativeERC20Mintable
        .connect(owner)
        .setDependencies(eRC20TokenPredicate.address, owner.address, "TEST", "TEST", 18, 0)
    ).to.not.be.reverted;
    expect(await nativeERC20Mintable.name()).to.equal("TEST");
    expect(await nativeERC20Mintable.symbol()).to.equal("TEST");
    expect(await nativeERC20Mintable.decimals()).to.equal(18);
    expect(await nativeERC20Mintable.totalSupply()).to.equal(0);
    expect(await nativeERC20Mintable.predicate()).to.equal(eRC20TokenPredicate.address);
    expect(await nativeERC20Mintable.owner()).to.equal(owner.address);
  });

  it("Mint will fail if not called by Predicate or Owner", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    await expect(nativeERC20Mintable.connect(receiver).mint(receiver.address, 100)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "NotPredicateOrOwner"
    );
  });

  it("Mint will fail if not called by Predicate or Owner", async function () {
    const { nativeERC20Mintable, receiver } = await loadFixture(deployGatewayFixtures);

    await expect(nativeERC20Mintable.connect(receiver).mint(receiver.address, 100)).to.be.revertedWithCustomError(
      nativeERC20Mintable,
      "NotPredicateOrOwner"
    );
  });
});
