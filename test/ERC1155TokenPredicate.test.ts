// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { BigNumber } from "ethers";
// import {
//   ERC1155TokenPredicate,
//   ERC1155TokenPredicate__factory,
//   L2StateSender,
//   L2StateSender__factory,
//   StateReceiver,
//   StateReceiver__factory,
//   ERC1155Token,
//   ERC1155Token__factory,
// } from "../typechain-types";
// import { setBalance, impersonateAccount, stopImpersonatingAccount } from "@nomicfoundation/hardhat-network-helpers";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { smock } from "@defi-wonderland/smock";

// describe("ERC1155TokenPredicate", () => {
//   let eRC1155TokenPredicate: ERC1155TokenPredicate,
//     systemERC1155TokenPredicate: ERC1155TokenPredicate,
//     stateReceiverERC1155TokenPredicate: ERC1155TokenPredicate,
//     l2StateSender: L2StateSender,
//     stateReceiver: StateReceiver,
//     rootERC1155Predicate: string,
//     eRC1155Token: ERC1155Token,
//     rootToken: string,
//     tokenAddr: string,
//     depositedTokenIds: number[] = [],
//     batchDepositedTokenIds: number[] = [],
//     batchDepositedTokenAmounts: BigNumber[] = [],
//     accounts: SignerWithAddress[];
//   before(async () => {
//     accounts = await ethers.getSigners();

//     const L2StateSender: L2StateSender__factory = await ethers.getContractFactory("L2StateSender");
//     l2StateSender = await L2StateSender.deploy();

//     await l2StateSender.deployed();

//     const StateReceiver: StateReceiver__factory = await ethers.getContractFactory("StateReceiver");
//     stateReceiver = await StateReceiver.deploy();

//     await stateReceiver.deployed();

//     rootERC1155Predicate = ethers.Wallet.createRandom().address;

//     const ERC1155Token: ERC1155Token__factory = await ethers.getContractFactory("ERC1155Token");
//     eRC1155Token = await ERC1155Token.deploy();

//     await eRC1155Token.deployed();

//     const ERC1155TokenPredicate: ERC1155TokenPredicate__factory = await ethers.getContractFactory(
//       "ERC1155TokenPredicate"
//     );
//     eRC1155TokenPredicate = await ERC1155TokenPredicate.deploy();

//     await eRC1155TokenPredicate.deployed();

//     impersonateAccount("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE");
//     setBalance("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE", "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

//     systemERC1155TokenPredicate = eRC1155TokenPredicate.connect(
//       await ethers.getSigner("0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE")
//     );

//     impersonateAccount(stateReceiver.address);
//     setBalance(stateReceiver.address, "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
//     stateReceiverERC1155TokenPredicate = eRC1155TokenPredicate.connect(await ethers.getSigner(stateReceiver.address));
//   });

//   it("fail initialization: unauthorized", async () => {
//     await expect(
//       eRC1155TokenPredicate.initialize(
//         "0x0000000000000000000000000000000000000000",
//         "0x0000000000000000000000000000000000000000",
//         "0x0000000000000000000000000000000000000000",
//         "0x0000000000000000000000000000000000000000"
//       )
//     )
//       .to.be.revertedWithCustomError(eRC1155TokenPredicate, "Unauthorized")
//       .withArgs("SYSTEMCALL");
//   });

//   it("fail bad initialization", async () => {
//     await expect(
//       systemERC1155TokenPredicate.initialize(
//         "0x0000000000000000000000000000000000000000",
//         "0x0000000000000000000000000000000000000000",
//         "0x0000000000000000000000000000000000000000",
//         "0x0000000000000000000000000000000000000000"
//       )
//     ).to.be.revertedWith("ERC1155TokenPredicate: BAD_INITIALIZATION");
//   });

