import { expect } from "chai";
import { ethers, network } from "hardhat";
import { ERC20Token, ERC20Token__factory, ERC20TokenPredicate, ERC20TokenPredicate__factory } from "../typechain-types";
import { setBalance, impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ERC20Token", () => {
  let eRC20Token: ERC20Token,
    predicateERC20Token: ERC20Token,
    eRC20TokenPredicate: ERC20TokenPredicate,
    rootToken: string,
    totalSupply: number,
    accounts: SignerWithAddress[];
  before(async () => {
    accounts = await ethers.getSigners();

    const ERC20Token: ERC20Token__factory = await ethers.getContractFactory("ERC20Token");
    eRC20Token = await ERC20Token.deploy();

    await eRC20Token.deployed();

    const ERC20TokenPredicate: ERC20TokenPredicate__factory = await ethers.getContractFactory("ERC20TokenPredicate");
    eRC20TokenPredicate = await ERC20TokenPredicate.deploy();

    await eRC20TokenPredicate.deployed();

    impersonateAccount(eRC20TokenPredicate.address);
    setBalance(eRC20TokenPredicate.address, "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

    rootToken = ethers.Wallet.createRandom().address;

    totalSupply = 0;
  });

  it("fail initialization", async () => {
    await expect(eRC20Token.initialize(ethers.constants.AddressZero, "", "", 0)).to.be.revertedWith(
      "ERC20Token: BAD_INITIALIZATION"
    );
  });

  it("initialize and validate initialization", async () => {
    expect(await eRC20Token.rootToken()).to.equal(ethers.constants.AddressZero);
    expect(await eRC20Token.predicate()).to.equal(ethers.constants.AddressZero);
    expect(await eRC20Token.name()).to.equal("");
    expect(await eRC20Token.symbol()).to.equal("");
    expect(await eRC20Token.decimals()).to.equal(0);

    predicateERC20Token = eRC20Token.connect(await ethers.getSigner(eRC20TokenPredicate.address));
    await predicateERC20Token.initialize(rootToken, "TEST", "TEST", 18);

    expect(await eRC20Token.rootToken()).to.equal(rootToken);
    expect(await eRC20Token.predicate()).to.equal(eRC20TokenPredicate.address);
    expect(await eRC20Token.name()).to.equal("TEST");
    expect(await eRC20Token.symbol()).to.equal("TEST");
    expect(await eRC20Token.decimals()).to.equal(18);
  });

  it("fail reinitialization", async () => {
    await expect(eRC20Token.initialize(ethers.constants.AddressZero, "", "", 0)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
  });

  it("mint tokens fail: only predicate", async () => {
    await expect(eRC20Token.mint(ethers.constants.AddressZero, 0)).to.be.revertedWith(
      "ERC20Token: Only predicate can call"
    );
  });

  it("burn tokens fail: only predicate", async () => {
    await expect(eRC20Token.burn(ethers.constants.AddressZero, 0)).to.be.revertedWith(
      "ERC20Token: Only predicate can call"
    );
  });

  it("mint tokens success", async () => {
    const randomAmount = Math.floor(Math.random() * 1000000 + 1);
    totalSupply += randomAmount;
    const mintTx = await predicateERC20Token.mint(accounts[0].address, ethers.utils.parseUnits(String(randomAmount)));
    const mintReceipt = await mintTx.wait();

    const transferEvent = mintReceipt?.events?.find((log: { event: string }) => log.event === "Transfer");

    expect(transferEvent?.args?.from).to.equal(ethers.constants.AddressZero);
    expect(transferEvent?.args?.to).to.equal(accounts[0].address);
    expect(transferEvent?.args?.value).to.equal(ethers.utils.parseUnits(String(randomAmount)));
    expect(await eRC20Token.totalSupply()).to.equal(ethers.utils.parseUnits(String(randomAmount)));
  });

  it("execute meta-tx: fail", async () => {
    const domain = {
      name: "TEST",
      version: "1",
      chainId: network.config.chainId,
      verifyingContract: eRC20Token.address,
    };

    const types = {
      MetaTransaction: [
        { name: "nonce", type: "uint256" },
        { name: "from", type: "address" },
        { name: "functionSignature", type: "bytes" },
      ],
    };

    const functionData = eRC20Token.interface.encodeFunctionData("transfer", [accounts[0].address, 1]);
    const value = {
      nonce: 0,
      from: accounts[0].address,
      functionSignature: eRC20Token.interface.encodeFunctionData("transfer", [accounts[0].address, 1]),
    };

    const signature = await (await ethers.getSigner(accounts[0].address))._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x".concat(signature.slice(66, 130));
    let v: any = "0x".concat(signature.slice(130, 132));
    v = ethers.BigNumber.from(v).toNumber();
    await expect(eRC20Token.executeMetaTransaction(accounts[1].address, functionData, r, s, v)).to.be.revertedWith(
      "Signer and signature do not match"
    );
  });

  it("execute meta-tx: success", async () => {
    const domain = {
      name: "TEST",
      version: "1",
      chainId: network.config.chainId,
      verifyingContract: eRC20Token.address,
    };

    const types = {
      MetaTransaction: [
        { name: "nonce", type: "uint256" },
        { name: "from", type: "address" },
        { name: "functionSignature", type: "bytes" },
      ],
    };

    const functionData = eRC20Token.interface.encodeFunctionData("transfer", [accounts[0].address, 1]);
    const value = {
      nonce: 0,
      from: accounts[0].address,
      functionSignature: eRC20Token.interface.encodeFunctionData("transfer", [accounts[0].address, 1]),
    };

    const signature = await (await ethers.getSigner(accounts[0].address))._signTypedData(domain, types, value);
    const r = signature.slice(0, 66);
    const s = "0x".concat(signature.slice(66, 130));
    let v: any = "0x".concat(signature.slice(130, 132));
    v = ethers.BigNumber.from(v).toNumber();
    const transferTx = await eRC20Token.executeMetaTransaction(accounts[0].address, functionData, r, s, v);
    const transferReceipt = await transferTx.wait();

    const transferEvent = transferReceipt?.events?.find((log: { event: string }) => log.event === "Transfer");
    expect(transferEvent?.args?.from).to.equal(accounts[0].address);
    expect(transferEvent?.args?.to).to.equal(accounts[0].address);
    expect(transferEvent?.args?.value).to.equal(1);
  });

  it("burn tokens success", async () => {
    const randomAmount = Math.floor(Math.random() * totalSupply + 1);
    totalSupply -= randomAmount;
    const burnTx = await predicateERC20Token.burn(accounts[0].address, ethers.utils.parseUnits(String(randomAmount)));
    const burnReceipt = await burnTx.wait();

    const transferEvent = burnReceipt?.events?.find((log: any) => log.event === "Transfer");
    expect(transferEvent?.args?.from).to.equal(accounts[0].address);
    expect(transferEvent?.args?.to).to.equal(ethers.constants.AddressZero);
    expect(transferEvent?.args?.value).to.equal(ethers.utils.parseUnits(String(randomAmount)));
    expect(await eRC20Token.totalSupply()).to.equal(ethers.utils.parseUnits(String(totalSupply)));
  });
});
