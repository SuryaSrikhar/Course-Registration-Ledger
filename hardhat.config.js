require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:7545";
const deployerPrivateKey = (
  process.env.DEPLOYER_PRIVATE_KEY || process.env.SERVER_PRIVATE_KEY || ""
).trim();

const ganacheNetwork = {
  url: rpcUrl
};

if (deployerPrivateKey) {
  ganacheNetwork.accounts = [deployerPrivateKey];
}

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    ganache: ganacheNetwork
  }
};