//   it("initialize and validate initialization", async () => {
//     await systemERC1155TokenPredicate.initialize(
//       l2StateSender.address,
//       stateReceiver.address,
//       rootERC1155Predicate,
//       eRC1155Token.address
//     );
//     expect(await eRC1155TokenPredicate.l2StateSender()).to.equal(l2StateSender.address);
//     expect(await eRC1155TokenPredicate.stateReceiver()).to.equal(stateReceiver.address);
//     expect(await eRC1155TokenPredicate.rootERC1155Predicate()).to.equal(rootERC1155Predicate);
//     expect(await eRC1155TokenPredicate.tokenTemplate()).to.equal(eRC1155Token.address);
//   });

//   it("fail reinitialization", async () => {
//     await expect(
//       systemERC1155TokenPredicate.initialize(
//         l2StateSender.address,
//         stateReceiver.address,
//         rootERC1155Predicate,
//         eRC1155Token.address
//       )
//     ).to.be.revertedWith("Initializable: contract is already initialized");
//   });

//   it("map token success", async () => {
//     rootToken = ethers.Wallet.createRandom().address;
//     const clonesContract = await (await ethers.getContractFactory("MockClones")).deploy();
//     tokenAddr = await clonesContract.predictDeterministicAddress(
//       eRC1155Token.address,
//       ethers.utils.solidityKeccak256(["address"], [rootToken]),
//       eRC1155TokenPredicate.address
//     );
//     const token = eRC1155Token.attach(tokenAddr);
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "string", "string", "uint8"],
//       [ethers.utils.solidityKeccak256(["string"], ["MAP_TOKEN"]), rootToken, "TEST1", "TEST1", 18]
//     );
//     const mapTx = await stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData);
//     const mapReceipt = await mapTx.wait();
//     const mapEvent = mapReceipt?.events?.find((log: { event: string }) => log.event === "L2TokenMapped");
//     expect(mapEvent?.args?.rootToken).to.equal(rootToken);
//     expect(mapEvent?.args?.token).to.equal(tokenAddr);
//     expect(await token.predicate()).to.equal(eRC1155TokenPredicate.address);
//     expect(await token.rootToken()).to.equal(rootToken);
//   });

//   it("map token fail: invalid root token", async () => {
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "string", "string", "uint8"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["MAP_TOKEN"]),
//         "0x0000000000000000000000000000000000000000",
//         "TEST1",
//         "TEST1",
//         18,
//       ]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWithPanic();
//   });

//   it("map token fail: already mapped", async () => {
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "string", "string", "uint8"],
//       [ethers.utils.solidityKeccak256(["string"], ["MAP_TOKEN"]), rootToken, "TEST1", "TEST1", 18]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWithPanic();
//   });

//   it("deposit tokens from root chain with same address", async () => {
//     const randomAmount = Math.floor(Math.random() * 1000000 + 1);
//     depositedTokenIds.push(randomAmount);
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         rootToken,
//         accounts[0].address,
//         accounts[0].address,
//         randomAmount,
//         ethers.utils.parseUnits(String(randomAmount)),
//       ]
//     );
//     const depositTx = await stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData);
//     const depositReceipt = await depositTx.wait();
//     stopImpersonatingAccount(stateReceiverERC1155TokenPredicate.address);
//     const depositEvent = depositReceipt.events?.find((log: { event: string }) => log.event === "L2ERC1155Deposit");
//     expect(depositEvent?.args?.rootToken).to.equal(rootToken);
//     expect(depositEvent?.args?.token).to.equal(tokenAddr);
//     expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.receiver).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.tokenId).to.equal(randomAmount);
//     expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
//   });

//   it("deposit tokens from root chain with different address", async () => {
//     const randomAmount = Math.floor(Math.random() * 1000000 + 1);
//     depositedTokenIds.push(randomAmount);
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         rootToken,
//         accounts[0].address,
//         accounts[1].address,
//         randomAmount,
//         ethers.utils.parseUnits(String(randomAmount)),
//       ]
//     );
//     const depositTx = await stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData);
//     const depositReceipt = await depositTx.wait();
//     const depositEvent = depositReceipt.events?.find((log: { event: string }) => log.event === "L2ERC1155Deposit");
//     expect(depositEvent?.args?.rootToken).to.equal(rootToken);
//     expect(depositEvent?.args?.token).to.equal(tokenAddr);
//     expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.receiver).to.equal(accounts[1].address);
//     expect(depositEvent?.args?.tokenId).to.equal(randomAmount);
//     expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
//   });

