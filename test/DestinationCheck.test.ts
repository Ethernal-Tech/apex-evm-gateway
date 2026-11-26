import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixtures } from "./fixtures";

const SIG =
  "0x7465737400000000000000000000000000000000000000000000000000000000";

const DEPOSITS_TYPE =
  "tuple(uint64 batchId, uint64 ttlExpired, uint256 feeAmount, tuple(address receiver, uint256 amount, uint16 tokenId)[] receivers, uint256 chainId, address gateway)";
const LEGACY_DEPOSITS_TYPE =
  "tuple(uint64 batchId, uint64 ttlExpired, uint256 feeAmount, tuple(address receiver, uint256 amount, uint16 tokenId)[] receivers)";
const VSC_TYPE =
  "tuple(uint64 batchId, uint256 _validatorsSetNumber, uint256 _ttl, tuple(uint256[4] key)[] _validatorsChainData, uint256 chainId, address gateway)";

const coder = ethers.AbiCoder.defaultAbiCoder();

function encodeDeposits(
  batchId: number,
  ttl: number,
  receiver: string,
  chainId: bigint,
  gateway: string,
) {
  return coder.encode(
    [DEPOSITS_TYPE],
    [[batchId, ttl, 1, [[receiver, 1000, 1]], chainId, gateway]],
  );
}

