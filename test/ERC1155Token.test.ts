// import { expect } from "chai";
// import { ethers, network } from "hardhat";
// import {
//   ERC1155Token,
//   ERC1155Token__factory,
//   ERC1155TokenPredicate,
//   ERC1155TokenPredicate__factory,
// } from "../typechain-types";
// import { setBalance, impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// describe("ERC1155Token", () => {
//   let eRC1155Token: ERC1155Token,
//     predicateERC1155Token: ERC1155Token,
//     eRC1155TokenPredicate: ERC1155TokenPredicate,
//     rootToken: string,
//     accounts: SignerWithAddress[];
//   before(async () => {
//     accounts = await ethers.getSigners();

//     const ERC1155Token: ERC1155Token__factory = await ethers.getContractFactory("ERC1155Token");
//     eRC1155Token = await ERC1155Token.deploy();

//     await eRC1155Token.deployed();

//     const ERC1155TokenPredicate: ERC1155TokenPredicate__factory = await ethers.getContractFactory(
//       "ERC1155TokenPredicate"
//     );
//     eRC1155TokenPredicate = await ERC1155TokenPredicate.deploy();

//     await eRC1155TokenPredicate.deployed();

//     impersonateAccount(eRC1155TokenPredicate.address);
//     setBalance(eRC1155TokenPredicate.address, "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

//     rootToken = ethers.Wallet.createRandom().address;
//   });

//   it("fail initialization", async () => {
//     await expect(eRC1155Token.initialize(ethers.constants.AddressZero, "")).to.be.revertedWith(
//       "ERC1155Token: BAD_INITIALIZATION"
//     );
//   });

//   it("initialize and validate initialization", async () => {
//     expect(await eRC1155Token.rootToken()).to.equal(ethers.constants.AddressZero);
//     expect(await eRC1155Token.predicate()).to.equal(ethers.constants.AddressZero);

//     predicateERC1155Token = eRC1155Token.connect(await ethers.getSigner(eRC1155TokenPredicate.address));
//     await predicateERC1155Token.initialize(rootToken, "TEST");

//     expect(await eRC1155Token.rootToken()).to.equal(rootToken);
//     expect(await eRC1155Token.predicate()).to.equal(eRC1155TokenPredicate.address);
//   });

//   it("fail reinitialization", async () => {
//     await expect(eRC1155Token.initialize(ethers.constants.AddressZero, "")).to.be.revertedWith(
//       "Initializable: contract is already initialized"
//     );
//   });

//   it("mint tokens fail: only predicate", async () => {
//     await expect(eRC1155Token.mint(ethers.constants.AddressZero, 0, 1)).to.be.revertedWith(
//       "ERC1155Token: Only predicate can call"
//     );
//   });

//   it("burn tokens fail: only predicate", async () => {
//     await expect(eRC1155Token.burn(ethers.constants.AddressZero, 0, 1)).to.be.revertedWith(
//       "ERC1155Token: Only predicate can call"
//     );
//   });

//   it("mint tokens success", async () => {
//     const mintTx = await predicateERC1155Token.mint(accounts[0].address, 0, 1);
//     const mintReceipt = await mintTx.wait();

//     const transferEvent = mintReceipt?.events?.find((log: { event: string }) => log.event === "TransferSingle");

//     expect(transferEvent?.args?.from).to.equal(ethers.constants.AddressZero);
//     expect(transferEvent?.args?.to).to.equal(accounts[0].address);
//     expect(transferEvent?.args?.id).to.equal(0);
//     expect(transferEvent?.args?.value).to.equal(1);
//   });

//   it("execute meta-tx: fail", async () => {
//     const domain = {
//       name: "TEST",
//       version: "1",
//       chainId: network.config.chainId,
//       verifyingContract: eRC1155Token.address,
//     };

//     const types = {
//       MetaTransaction: [
//         { name: "nonce", type: "uint256" },
//         { name: "from", type: "address" },
//         { name: "functionSignature", type: "bytes" },
//       ],
//     };

//     const functionData = eRC1155Token.interface.encodeFunctionData("safeTransferFrom", [
//       accounts[0].address,
//       accounts[1].address,
//       0,
//       1,
//       [],
//     ]);
//     const value = {
//       nonce: 0,
//       from: accounts[0].address,
//       functionSignature: eRC1155Token.interface.encodeFunctionData("safeTransferFrom", [
//         accounts[0].address,
//         accounts[1].address,
//         0,
//         1,
//         [],
//       ]),
//     };

