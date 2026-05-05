import { expect } from "chai";
import { ethers } from "hardhat";

describe("BLSVerifier", function () {
    let blsVerifierTest: any;

    const domain = ethers.keccak256(ethers.toUtf8Bytes("sevap is in the house!"));
    const message = ethers.keccak256(ethers.toUtf8Bytes("test message to sign"));

    const validatorsData = [
        { key: [BigInt("0x2e6ae79fad74905b4391c4258eee0ed911a83ea8b2ee4b830fe8cbcdd50645fe"), BigInt("0x2036180907f4381ffafc6def06892e3265c0fc9d8f5cb8eaf5a43386a2c22943"), BigInt("0x2045e6ab998872fd13c0d9a62761ef9b99452e1d54dc0958c9c7d19afec6efb0"), BigInt("0x29e8001b664baeaf0cc9fb1e9332806fed04794c5c6aaf9937051d40725aeeb5")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x12e36a5325e37611faeb493d583dab3bf396a75910272d44667f85360501b54d"), BigInt("0x1072541de938896039f580f1a7fcb7eb0542962fcca5691cd4933de5502d2746"), BigInt("0x20fbb3b94c9ce874bf868e6958ad049bc60c7474ab49f7f06cf76c03b5e66e09"), BigInt("0x2f2a1a81bf575571a67ae3aef8bef9f2cafdbcdc03cdaa35566d81686d709295")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x034f1740a05124d40601b32f5c5d8a4ebf13084759b514fdabd00975bc7829"), BigInt("0x0fb5d60dcf57bbe081d299bfb4a9333b34ed35865b023d8215225ee209a96abd"), BigInt("0x0dcacddb4fd5596f176d69750f44f492b4f9aff2db8633f9103d9f1e82d592e4"), BigInt("0x0fb7f0c7b9952ad0e592aaa213d64db14c37b99955a0e5d371d1c7e0e6f90a1f")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x1e8d7c0ee7cec5926cccd510617eb6a50fd79c13c13af57a6d0485b742324e27"), BigInt("0x2f0a39919151f631cee455eac1b3a283d1d6bf6bcdd99ea5fd419756453ccaac"), BigInt("0x2fb7adfe026817a37824c8fc20ea340d3684c65f46959c0b6b05763205a1a824"), BigInt("0x2de60840f015614da428271b59253ca01914d3d781fba63fe72653f957486f4d")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x20e9d87a73aa16e4c7e7c9d58b674c82ee4429e7beb988c2215b74096fe85eee"), BigInt("0x2eddfde00786cd5f9ab2b5f8619647023a3a51d3ec3b0353d7d264a81611f0fb"), BigInt("0x07421831c7ac3fc0a651606773d333272884470b5c15aaca2aede77b0cace47a"), BigInt("0x2f3f9327b550afbd7ffc390179243ce3bea5dfe7470343560f044149d4472195")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x1578e2aa0784ce1f85a09d35bf0490a536f3927780496c64dde587b201a1fcdf"), BigInt("0x0423a4c65648601eadc4683f2b7d3c5fcbb2604772fedf287e7947afefb16914"), BigInt("0x12dd55569834b77d7195f93c547a7773d7de9e536c51a97af411505f4d36eaa1"), BigInt("0x19985c04557712a5f172ca1adcc7db9df6bfc9f0773e38c7dc0703aa6dee1494")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x272af49e314e6601b13821ad10327b6ece46a6c8db7db651f4eab9052c578e03"), BigInt("0x091b5de58ee3f879627381afd5cd5c246447f626d18eac9c247329ec2935ce76"), BigInt("0x01892d4b4444c73eef981f0cd94197c1e341128a91f75f4cd9b57f7640a268ca"), BigInt("0x27e0140a685dd13b348c5b4e2c9e53fd765200106a36af88aea5ce3ed740c23a")] as [bigint, bigint, bigint, bigint] },
        { key: [BigInt("0x02fa364cf8cf212c3bfd44161105cd2ce92bebdc067e70090fcfc38619edf4a8"), BigInt("0x03be4fc2a8c1bdcc314b0e3723dddf65df157cabaeb12051ac75f5b131de63ce"), BigInt("0x19f26299d70f6e29d2777f8e112d572d821fd1293f2795e965465dab466a4dc2"), BigInt("0x1a076f506c9b4b5625cf9ad7aabdfd6ca018d6fb984413b4c1380687e8d09a43")] as [bigint, bigint, bigint, bigint] },
    ];

    before(async () => {
        const BLSVerifierTest = await ethers.getContractFactory("BLSVerifierTest");
        blsVerifierTest = await BLSVerifierTest.deploy();
    });

    it("verifyBLSSignature returns true for correct mutlisig 1", async () => {
        const signature = "0x1fba998b0456bf41900cb13872b440f2aeac7bf6ec7ea7136da8ac9b45ba04e108763c156ce3e29c6f47c6511414f961c401029db5fc3b642e5d5c890e5fd890";
        const bitmap = BigInt(125);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(true);
    });

    it("verifyBLSSignature returns true for correct mutlisig 2", async () => {
        const signature = "0x245fa387c4e5c42713b7a413255ff92f3a83fd3123bdcf3b6d9e3320a9e83a232fe8877ebb6be6dbabf188ec04b4bbda9d6b109fcda70da99ea6934f1b090aee";
        const bitmap = BigInt(247);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(true);
    });

    it("verifyBLSSignature returns true for correct mutlisig 3", async () => {
        const signature = "0x2ccd599d96c60d63a486a37cdb86cc5a2fc534fcfc3c3e3d20ef004ed62b86cc21b710dc54c6ce3e1d8615b47ac091c73a028c22967eaaf7207f9c9306a670af";
        const bitmap = BigInt(255);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(true);
    });

    it("verifyBLSSignature returns true for correct mutlisig 4", async () => {
        const signature = "0x0f1e2ef0a189c4f8be90c03a16e0c7d47ee58924e8a259a7b78e20d8a4829dd81b0d64bbd69841caa9a67a13e035346d7d0f13ed174a4c3d8ba2fc28fd653d15";
        const bitmap = BigInt(238);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(true);
    });

    it("verifyBLSSignature returns false for wrong 1", async () => {
        const signature = "0x0d7ca3d5ababf03f7f39d3de8594723ea7b2c2e49a964dec4c66420a1e86c7cc1ebc3f0285a62686f0d62aef072349985825e7cf90fc1a6e2cdfffddeefb2f02";
        const bitmap = BigInt(235);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(false);
    });

    it("verifyBLSSignature returns false for wrong 2", async () => {
        const signature = "0x0f1e2ef0a189c4f8be90c03a16e0c7d47ee58924e8a259a7b78e20d8a4829dd81b0d64bbd69841caa9a67a13e035346d7d0f13ed174a4c3d8ba2fc28fd653d15";
        const bitmap = BigInt(2);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(false);
    });

    it("verifyBLSSignature returns true for correct wrong 2", async () => {
        const signature = "0x1dcbd106fe5f2d393d1abb12a614daee9c4e3eebab1c026a4295e0c9547d95b61e48592e5c9bb3f27a26055bebf4eeb278adc628fbf08ba3245d3c8552c7a0c6";
        const bitmap = BigInt(234);

        const result = await blsVerifierTest.verifyBLSSignature(
            message,
            signature,
            bitmap,
            validatorsData,
            domain
        );
        expect(result).to.equal(false);
    });
});
