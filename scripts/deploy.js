const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const ledger = await hre.ethers.deployContract("CourseRegistrationLedger");
  await ledger.waitForDeployment();

  const deployedAddress = await ledger.getAddress();
  const outputPath = path.join(__dirname, "..", "deployed-address.txt");
  fs.writeFileSync(outputPath, `${deployedAddress}\n`, "utf8");

  console.log("CourseRegistrationLedger deployed to:", deployedAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
