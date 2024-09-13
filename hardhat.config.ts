import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-switch-network";
// import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

module.exports = {
  networks: {
    hardhat: {},
    blade: {
      url: process.env.BLADE,
      accounts: [process.env.BLADE_PRIVATE_KEY],
      gasPrice: 35000000000,
    },
    nexus: {
      url: process.env.NEXUS_URL,
      accounts: [process.env.NEXUS_PRIVATE_KEY],
      gasPrice: 35000000000,
    },
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