describe("Destination check", function () {
  let a: any, b: any;
  let chainId: bigint;

  beforeEach(async () => {
    a = await deployGatewayFixtures();
    b = await deployGatewayFixtures();
    chainId = (await ethers.provider.getNetwork()).chainId;
  });

  it("golden vector matches Go", async () => {
    const data = coder.encode(
      [DEPOSITS_TYPE],
      [
        [
          7,
          1234,
          99,
          [["0x1111111111111111111111111111111111111111", 5, 5]],
          9070,
          "0x2222222222222222222222222222222222222222",
        ],
      ],
    );
    expect(ethers.dataLength(data)).to.equal(352);
    expect(ethers.keccak256(data)).to.equal(
      "0x9af154f750d941e3cde48d7820ab31e1c5a5065806c405005d2c79368d9a2022",
    );
  });

  it("deposit with matching destination succeeds", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = encodeDeposits(
      1,
      block + 100,
      a.receiver.address,
      chainId,
      await a.gateway.getAddress(),
    );
    const before = await ethers.provider.getBalance(a.receiver.address);
    await expect(a.gateway.deposit(SIG, SIG, data)).to.emit(
      a.gateway,
      "Deposit",
    );
    expect(await ethers.provider.getBalance(a.receiver.address)).to.equal(
      before + 1000n,
    );
    expect(await a.nativeTokenPredicate.lastBatchId()).to.equal(1);
  });

  it("deposit for another gateway reverts WrongDestination", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = encodeDeposits(
      1,
      block + 100,
      b.receiver.address,
      chainId,
      await a.gateway.getAddress(),
    );
    const before = await ethers.provider.getBalance(b.receiver.address);
    await expect(
      b.gateway.deposit(SIG, SIG, data),
    ).to.be.revertedWithCustomError(b.nativeTokenPredicate, "WrongDestination");
    expect(await b.nativeTokenPredicate.lastBatchId()).to.equal(0);
    expect(await ethers.provider.getBalance(b.receiver.address)).to.equal(
      before,
    );
  });

  it("deposit for another chain id reverts WrongDestination", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = encodeDeposits(
      1,
      block + 100,
      a.receiver.address,
      chainId + 1n,
      await a.gateway.getAddress(),
    );
    await expect(
      a.gateway.deposit(SIG, SIG, data),
    ).to.be.revertedWithCustomError(a.nativeTokenPredicate, "WrongDestination");
  });

  it("expired batch for another gateway does not move lastBatchId", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = encodeDeposits(
      5,
      block - 1,
      b.receiver.address,
      chainId,
      await b.gateway.getAddress(),
    );
    await expect(a.gateway.deposit(SIG, SIG, data))
      .to.be.revertedWithCustomError(a.nativeTokenPredicate, "WrongDestination");
    expect(await a.nativeTokenPredicate.lastBatchId()).to.equal(0);
  });

  it("legacy payload rejected", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = coder.encode(
      [LEGACY_DEPOSITS_TYPE],
      [[1, block + 100, 1, [[a.receiver.address, 1000, 1]]]],
    );
    await expect(a.gateway.deposit(SIG, SIG, data)).to.be.reverted;
    expect(await a.nativeTokenPredicate.lastBatchId()).to.equal(0);
  });

  // A pre-upgrade (4-field) batch decodes under the new layout with chainId = receivers.length
  // and gateway = receivers[0].receiver. With one receiver equal to the Gateway on a chain whose
  // id is 1 (Ethereum mainnet) the destination check alone would pass, so legacy bytes must be
  // rejected because they are not the canonical encoding of the decoded struct.
  it("legacy payload with the gateway as only receiver reverts InvalidPayload", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = coder.encode(
      [LEGACY_DEPOSITS_TYPE],
      [[3, block + 100, 1, [[await a.gateway.getAddress(), 1000, 1]]]],
    );
    await expect(
      a.gateway.deposit(SIG, SIG, data),
    ).to.be.revertedWithCustomError(a.nativeTokenPredicate, "InvalidPayload");
    expect(await a.nativeTokenPredicate.lastBatchId()).to.equal(0);
  });

  it("matching payload with trailing bytes reverts InvalidPayload", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = ethers.concat([
      encodeDeposits(
        1,
        block + 100,
        a.receiver.address,
        chainId,
        await a.gateway.getAddress(),
      ),
      ethers.zeroPadValue("0x01", 32),
    ]);
    const before = await ethers.provider.getBalance(a.receiver.address);
    await expect(
      a.gateway.deposit(SIG, SIG, data),
    ).to.be.revertedWithCustomError(a.nativeTokenPredicate, "InvalidPayload");
    expect(await a.nativeTokenPredicate.lastBatchId()).to.equal(0);
    expect(await ethers.provider.getBalance(a.receiver.address)).to.equal(
      before,
    );
  });

  it("validator set change with trailing bytes reverts InvalidPayload", async () => {
    const data = ethers.concat([
      coder.encode(
        [VSC_TYPE],
        [
          [
            1,
            1,
            9999999999n,
            [[[123n, 456n, 789n, 101112n]]],
            chainId,
            await a.gateway.getAddress(),
          ],
        ],
      ),
      ethers.zeroPadValue("0x01", 32),
    ]);
    await expect(
      a.gateway.updateValidatorsChainData(SIG, SIG, data),
    ).to.be.revertedWithCustomError(a.validatorsc, "InvalidPayload");
    expect(await a.validatorsc.lastConfirmedValidatorsSet()).to.equal(0);
  });

  it("same gateway replay still BatchAlreadyExecuted", async () => {
    const block = await ethers.provider.getBlockNumber();
    const data = encodeDeposits(
      1,
      block + 100,
      a.receiver.address,
      chainId,
      await a.gateway.getAddress(),
    );
    await a.gateway.deposit(SIG, SIG, data);
    await expect(
      a.gateway.deposit(SIG, SIG, data),
    ).to.be.revertedWithCustomError(a.nativeTokenPredicate, "BatchAlreadyExecuted");
  });

  it("validator set change checks destination", async () => {
    const vsc = (gw: string, cid: bigint) =>
      coder.encode(
        [VSC_TYPE],
        [[1, 1, 9999999999n, [[[123n, 456n, 789n, 101112n]]], cid, gw]],
      );
    const aAddr = await a.gateway.getAddress();
    const bAddr = await b.gateway.getAddress();

    await expect(
      a.gateway.updateValidatorsChainData(SIG, SIG, vsc(bAddr, chainId)),
    ).to.be.revertedWithCustomError(a.validatorsc, "WrongDestination");
    await expect(
      a.gateway.updateValidatorsChainData(SIG, SIG, vsc(aAddr, chainId + 1n)),
    ).to.be.revertedWithCustomError(a.validatorsc, "WrongDestination");

    await a.gateway.updateValidatorsChainData(SIG, SIG, vsc(aAddr, chainId));
    expect(await a.validatorsc.lastConfirmedValidatorsSet()).to.equal(1);
  });

  it("version is 1.0.3", async () => {
    expect(await a.gateway.version()).to.equal("1.0.3");
  });
});
