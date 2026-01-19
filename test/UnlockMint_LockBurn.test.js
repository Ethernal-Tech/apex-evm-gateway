import hre from "hardhat";
import { expect } from "chai";
import { deployGatewayFixtures } from "./fixtures";

describe("LockMint/UnlockBurn", function () {
  describe("Working with mixed tokens", function () {
    it("Should unlock/burn required amount of tokens for the receiver", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      let tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId + 1n, "Test Token", "TTK");

      let receipt = await tx.wait();

      let event = receipt.logs
        .map((log) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log && log.name === "TokenRegistered");

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "MyToken",
        contractAddress,
      );

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress(),
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      //minting tokens for receiver
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

      await myToken.connect(receiver).approve(nativeTokenWalletAddress, 1001);

      const receiverBalanceToken1 = await myToken.balanceOf(receiver.address);
      const receiverBalanceToken2 = await myTokenERC20.balanceOf(
        receiver.address,
      );

      const walletBalanceToken1 = await myToken.balanceOf(
        nativeTokenWalletAddress,
      );

      const value = { value: ethers.parseUnits("250", "wei") };
      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawMixTokens, 100, 50, value);

      expect(await myToken.balanceOf(receiver.address)).to.equal(
        receiverBalanceToken1 - BigInt(receiverWithdrawMixTokens[1].amount),
      );

      expect(await myToken.balanceOf(nativeTokenWalletAddress)).to.equal(
        walletBalanceToken1 + BigInt(receiverWithdrawMixTokens[1].amount),
      );

      expect(await myTokenERC20.balanceOf(receiver.address)).to.equal(
        receiverBalanceToken2 - BigInt(receiverWithdrawMixTokens[2].amount),
      );
    });

    it("Should lock/mint required amount of tokens for the receiver", async () => {
      await gateway
        .connect(owner)
        .registerToken(myToken.target, tokenId, "", "");

      let tx = await gateway
        .connect(owner)
        .registerToken(ethers.ZeroAddress, tokenId + 1n, "Test Token", "TTK");

      let receipt = await tx.wait();

      let event = receipt.logs
        .map((log) => {
          try {
            return gateway.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log && log.name === "TokenRegistered");

      const contractAddress = event.args.contractAddress;

      const myTokenERC20 = await ethers.getContractAt(
        "MyToken",
        contractAddress,
      );

      const nativeTokenWalletContract = await impersonateAsContractAndMintFunds(
        await nativeTokenWallet.getAddress(),
      );

      //minting tokens for receiver
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myToken
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      //minting tokens for receiver
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(receiver.address, 10000);

      //minting tokens for wallet
      await myTokenERC20
        .connect(nativeTokenWalletContract)
        .mint(nativeTokenWalletContract, 10000);

      const nativeTokenWalletAddress = await nativeTokenWallet.getAddress();

      await myToken.connect(receiver).approve(nativeTokenWalletAddress, 1001);

      const value = { value: ethers.parseUnits("250", "wei") };
      await gateway
        .connect(receiver)
        .withdraw(1, receiverWithdrawMixTokens, 100, 50, value);

      await myToken.connect(receiver).approve(nativeTokenWalletAddress, 1001);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      const decoded = abiCoder.decode(
        ["tuple(uint64, uint64, uint256, tuple(address, uint256, uint256)[])"],
        dataMixTokens,
      );

      const [tupleValue] = decoded;
      const [[, ,], [, decodedAmount1], [, decodedAmount2]] = tupleValue[3];

      const receiverBalanceToken1 = await myToken.balanceOf(receiver.address);
      const walletBalanceToken1 = await myToken.balanceOf(
        nativeTokenWalletAddress,
      );

      const receiverBalanceToken2 = await myTokenERC20.balanceOf(
        receiver.address,
      );

      await gateway.deposit(
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        dataMixTokens,
      );

      expect(await myToken.balanceOf(receiver)).to.equal(
        receiverBalanceToken1 + decodedAmount1,
      );

      expect(await myToken.balanceOf(nativeTokenWalletAddress)).to.equal(
        walletBalanceToken1 - decodedAmount1,
      );

      expect(await myTokenERC20.balanceOf(receiver)).to.equal(
        receiverBalanceToken2 + decodedAmount2,
      );
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
  let receiverWithdrawMixTokens;
  let data;
  let dataMixTokens;
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
    receiverWithdrawMixTokens = fixture.receiverWithdrawMixTokens;
    data = fixture.data;
    dataMixTokens = fixture.dataMixTokens;
    provider = fixture.provider;
    connection = fixture.connection;
    ethers = fixture.ethers;
  });
});
