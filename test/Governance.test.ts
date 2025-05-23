import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";
import { ethers, network } from "hardhat";

describe("Governance Functions", function () {
  describe("Owner Governor", function () {
    it("Should revert execution if there is no quorum", async function () {
      const { gateway, ownerGovernor, governor1, governor2 } = await loadFixture(deployGatewayFixtures);

      const setMinAmounts = gateway.interface.encodeFunctionData("setMinAmounts", [1000, 1000]);

      const proposalTx = await ownerGovernor.propose([gateway.target], [0], [setMinAmounts], "Set Minimal Amounts");
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        ownerGovernor.execute(
          [gateway.target],
          [0],
          [setMinAmounts],
          ethers.keccak256(ethers.toUtf8Bytes("Set Minimal Amounts"))
        )
      ).to.be.revertedWithCustomError(ownerGovernor, "GovernorUnexpectedProposalState");

      expect(await gateway.minFeeAmount()).to.be.equal(100);
      expect(await gateway.minBridgingAmount()).to.be.equal(50);
    });
    it("Should revert execution if voting period has not passed", async function () {
      const { gateway, ownerGovernor, governor1, governor2, governor3 } = await loadFixture(deployGatewayFixtures);

      const setMinAmounts = gateway.interface.encodeFunctionData("setMinAmounts", [1000, 1000]);

      const proposalTx = await ownerGovernor.propose([gateway.target], [0], [setMinAmounts], "Set Minimal Amounts");
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);
      await ownerGovernor.connect(governor3).castVote(proposalId, 1);

      await expect(
        ownerGovernor.execute(
          [gateway.target],
          [0],
          [setMinAmounts],
          ethers.keccak256(ethers.toUtf8Bytes("Set Minimal Amounts"))
        )
      ).to.be.revertedWithCustomError(ownerGovernor, "GovernorUnexpectedProposalState");

      expect(await gateway.minFeeAmount()).to.be.equal(100);
      expect(await gateway.minBridgingAmount()).to.be.equal(50);
    });
    it("Should execute if there is quorum and voting period has passed", async function () {
      const { gateway, ownerGovernor, governor1, governor2, governor3 } = await loadFixture(deployGatewayFixtures);

      const setMinAmounts = gateway.interface.encodeFunctionData("setMinAmounts", [1000, 1000]);

      const proposalTx = await ownerGovernor.propose([gateway.target], [0], [setMinAmounts], "Set Minimal Amounts");
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);
      await ownerGovernor.connect(governor3).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        ownerGovernor.execute(
          [gateway.target],
          [0],
          [setMinAmounts],
          ethers.keccak256(ethers.toUtf8Bytes("Set Minimal Amounts"))
        )
      ).not.to.be.reverted;

      expect(await gateway.minFeeAmount()).to.be.equal(1000);
      expect(await gateway.minBridgingAmount()).to.be.equal(1000);
    });
  });
});
