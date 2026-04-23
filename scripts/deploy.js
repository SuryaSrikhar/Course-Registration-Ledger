const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const CONTRACT_NAME = "CourseRegistrationLedger";

function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

async function main() {
  const signers = await hre.ethers.getSigners();
  let deployer = signers[0];

  if (!deployer) {
    try {
      deployer = await hre.ethers.provider.getSigner(0);
      await deployer.getAddress();
    } catch {
      throw new Error(
        "No deployer account available. Set DEPLOYER_PRIVATE_KEY or SERVER_PRIVATE_KEY in .env, or start Ganache with unlocked accounts"
      );
    }
  }

  const deployerAddress = await deployer.getAddress();
  console.log("Deploying with account:", deployerAddress);

  const ContractFactory = await hre.ethers.getContractFactory(CONTRACT_NAME, deployer);
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const artifact = await hre.artifacts.readArtifact(CONTRACT_NAME);

  const backendDir = path.resolve(__dirname, "..", "backend");
  const addressFilePath = path.join(backendDir, "contract-address.txt");
  const abiFilePath = path.join(backendDir, "contract-abi.json");

  writeFileSafe(addressFilePath, `${contractAddress}\n`);
  writeFileSafe(abiFilePath, `${JSON.stringify(artifact.abi, null, 2)}\n`);

  console.log(`${CONTRACT_NAME} deployed to: ${contractAddress}`);
  console.log(`Saved address: ${addressFilePath}`);
  console.log(`Saved ABI: ${abiFilePath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
