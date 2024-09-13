import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-switch-network";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

module.exports = {
  networks: {
    hardhat: {},
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