//   it("batch deposit tokens from root chain: success", async () => {
//     const batchSize = Math.floor(Math.random() * 10 + 2);
//     const receiverArr = [];
//     for (let i = 0; i < batchSize; i++) {
//       const randomAmount = Math.floor(Math.random() * 1000000 + 1);
//       batchDepositedTokenIds.push(randomAmount);
//       receiverArr.push(accounts[2].address);
//     }
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address[]", "uint256[]", "uint256[]"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT_BATCH"]),
//         rootToken,
//         accounts[0].address,
//         receiverArr,
//         batchDepositedTokenIds,
//         batchDepositedTokenIds.map((tokenId) => ethers.utils.parseUnits(String(tokenId))),
//       ]
//     );
//     const depositTx = await stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData);
//     const depositReceipt = await depositTx.wait();
//     stopImpersonatingAccount(stateReceiverERC1155TokenPredicate.address);
//     const depositEvent = depositReceipt.events?.find((log: { event: string }) => log.event === "L2ERC1155DepositBatch");
//     expect(depositEvent?.args?.rootToken).to.equal(rootToken);
//     expect(depositEvent?.args?.token).to.equal(tokenAddr);
//     expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.receivers).to.deep.equal(receiverArr);
//     expect(depositEvent?.args?.tokenIds).to.deep.equal(batchDepositedTokenIds);
//     expect(depositEvent?.args?.amounts).to.deep.equal(
//       batchDepositedTokenIds.map((tokenId) => ethers.utils.parseUnits(String(tokenId)))
//     );
//   });

//   it("withdraw tokens from chain with same address", async () => {
//     const randomAmount = Math.floor(Math.random() * depositedTokenIds[0] + 1);
//     const depositTx = await eRC1155TokenPredicate.withdraw(
//       tokenAddr,
//       depositedTokenIds[0],
//       ethers.utils.parseUnits(String(randomAmount))
//     );
//     const depositReceipt = await depositTx.wait();
//     const depositEvent = depositReceipt.events?.find((log: any) => log.event === "L2ERC1155Withdraw");
//     expect(depositEvent?.args?.rootToken).to.equal(rootToken);
//     expect(depositEvent?.args?.token).to.equal(tokenAddr);
//     expect(depositEvent?.args?.sender).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.receiver).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.tokenId).to.equal(depositedTokenIds[0]);
//     expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
//   });

//   it("withdraw tokens from chain with different address", async () => {
//     const randomAmount = Math.floor(Math.random() * depositedTokenIds[1] + 1);
//     const depositTx = await eRC1155TokenPredicate
//       .connect(accounts[1])
//       .withdrawTo(tokenAddr, accounts[0].address, depositedTokenIds[1], ethers.utils.parseUnits(String(randomAmount)));
//     const depositReceipt = await depositTx.wait();
//     const depositEvent = depositReceipt.events?.find((log: any) => log.event === "L2ERC1155Withdraw");
//     expect(depositEvent?.args?.rootToken).to.equal(rootToken);
//     expect(depositEvent?.args?.token).to.equal(tokenAddr);
//     expect(depositEvent?.args?.sender).to.equal(accounts[1].address);
//     expect(depositEvent?.args?.receiver).to.equal(accounts[0].address);
//     expect(depositEvent?.args?.tokenId).to.equal(depositedTokenIds[1]);
//     expect(depositEvent?.args?.amount).to.equal(ethers.utils.parseUnits(String(randomAmount)));
//   });