//     const signature = await (await ethers.getSigner(accounts[0].address))._signTypedData(domain, types, value);
//     const r = signature.slice(0, 66);
//     const s = "0x".concat(signature.slice(66, 130));
//     let v: any = "0x".concat(signature.slice(130, 132));
//     v = ethers.BigNumber.from(v).toNumber();
//     await expect(eRC1155Token.executeMetaTransaction(accounts[1].address, functionData, r, s, v)).to.be.revertedWith(
//       "Signer and signature do not match"
//     );
//   });

//   it("execute meta-tx: success", async () => {
//     const domain = {
//       name: `ERC1155Token-${(await eRC1155Token.rootToken()).toLowerCase()}`,
//       version: "1",
//       chainId: network.config.chainId,
//       verifyingContract: eRC1155Token.address,
//     };

//     const types = {
//       MetaTransaction: [
//         { name: "nonce", type: "uint256" },
//         { name: "from", type: "address" },
//         { name: "functionSignature", type: "bytes" },
//       ],
//     };

//     const functionData = eRC1155Token.interface.encodeFunctionData("safeTransferFrom", [
//       accounts[0].address,
//       accounts[1].address,
//       0,
//       1,
//       [],
//     ]);
//     const value = {
//       nonce: 0,
//       from: accounts[0].address,
//       functionSignature: eRC1155Token.interface.encodeFunctionData("safeTransferFrom", [
//         accounts[0].address,
//         accounts[1].address,
//         0,
//         1,
//         [],
//       ]),
//     };

//     const signature = await (await ethers.getSigner(accounts[0].address))._signTypedData(domain, types, value);
//     const r = signature.slice(0, 66);
//     const s = "0x".concat(signature.slice(66, 130));
//     let v: any = "0x".concat(signature.slice(130, 132));
//     v = ethers.BigNumber.from(v).toNumber();
//     const transferTx = await eRC1155Token.executeMetaTransaction(accounts[0].address, functionData, r, s, v);
//     const transferReceipt = await transferTx.wait();

//     const transferEvent = transferReceipt?.events?.find((log: { event: string }) => log.event === "TransferSingle");
//     expect(transferEvent?.args?.from).to.equal(accounts[0].address);
//     expect(transferEvent?.args?.to).to.equal(accounts[1].address);
//     expect(transferEvent?.args?.value).to.equal(1);
//   });

//   it("burn tokens success", async () => {
//     const burnTx = await predicateERC1155Token.burn(accounts[1].address, 0, 1);
//     const burnReceipt = await burnTx.wait();

//     const transferEvent = burnReceipt?.events?.find((log: any) => log.event === "TransferSingle");
//     expect(transferEvent?.args?.from).to.equal(accounts[1].address);
//     expect(transferEvent?.args?.to).to.equal(ethers.constants.AddressZero);
//     expect(transferEvent?.args?.value).to.equal(1);
//   });

//   // TODO - fix
//   // it("batch mint tokens success", async () => {
//   //   const mintTx = await predicateERC1155Token.mintBatch(
//   //     [accounts[0].address, accounts[0].address, accounts[1].address],
//   //     [0, 1, 2],
//   //     [1, 2, 3]
//   //   );
//   //   await expect(mintTx)
//   //     .to.emit(predicateERC1155Token, "TransferSingle")
//   //     .withArgs("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", ethers.constants.AddressZero, accounts[0].address, 0, 1);
//   //   await expect(mintTx)
//   //     .to.emit(predicateERC1155Token, "TransferSingle")
//   //     .withArgs("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", ethers.constants.AddressZero, accounts[0].address, 1, 2);
//   //   await expect(mintTx)
//   //     .to.emit(predicateERC1155Token, "TransferSingle")
//   //     .withArgs("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", ethers.constants.AddressZero, accounts[1].address, 2, 3);
//   // });
//   // it("batch burn tokens success", async () => {
//   //   const burnTx = await predicateERC1155Token.burnBatch(accounts[0].address, [0, 1], [1, 2]);
//   //   await expect(burnTx)
//   //     .to.emit(predicateERC1155Token, "TransferBatch")
//   //     .withArgs(
//   //       "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
//   //       accounts[0].address,
//   //       ethers.constants.AddressZero,
//   //       [0, 1],
//   //       [1, 2]
//   //     );
//   // });
// });
