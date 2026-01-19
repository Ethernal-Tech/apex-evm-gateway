import hre from "hardhat";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("Transfering LockUnlock tokens", function () {
  describe("Deposit/Unlocking of LockUnlock tokens", function () {
    it("Should lock required amount of tokens for the receiver", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress(),
      );

      //minting tokens for NativeTokenWallet to reporesent previously locked tokens
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      const receiverBalance = await myToken.balanceOf(receiver.address);
      const walletBalance = await myToken.balanceOf(nativeTokenWalletContract);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        dataNonCurrencyToken,
      );

      const [tupleValue] = decoded;
      const [[decodedAddress, decodedAmount]] = tupleValue[3];

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataNonCurrencyToken,
      );

      expect(await myToken.balanceOf(decodedAddress)).to.equal(
        receiverBalance + decodedAmount,
      );

      expect(await myToken.balanceOf(nativeTokenWalletContract)).to.equal(
        walletBalance - decodedAmount,
      );
    });
  });

  describe("Withdraw/locking of LockUnlock tokens", function () {
    it("Should lock required amount of tokens for the sender", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress(),
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      await myToken.connect(receiver).approve(nativeTokenWallet.target, 1000);

      const receiverbalance = await myToken.balanceOf(receiver.address);
      const nativeTokenWalletBalance = await myToken.balanceOf(
        nativeTokenWallet.target,
      );

      const value = { value: ethers.parseUnits("150", "wei") };

      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawNonCurrencyToken, 100, 50, value);

      expect(
        await myToken.balanceOf(receiverWithdrawNonCurrencyToken[0].receiver),
      ).to.equal(
        receiverbalance - BigInt(receiverWithdrawNonCurrencyToken[0].amount),
      );

      expect(await myToken.balanceOf(nativeTokenWalletContract)).to.equal(
        nativeTokenWalletBalance +
          BigInt(receiverWithdrawNonCurrencyToken[0].amount),
      );
    });

    it("Should emit Withdraw event when LockUnlock tokens are unlocked", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress(),
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      await myToken.connect(receiver).approve(nativeTokenWallet.target, 1000);

      const value = { value: ethers.parseUnits("150", "wei") };

      const tx = await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawNonCurrencyToken, 100, 50, value);
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "Withdraw",
      );

      expect(event?.args?.destinationChainId).to.equal(1);
      expect(event?.args?.sender).to.equal(receiver);
      expect(event?.args?.receivers[0].receiver).to.equal(receiver);
      expect(event?.args?.receivers[0].amount).to.equal(100);
      expect(event?.args?.fee).to.equal(100);
      expect(event?.args?.operationFee).to.equal(50);
      expect(event?.args?.value).to.equal(150);
    });
  });

  async function impersonateAsContractAndMintFunds(contractAddress) {
    const address = contractAddress.toLowerCase();

    // impersonate as a contract on specified address
    await provider.send("hardhat_impersonateAccount", [address]);

    const signer = await ethers.getSigner(address);

    // minting 100000000000000000000 tokens to signer
    await provider.send("hardhat_setBalance", [
      signer.address,
      "0x56BC75E2D63100000",
    ]);

    return signer;
  }

  let tokenId = 2n;
  let gateway;
  let nativeTokenPredicate;
  let nativeTokenWallet;
  let validatorsc;
  let myToken;
  let owner;
  let receiver;
  let receiverWithdraw;
  let receiverWithdrawNonCurrencyToken;
  let data;
  let dataNonCurrencyToken;
  let provider;
  let fixture;
  let connection;
  let ethers;

  beforeEach(async function () {
    fixture = await deployGatewayFixtures(hre);

    gateway = fixture.gateway;
    nativeTokenPredicate = fixture.nativeTokenPredicate;
    nativeTokenWallet = fixture.nativeTokenWallet;
    validatorsc = fixture.validatorsc;
    nativeTokenWallet = fixture.nativeTokenWallet;
    validatorsc = fixture.validatorsc;
    myToken = fixture.myToken;
    owner = fixture.owner;
    receiver = fixture.receiver;
    receiverWithdraw = fixture.receiverWithdraw;
    receiverWithdrawNonCurrencyToken = fixture.receiverWithdrawNonCurrencyToken;
    data = fixture.data;
    dataNonCurrencyToken = fixture.dataNonCurrencyToken;
    provider = fixture.provider;
    connection = fixture.connection;
    ethers = fixture.ethers;
  });
});