//   it("batch withdraw tokens from chain: success", async () => {
//     const batchSize = Math.max(1, Math.floor(Math.random() * batchDepositedTokenIds.length));
//     const receiverArr = [];
//     for (let i = 0; i < batchSize; i++) {
//       receiverArr.push(accounts[1].address);
//     }
//     batchDepositedTokenAmounts = batchDepositedTokenIds.map((tokenId) => ethers.utils.parseUnits(String(tokenId)));
//     const depositTx = await eRC1155TokenPredicate.connect(accounts[2]).withdrawBatch(
//       tokenAddr,
//       receiverArr,
//       batchDepositedTokenIds.slice(0, batchSize),
//       batchDepositedTokenIds.slice(0, batchSize).map((tokenId) => ethers.utils.parseUnits(String(tokenId)))
//     );
//     const depositReceipt = await depositTx.wait();
//     const depositEvent = depositReceipt.events?.find((log: any) => log.event === "L2ERC1155WithdrawBatch");
//     expect(depositEvent?.args?.rootToken).to.equal(rootToken);
//     expect(depositEvent?.args?.token).to.equal(tokenAddr);
//     expect(depositEvent?.args?.sender).to.equal(accounts[2].address);
//     expect(depositEvent?.args?.receivers).to.deep.equal(receiverArr);
//     expect(depositEvent?.args?.tokenIds).to.deep.equal(batchDepositedTokenIds.slice(0, batchSize));
//     expect(depositEvent?.args?.amounts).to.deep.equal(
//       batchDepositedTokenIds.slice(0, batchSize).map((tokenId) => ethers.utils.parseUnits(String(tokenId)))
//     );
//   });

//   it("fail deposit tokens: only state receiver", async () => {
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         "0x0000000000000000000000000000000000000000",
//         accounts[0].address,
//         accounts[0].address,
//         0,
//         0,
//       ]
//     );
//     await expect(eRC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)).to.be.revertedWith(
//       "ERC1155TokenPredicate: ONLY_STATE_RECEIVER"
//     );
//   });

//   it("fail deposit tokens: only root predicate", async () => {
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "address", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         "0x0000000000000000000000000000000000000000",
//         accounts[0].address,
//         accounts[0].address,
//         accounts[0].address,
//         0,
//       ]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, ethers.Wallet.createRandom().address, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: ONLY_ROOT_PREDICATE");
//   });

//   it("fail deposit tokens: invalid signature", async () => {
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [ethers.utils.randomBytes(32), ethers.constants.AddressZero, accounts[0].address, accounts[0].address, 0, 0]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: INVALID_SIGNATURE");
//   });

//   it("fail deposit tokens of unknown token: unmapped token", async () => {
//     let stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         "0x0000000000000000000000000000000000000000",
//         accounts[0].address,
//         accounts[0].address,
//         0,
//         0,
//       ]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: UNMAPPED_TOKEN");
//   });

//   it("fail withdraw tokens of unknown token: not a contract", async () => {
//     await expect(eRC1155TokenPredicate.withdraw(ethers.Wallet.createRandom().address, 0, 1)).to.be.revertedWith(
//       "ERC1155TokenPredicate: NOT_CONTRACT"
//     );
//     await expect(
//       eRC1155TokenPredicate.withdrawBatch(
//         ethers.Wallet.createRandom().address,
//         [ethers.constants.AddressZero],
//         [0],
//         [1]
//       )
//     ).to.be.revertedWith("ERC1155TokenPredicate: NOT_CONTRACT");
//   });

//   it("fail deposit tokens of unknown token: wrong deposit token", async () => {
//     eRC1155TokenPredicate.connect(await ethers.getSigner(stateReceiver.address));
//     const stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         "0x0000000000000000000000000000000000000000",
//         accounts[0].address,
//         accounts[0].address,
//         0,
//         0,
//       ]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: UNMAPPED_TOKEN");
//   });

