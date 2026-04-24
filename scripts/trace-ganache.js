const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const rootDir = path.resolve(__dirname, "..");
const abiPath = path.join(rootDir, "backend", "contract-abi.json");
const addressPath = path.join(rootDir, "backend", "contract-address.txt");

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:7545";
const depthArg = Number(process.argv[2] || 20);
const depth = Number.isInteger(depthArg) && depthArg > 0 ? depthArg : 20;

function short(value, size = 12) {
  const text = String(value || "");
  if (text.length <= size) {
    return text;
  }
  return `${text.slice(0, size)}...`;
}

function loadContractConfig() {
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const address = fs.readFileSync(addressPath, "utf8").trim();

  if (!Array.isArray(abi) || abi.length === 0) {
    throw new Error("Invalid contract ABI at backend/contract-abi.json");
  }
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid contract address at backend/contract-address.txt");
  }

  return { abi, address: address.toLowerCase() };
}

function formatArg(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatArg(item)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    return "{...}";
  }
  return String(value);
}

async function main() {
  const { abi, address } = loadContractConfig();
  const iface = new ethers.Interface(abi);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const latest = await provider.getBlockNumber();
  const start = Math.max(0, latest - depth + 1);

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Contract: ${address}`);
  console.log(`Scanning blocks: ${start} -> ${latest}`);
  console.log("");

  for (let blockNumber = latest; blockNumber >= start; blockNumber -= 1) {
    const block = await provider.getBlock(blockNumber, true);
    if (!block || !block.transactions || block.transactions.length === 0) {
      continue;
    }

    for (const item of block.transactions) {
      const tx = typeof item === "string" ? await provider.getTransaction(item) : item;
      if (!tx) {
        continue;
      }

      const to = String(tx.to || "").toLowerCase();
      const isContractTx = to === address;

      let action = "external";
      let decodedArgs = [];

      if (isContractTx && tx.data && tx.data !== "0x") {
        try {
          const parsedTx = iface.parseTransaction({ data: tx.data, value: tx.value });
          if (parsedTx) {
            action = parsedTx.name;
            decodedArgs = parsedTx.args ? Array.from(parsedTx.args).map((item) => formatArg(item)) : [];
          }
        } catch {
          action = `unknown_selector(${tx.data.slice(0, 10)})`;
        }
      }

      const receipt = await provider.getTransactionReceipt(tx.hash);
      const status = receipt?.status === 1 ? "OK" : "FAIL";
      const gasUsed = receipt?.gasUsed ? receipt.gasUsed.toString() : "-";

      const eventNames = [];
      for (const log of receipt?.logs || []) {
        if (String(log.address || "").toLowerCase() !== address) {
          continue;
        }
        try {
          const parsedLog = iface.parseLog(log);
          if (parsedLog?.name) {
            eventNames.push(parsedLog.name);
          }
        } catch {
          // Ignore unknown logs.
        }
      }

      console.log(`Block ${blockNumber} | ${status} | ${short(tx.hash, 18)}`);
      console.log(`  From: ${short(tx.from, 18)}  To: ${short(tx.to || "contract-creation", 18)}`);
      console.log(`  Action: ${action}`);
      if (decodedArgs.length > 0) {
        console.log(`  Args: ${decodedArgs.join(" | ")}`);
      }
      console.log(`  GasUsed: ${gasUsed}`);
      console.log(`  Events: ${eventNames.length > 0 ? eventNames.join(", ") : "-"}`);
      console.log("");
    }
  }
}

main().catch((error) => {
  console.error("Trace failed:", error.message || error);
  process.exitCode = 1;
});
