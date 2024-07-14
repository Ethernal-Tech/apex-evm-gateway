import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  ERC20TokenPredicate,
  ERC20TokenPredicate__factory,
  Gateway,
  Gateway__factory,
  // L2StateSender,
  // L2StateSender__factory,
  // StateReceiver,
  // StateReceiver__factory,
  ERC20Token,
  ERC20Token__factory,
  NativeERC20,
  NativeERC20__factory,
} from "../typechain-types";
import {
  setCode,
  setBalance,
  impersonateAccount,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { smock } from "@defi-wonderland/smock";
import { alwaysTrueBytecode } from "./constants";

describe("ERC20TokenPredicate", () => {
  async function impersonateAsContractAndMintFunds(contractAddress: string) {
    const hre = require("hardhat");
    const address = await contractAddress.toLowerCase();
    // impersonate as an contract on specified address
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });

    const signer = await ethers.getSigner(address);
    // minting 100000000000000000000 tokens to signer
    await ethers.provider.send("hardhat_setBalance", [signer.address, "0x56BC75E2D63100000"]);

    return signer;
  }

  let eRC20TokenPredicate: ERC20TokenPredicate,
    systemERC20TokenPredicate: ERC20TokenPredicate,
    stateReceiverERC20TokenPredicate: ERC20TokenPredicate,
    gateway: Gateway,
    // l2StateSender: L2StateSender,
    // stateReceiver: StateReceiver,
    rootERC20Predicate: string,
    eRC20Token: ERC20Token,
    nativeERC20: NativeERC20,
    nativeERC20RootToken: string,
    totalSupply: number = 0,
    rootToken: string,
    accounts: SignerWithAddress[];
  before(async () => {
    accounts = await ethers.getSigners();

    const Gateway: Gateway__factory = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy();

    await gateway.deployed();

    // const L2StateSender: L2StateSender__factory = await ethers.getContractFactory("L2StateSender");
    // l2StateSender = await L2StateSender.deploy();

    // await l2StateSender.deployed();

    // const StateReceiver: StateReceiver__factory = await ethers.getContractFactory("StateReceiver");
    // stateReceiver = await StateReceiver.deploy();

    // await stateReceiver.deployed();

    rootERC20Predicate = ethers.Wallet.createRandom().address;

    const ERC20Token: ERC20Token__factory = await ethers.getContractFactory("ERC20Token");
    eRC20Token = await ERC20Token.deploy();

    await eRC20Token.deployed();

    const ERC20TokenPredicate: ERC20TokenPredicate__factory = await ethers.getContractFactory("ERC20TokenPredicate");
    eRC20TokenPredicate = await ERC20TokenPredicate.deploy();

    await eRC20TokenPredicate.deployed();

    const NativeERC20: NativeERC20__factory = await ethers.getContractFactory("NativeERC20");

    const tempNativeERC20 = await NativeERC20.deploy();

    await tempNativeERC20.deployed();

    await setCode(
      "0x0000000000000000000000000000000000001010",
      await network.provider.send("eth_getCode", [tempNativeERC20.address])
    ); // Mock genesis NativeERC20 deployment

    nativeERC20 = NativeERC20.attach("0x0000000000000000000000000000000000001010") as NativeERC20;

    await setCode("0x0000000000000000000000000000000000002020", alwaysTrueBytecode); // Mock NATIVE_TRANSFER_PRECOMPILE

    nativeERC20RootToken = ethers.Wallet.createRandom().address;

    impersonateAccount("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");
    setBalance("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE", "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

    systemERC20TokenPredicate = eRC20TokenPredicate.connect(
      await ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE")
    );

    impersonateAccount(gateway.address);
    setBalance(gateway.address, "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    stateReceiverERC20TokenPredicate = eRC20TokenPredicate.connect(await ethers.getSigner(gateway.address));
  });

  it("fail initialization: unauthorized", async () => {
    await expect(
      eRC20TokenPredicate.initialize(
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000"
      )
    )
      .to.be.revertedWithCustomError(eRC20TokenPredicate, "Unauthorized")
      .withArgs("SYSTEMCALL");
  });

  it("fail bad initialization", async () => {
    await expect(
      systemERC20TokenPredicate.initialize(
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000"
      )
    ).to.be.revertedWith("ERC20TokenPredicate: BAD_INITIALIZATION");
  });

  it("initialize and validate initialization", async () => {
    await systemERC20TokenPredicate.initialize(
      gateway.address,
      rootERC20Predicate,
      eRC20Token.address,
      nativeERC20RootToken
    );
    const systemNativeERC20: NativeERC20 = nativeERC20.connect(
      await ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE")
    );
    await expect(systemNativeERC20.initialize(eRC20TokenPredicate.address, nativeERC20RootToken, "TEST", "TEST", 18, 0))
      .to.not.be.reverted;
    expect(await eRC20TokenPredicate.gateway()).to.equal(gateway.address);
    expect(await eRC20TokenPredicate.rootERC20Predicate()).to.equal(rootERC20Predicate);
    expect(await eRC20TokenPredicate.tokenTemplate()).to.equal(eRC20Token.address);
    expect(await eRC20TokenPredicate.rootTokenToToken(nativeERC20RootToken)).to.equal(
      "0x0000000000000000000000000000000000001010"
    );
  });

  it("fail reinitialization", async () => {
    await expect(
      systemERC20TokenPredicate.initialize(
        gateway.address,
        rootERC20Predicate,
        eRC20Token.address,
        nativeERC20RootToken
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("deposit tokens from root chain with same address", async () => {
    const randomAmount = Math.floor(Math.random() * 1000000 + 1);
    totalSupply += randomAmount;
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        nativeERC20RootToken,
        accounts[0].address,
        accounts[0].address,
        ethers.utils.parseUnits(String(randomAmount)),
      ]
    );

    const depositTx = await stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData);
    const depositReceipt = await depositTx.wait();
    stopImpersonatingAccount(stateReceiverERC20TokenPredicate.address);
    const depositEvent = depositReceipt.events?.find((log: { event: string }) => log.event === "Deposit");
    expect(depositEvent?.args?.rootToken).to.equal(nativeERC20RootToken);
    expect(depositEvent?.args?.token).to.equal(nativeERC20.address);
    expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
    expect(depositEvent?.args?.receiver).to.equal(accounts[0].address);
    expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
  });

  it("deposit tokens from root chain with different address", async () => {
    const randomAmount = Math.floor(Math.random() * 1000000 + 1);
    totalSupply += randomAmount;
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        nativeERC20RootToken,
        accounts[0].address,
        accounts[1].address,
        ethers.utils.parseUnits(String(randomAmount)),
      ]
    );
    const depositTx = await stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData);
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.events?.find((log: { event: string }) => log.event === "Deposit");
    expect(depositEvent?.args?.rootToken).to.equal(nativeERC20RootToken);
    expect(depositEvent?.args?.token).to.equal(nativeERC20.address);
    expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
    expect(depositEvent?.args?.receiver).to.equal(accounts[1].address);
    expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
  });

  it("map token success", async () => {
    rootToken = ethers.Wallet.createRandom().address;
    const clonesContract = await (await ethers.getContractFactory("MockClones")).deploy();
    const tokenAddr = await clonesContract.predictDeterministicAddress(
      eRC20Token.address,
      ethers.utils.solidityKeccak256(["address"], [rootToken]),
      eRC20TokenPredicate.address
    );
    const token = eRC20Token.attach(tokenAddr);
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "string", "string", "uint8"],
      [ethers.utils.solidityKeccak256(["string"], ["MAP_TOKEN"]), rootToken, "TEST1", "TEST1", 18]
    );
    const mapTx = await stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData);
    const mapReceipt = await mapTx.wait();
    const mapEvent = mapReceipt?.events?.find((log: { event: string }) => log.event === "TokenMapped");
    expect(mapEvent?.args?.rootToken).to.equal(rootToken);
    expect(mapEvent?.args?.token).to.equal(tokenAddr);
    expect(await token.predicate()).to.equal(eRC20TokenPredicate.address);
    expect(await token.rootToken()).to.equal(rootToken);
    expect(await token.name()).to.equal("TEST1");
    expect(await token.symbol()).to.equal("TEST1");
    expect(await token.decimals()).to.equal(18);
  });

  it("map token fail: invalid root token", async () => {
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "string", "string", "uint8"],
      [
        ethers.utils.solidityKeccak256(["string"], ["MAP_TOKEN"]),
        "0x0000000000000000000000000000000000000000",
        "TEST1",
        "TEST1",
        18,
      ]
    );
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWithPanic();
  });

  it("map token fail: already mapped", async () => {
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "string", "string", "uint8"],
      [ethers.utils.solidityKeccak256(["string"], ["MAP_TOKEN"]), rootToken, "TEST1", "TEST1", 18]
    );
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWithPanic();
  });

  it("withdraw tokens from child chain with same address", async () => {
    const randomAmount = Math.floor(Math.random() * (totalSupply - 10) + 1);
    totalSupply -= randomAmount;
    const depositTx = await eRC20TokenPredicate.withdraw(
      nativeERC20.address,
      "someone",
      ethers.utils.parseUnits(String(randomAmount))
    );
    const depositReceipt = await depositTx.wait();
    const depositEvent = depositReceipt.events?.find((log: any) => log.event === "Withdraw");
    expect(depositEvent?.args?.rootToken).to.equal(nativeERC20RootToken);
    expect(depositEvent?.args?.token).to.equal(nativeERC20.address);
    expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
    expect(depositEvent?.args?.receiver).to.equal("someone");
    expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
  });

  // it("withdraw tokens from child chain with same address", async () => {
  //   const randomAmount = Math.floor(Math.random() * (totalSupply - 10) + 1);
  //   totalSupply -= randomAmount;
  //   const depositTx = await eRC20TokenPredicate.withdrawTo(
  //     nativeERC20.address,
  //     accounts[1].address,
  //     ethers.utils.parseUnits(String(randomAmount))
  //   );
  //   const depositReceipt = await depositTx.wait();
  //   const depositEvent = depositReceipt.events?.find((log: any) => log.event === "Withdraw");
  //   expect(depositEvent?.args?.rootToken).to.equal(nativeERC20RootToken);
  //   expect(depositEvent?.args?.token).to.equal(nativeERC20.address);
  //   expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
  //   expect(depositEvent?.args?.receiver).to.equal(accounts[1].address);
  //   expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
  // });

  it("fail deposit tokens: only gateway", async () => {
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        "0x0000000000000000000000000000000000000000",
        accounts[0].address,
        accounts[0].address,
        accounts[0].address,
        0,
      ]
    );
    await expect(eRC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWith(
      "ERC20TokenPredicate: ONLY_GATEWAY_ALLOWED"
    );
  });

  // it("fail deposit tokens: only root predicate", async () => {
  //   const stateSyncData = ethers.utils.defaultAbiCoder.encode(
  //     ["bytes32", "address", "address", "address", "address", "uint256"],
  //     [
  //       ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
  //       "0x0000000000000000000000000000000000000000",
  //       accounts[0].address,
  //       accounts[0].address,
  //       accounts[0].address,
  //       0,
  //     ]
  //   );
  //   await expect(
  //     stateReceiverERC20TokenPredicate.onStateReceive(0, ethers.Wallet.createRandom().address, stateSyncData)
  //   ).to.be.revertedWith("ERC20TokenPredicate: ONLY_ROOT_PREDICATE");
  // });

  it("fail deposit tokens: invalid signature", async () => {
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "address", "uint256"],
      [
        ethers.utils.randomBytes(32),
        nativeERC20RootToken,
        nativeERC20.address,
        accounts[0].address,
        accounts[0].address,
        1,
      ]
    );
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWith(
      "ERC20TokenPredicate: INVALID_SIGNATURE"
    );
  });

  it("fail deposit tokens of unknown child token: not a contract", async () => {
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        "0x0000000000000000000000000000000000000000",
        accounts[0].address,
        accounts[0].address,
        0,
      ]
    );
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWith(
      "ERC20TokenPredicate: UNMAPPED_TOKEN"
    );
  });

  it("fail withdraw tokens of unknown child token: not a contract", async () => {
    await expect(eRC20TokenPredicate.withdraw(ethers.Wallet.createRandom().address, "someone", 1)).to.be.revertedWith(
      "ERC20TokenPredicate: NOT_CONTRACT"
    );
  });

  it("fail deposit tokens of unknown child token: wrong deposit token", async () => {
    eRC20TokenPredicate.connect(await ethers.getSigner(gateway.address));
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        "0x0000000000000000000000000000000000000000",
        nativeERC20.address,
        accounts[0].address,
        accounts[0].address,
        0,
      ]
    );
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWith(
      "ERC20TokenPredicate: UNMAPPED_TOKEN"
    );
  });

  it("fail deposit tokens of unknown child token: unmapped token", async () => {
    const rootToken = ethers.Wallet.createRandom().address;
    const token = await (await ethers.getContractFactory("ERC20Token")).deploy();
    await token.initialize(rootToken, "TEST", "TEST", 18);
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        rootToken,
        token.address,
        accounts[0].address,
        accounts[0].address,
        0,
      ]
    );
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWith(
      "ERC20TokenPredicate: UNMAPPED_TOKEN"
    );
  });

  it("fail withdraw tokens of unknown child token: unmapped token", async () => {
    const rootToken = ethers.Wallet.createRandom().address;
    const token = await (await ethers.getContractFactory("ERC20Token")).deploy();
    await token.initialize(rootToken, "TEST", "TEST", 18);
    await expect(stateReceiverERC20TokenPredicate.withdraw(token.address, "someone", 1)).to.be.revertedWith(
      "ERC20TokenPredicate: UNMAPPED_TOKEN"
    );
  });

  // since we fake NativeERC20 here, keep this function last:
  it("fail deposit tokens: mint failed", async () => {
    const stateSyncData = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "address", "address", "address", "uint256"],
      [
        ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
        nativeERC20RootToken,
        nativeERC20.address,
        accounts[0].address,
        accounts[0].address,
        1,
      ]
    );
    const fakeNativeERC20 = await smock.fake<NativeERC20>("NativeERC20", {
      address: "0x0000000000000000000000000000000000001010",
    });
    fakeNativeERC20.rootToken.returns(nativeERC20RootToken);
    fakeNativeERC20.predicate.returns(stateReceiverERC20TokenPredicate.address);
    fakeNativeERC20.mint.returns(false);
    await expect(stateReceiverERC20TokenPredicate.onStateReceive(0, stateSyncData)).to.be.revertedWith(
      "ERC20TokenPredicate: MINT_FAILED"
    );
    fakeNativeERC20.mint.returns();
  });

  it("fail withdraw tokens: burn failed", async () => {
    const fakeNativeERC20 = await smock.fake<NativeERC20>("NativeERC20", {
      address: "0x0000000000000000000000000000000000001010",
    });
    fakeNativeERC20.rootToken.returns(nativeERC20RootToken);
    fakeNativeERC20.predicate.returns(stateReceiverERC20TokenPredicate.address);
    fakeNativeERC20.burn.returns(false);
    await expect(stateReceiverERC20TokenPredicate.withdraw(nativeERC20.address, "someone", 1)).to.be.revertedWith(
      "ERC20TokenPredicate: BURN_FAILED"
    );
  });
});
