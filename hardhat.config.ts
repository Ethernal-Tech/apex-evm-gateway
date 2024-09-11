import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

module.exports = {
  networks: {
    hardhat: {},
    // coston2: {
    //   url: process.env.COSTON2_URL,
    //   accounts: [process.env.PRIVATE_KEY],
    //   gasPrice: 35000000000,
    // },
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

export default config;
