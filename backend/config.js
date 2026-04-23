const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const MANUAL_CONTRACT_ADDRESS = "0xc12304E16DfA667421A1398F1c5f560116039160";

module.exports = {
  RPC_URL: process.env.RPC_URL || "http://127.0.0.1:8545",
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",

  // Paste your Remix deployed address here OR provide CONTRACT_ADDRESS in .env
  CONTRACT_ADDRESS: (process.env.CONTRACT_ADDRESS || MANUAL_CONTRACT_ADDRESS).trim(),

  // Paste your full ABI into backend/contract-abi.json
  CONTRACT_ABI: require("./contract-abi.json"),

  // Optional comma-separated list if your contract does not emit CourseCreated events.
  COURSE_IDS: (process.env.COURSE_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),

  // Required for write APIs (/create-course, /enroll, /drop)
  SERVER_PRIVATE_KEY: (process.env.SERVER_PRIVATE_KEY || "").trim()
};
