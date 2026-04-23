const express = require("express");
const cors = require("cors");
const { PORT, CORS_ORIGIN, CONTRACT_ABI } = require("./config");
const {
  CONTRACT_ADDRESS,
  createProvider,
  createReadContract,
  createWriteContext,
  fetchCourses,
  parseContractError,
  sendCreateCourse,
  sendEnroll,
  sendDrop
} = require("./blockchain");

const app = express();
const port = Number(PORT || 4000);

app.use(cors({ origin: CORS_ORIGIN || true }));
app.use(express.json());

let provider;
let readContract;
let writeContext = null;

try {
  provider = createProvider();
  readContract = createReadContract(provider);

  try {
    writeContext = createWriteContext(provider);
  } catch {
    writeContext = null;
  }
} catch (error) {
  console.error("Failed to initialize blockchain client:", error.message);
  process.exit(1);
}

function getWriteContract() {
  if (!writeContext) {
    throw new Error("SERVER_PRIVATE_KEY is not configured. Write APIs are disabled.");
  }

  return writeContext.contract;
}

app.get("/health", async (_req, res) => {
  try {
    const blockNumber = await provider.getBlockNumber();
    res.json({
      ok: true,
      blockNumber,
      contractAddress: CONTRACT_ADDRESS,
      contractAbiLoaded: Array.isArray(CONTRACT_ABI) && CONTRACT_ABI.length > 0,
      writeEnabled: Boolean(writeContext),
      signer: writeContext?.signer?.address || null
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: parseContractError(error) });
  }
});

app.get("/contract-config", (_req, res) => {
  res.json({
    contractAddress: CONTRACT_ADDRESS,
    contractAbi: CONTRACT_ABI
  });
});

app.get("/courses", async (_req, res) => {
  try {
    const courses = await fetchCourses(readContract);

    const totalCapacity = courses.reduce((sum, item) => sum + item.capacity, 0);
    const totalEnrolled = courses.reduce((sum, item) => sum + item.enrolled, 0);

    res.json({
      courses,
      summary: {
        totalCourses: courses.length,
        totalCapacity,
        totalEnrolled,
        seatsRemaining: Math.max(totalCapacity - totalEnrolled, 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

app.post("/create-course", async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const tx = await sendCreateCourse(writeContract, req.body || {});
    const receipt = await tx.wait();

    res.status(201).json({
      message: "Course created successfully",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/enroll", async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const tx = await sendEnroll(writeContract, req.body || {});
    const receipt = await tx.wait();

    res.status(200).json({
      message: "Enrollment successful",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/drop", async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const tx = await sendDrop(writeContract, req.body || {});
    const receipt = await tx.wait();

    res.status(200).json({
      message: "Course dropped successfully",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Write APIs enabled: ${Boolean(writeContext)}`);
  if (writeContext) {
    console.log(`Server signer: ${writeContext.signer.address}`);
  }
});