//   it("fail deposit tokens of unknown token: unmapped token", async () => {
//     const rootToken = ethers.Wallet.createRandom().address;
//     const token = await (await ethers.getContractFactory("ERC1155Token")).deploy();
//     await token.initialize(rootToken, "TEST");
//     let stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         ethers.Wallet.createRandom().address,
//         accounts[0].address,
//         accounts[0].address,
//         0,
//         0,
//       ]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: UNMAPPED_TOKEN");
//     stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address[]", "uint256[]", "uint256[]"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT_BATCH"]),
//         ethers.Wallet.createRandom().address,
//         accounts[0].address,
//         [accounts[0].address],
//         [0],
//         [0],
//       ]
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: UNMAPPED_TOKEN");
//   });

//   it("fail withdraw tokens of unknown token: unmapped token", async () => {
//     const rootToken = ethers.Wallet.createRandom().address;
//     const token = await (await ethers.getContractFactory("ERC1155Token")).deploy();
//     await token.initialize(rootToken, "TEST");
//     await expect(stateReceiverERC1155TokenPredicate.withdraw(token.address, 0, 1)).to.be.revertedWith(
//       "ERC1155TokenPredicate: UNMAPPED_TOKEN"
//     );
//     await expect(
//       stateReceiverERC1155TokenPredicate.withdrawBatch(token.address, [ethers.constants.AddressZero], [0], [1])
//     ).to.be.revertedWith("ERC1155TokenPredicate: UNMAPPED_TOKEN");
//   });

//   // since we fake NativeERC20 here, keep this function last:
//   it("fail deposit tokens: mint failed", async () => {
//     let stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address", "uint256", "uint256"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT"]),
//         rootToken,
//         accounts[0].address,
//         accounts[0].address,
//         1,
//         1,
//       ]
//     );
//     const fakeERC1155 = await smock.fake<ERC1155Token>("ERC1155Token", {
//       address: tokenAddr,
//     });
//     fakeERC1155.supportsInterface.returns(true);
//     fakeERC1155.rootToken.returns(rootToken);
//     fakeERC1155.predicate.returns(eRC1155TokenPredicate.address);
//     fakeERC1155.mint.returns(false);
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: MINT_FAILED");
//     stateSyncData = ethers.utils.defaultAbiCoder.encode(
//       ["bytes32", "address", "address", "address[]", "uint256[]", "uint256[]"],
//       [
//         ethers.utils.solidityKeccak256(["string"], ["DEPOSIT_BATCH"]),
//         rootToken,
//         accounts[0].address,
//         [accounts[0].address],
//         [1],
//         [1],
//       ]
//     );
//     fakeERC1155.mintBatch.returns(false);
//     await expect(
//       stateReceiverERC1155TokenPredicate.onStateReceive(0, rootERC1155Predicate, stateSyncData)
//     ).to.be.revertedWith("ERC1155TokenPredicate: MINT_FAILED");
//   });

//   it("fail withdraw tokens: burn failed", async () => {
//     const fakeERC1155 = await smock.fake<ERC1155Token>("ERC1155Token", {
//       address: tokenAddr,
//     });
//     fakeERC1155.supportsInterface.returns(true);
//     fakeERC1155.rootToken.returns(rootToken);
//     fakeERC1155.predicate.returns(eRC1155TokenPredicate.address);
//     fakeERC1155.burn.returns(false);
//     await expect(stateReceiverERC1155TokenPredicate.withdraw(tokenAddr, 0, 1)).to.be.revertedWith(
//       "ERC1155TokenPredicate: BURN_FAILED"
//     );
//     fakeERC1155.burnBatch.returns(false);
//     await expect(
//       stateReceiverERC1155TokenPredicate.withdrawBatch(tokenAddr, [ethers.constants.AddressZero], [0], [1])
//     ).to.be.revertedWith("ERC1155TokenPredicate: BURN_FAILED");
//   });

//   it("fail withdraw tokens: bad interface", async () => {
//     const fakeERC1155 = await smock.fake<ERC1155Token>("ERC1155Token", {
//       address: tokenAddr,
//     });
//     fakeERC1155.supportsInterface.reverts();
//     await expect(stateReceiverERC1155TokenPredicate.withdraw(tokenAddr, 0, 1)).to.be.revertedWith(
//       "ERC1155TokenPredicate: NOT_CONTRACT"
//     );
//   });
// });
