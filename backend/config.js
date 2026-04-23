const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const CONTRACT_ADDRESS_FILE = path.resolve(__dirname, "contract-address.txt");
const CONTRACT_ABI_FILE = path.resolve(__dirname, "contract-abi.json");

function loadContractAddress() {
  const fromEnv = (process.env.CONTRACT_ADDRESS || "").trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (!fs.existsSync(CONTRACT_ADDRESS_FILE)) {
    return "";
  }

  return fs.readFileSync(CONTRACT_ADDRESS_FILE, "utf8").trim();
}

function loadContractAbi() {
  if (!fs.existsSync(CONTRACT_ABI_FILE)) {
    return [];
  }

  const rawAbi = fs.readFileSync(CONTRACT_ABI_FILE, "utf8").trim();
  if (!rawAbi) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawAbi);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error(`Invalid contract ABI JSON in ${CONTRACT_ABI_FILE}: ${error.message}`);
  }
}

const contractAddress = loadContractAddress();
const contractAbi = loadContractAbi();

module.exports = {
  RPC_URL: process.env.RPC_URL || "http://127.0.0.1:7545",
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",

  CONTRACT_ADDRESS_FILE,
  CONTRACT_ABI_FILE,

  CONTRACT_ADDRESS: contractAddress,
  CONTRACT_ABI: contractAbi,

  // Optional comma-separated list if your contract does not emit CourseCreated events.
  COURSE_IDS: (process.env.COURSE_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),

  // Required for write APIs (/create-course, /enroll, /drop)
  SERVER_PRIVATE_KEY: (process.env.SERVER_PRIVATE_KEY || "").trim()
};
