const { ethers } = require("ethers");
const {
  RPC_URL,
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  COURSE_IDS,
  SERVER_PRIVATE_KEY,
  CONTRACT_ADDRESS_FILE,
  CONTRACT_ABI_FILE
} = require("./config");

function hasFunction(contract, name, inputCount) {
  return contract.interface.fragments.some(
    (fragment) =>
      fragment.type === "function" &&
      fragment.name === name &&
      (inputCount === undefined || fragment.inputs.length === inputCount)
  );
}

function ensureContractConfig() {
  if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
    throw new Error(
      `Invalid contract address. Run \"npm run deploy\" to generate ${CONTRACT_ADDRESS_FILE}, or set CONTRACT_ADDRESS in .env`
    );
  }

  if (!Array.isArray(CONTRACT_ABI) || CONTRACT_ABI.length === 0) {
    throw new Error(`Contract ABI is missing. Run \"npm run deploy\" to generate ${CONTRACT_ABI_FILE}`);
  }
}

function createProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

function createReadContract(provider) {
  ensureContractConfig();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

function createWriteContext(provider) {
  if (!SERVER_PRIVATE_KEY) {
    throw new Error("SERVER_PRIVATE_KEY is missing in .env (required for write APIs)");
  }

  const signer = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return { signer, contract };
}

function parseContractError(error) {
  if (!error) {
    return "Unknown blockchain error";
  }

  const candidates = [
    error.shortMessage,
    error.reason,
    error.message,
    error?.info?.error?.message,
    error?.info?.error?.data?.message,
    error?.error?.message
  ].filter(Boolean);

  for (const message of candidates) {
    const reverted = message.match(/reverted with reason string '([^']+)'/i);
    if (reverted?.[1]) {
      return reverted[1];
    }

    const plainReason = message.match(/execution reverted:?\s*([^\n]+)/i);
    if (plainReason?.[1]) {
      return plainReason[1].replace(/['"]/g, "").trim();
    }

    if (!message.toLowerCase().includes("missing revert data")) {
      return message;
    }
  }

  return "Transaction reverted without an explicit reason";
}

function toNumber(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function extractCourseId(args) {
  const namedKeys = ["courseId", "courseUid", "id", "_courseId"];

  for (const key of namedKeys) {
    const value = args?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of args || []) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeCourseTuple(courseId, raw) {
  const values = Array.from(raw || []);
  const firstValue = values[0];

  let title = courseId;
  let capacity = 0;
  let enrolled = 0;
  let exists = true;

  if (typeof raw?.title === "string" && raw.title.trim()) {
    title = raw.title;
  }

  if (typeof raw?.capacity !== "undefined") {
    capacity = toNumber(raw.capacity);
  }

  if (typeof raw?.enrolled !== "undefined") {
    enrolled = toNumber(raw.enrolled);
  }

  if (typeof raw?.exists === "boolean") {
    exists = raw.exists;
  }

  if (typeof firstValue === "string") {
    title = firstValue || title;
    if (typeof raw?.capacity === "undefined") {
      capacity = toNumber(values[1]);
    }
    if (typeof raw?.enrolled === "undefined") {
      enrolled = toNumber(values[2]);
    }
  } else {
    if (typeof raw?.capacity === "undefined") {
      capacity = toNumber(values[0]);
    }
    if (typeof raw?.enrolled === "undefined") {
      enrolled = toNumber(values[1]);
    }
  }

  if (typeof values[2] === "boolean") {
    exists = values[2];
  }
  if (typeof values[4] === "boolean") {
    exists = values[4];
  }

  return {
    courseId,
    title,
    capacity,
    enrolled,
    seatsRemaining: Math.max(capacity - enrolled, 0),
    exists
  };
}

async function readCourse(contract, courseId) {
  if (hasFunction(contract, "getCourse", 1)) {
    const raw = await contract.getCourse(courseId);
    return normalizeCourseTuple(courseId, raw);
  }

  if (hasFunction(contract, "getCourseSnapshot", 1)) {
    const raw = await contract.getCourseSnapshot(courseId);
    const values = Array.from(raw || []);
    const capacity = toNumber(values[0]);
    const enrolled = toNumber(values[1]);
    const seatsRemaining = values.length > 2 ? toNumber(values[2]) : Math.max(capacity - enrolled, 0);

    return {
      courseId,
      title: courseId,
      capacity,
      enrolled,
      seatsRemaining,
      exists: true
    };
  }

  throw new Error("Could not read courses. Add getCourse(string) or getCourseSnapshot(string) to contract ABI.");
}

async function discoverCourseIds(contract) {
  const ids = new Set(COURSE_IDS || []);

  if (contract.filters?.CourseCreated) {
    const events = await contract.queryFilter(contract.filters.CourseCreated(), 0, "latest");
    for (const event of events) {
      const id = extractCourseId(event.args || []);
      if (id) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

async function fetchCourses(contract) {
  const discoveredIds = await discoverCourseIds(contract);
  const courses = [];

  for (const courseId of discoveredIds) {
    try {
      const course = await readCourse(contract, courseId);
      if (course.exists === false) {
        continue;
      }

      courses.push({
        courseId: course.courseId,
        title: course.title,
        capacity: course.capacity,
        enrolled: course.enrolled,
        seatsRemaining: course.seatsRemaining
      });
    } catch {
      // Ignore broken course IDs and continue processing.
    }
  }

  courses.sort((a, b) => a.courseId.localeCompare(b.courseId));
  return courses;
}

async function sendCreateCourse(contract, payload) {
  const courseId = String(payload.courseId || "").trim();
  const capacity = Number(payload.capacity);

  if (!courseId) {
    throw new Error("courseId is required");
  }
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("capacity must be a positive integer");
  }

  if (hasFunction(contract, "createCourse", 2)) {
    return contract.createCourse(courseId, capacity);
  }

  if (hasFunction(contract, "createCourse", 4)) {
    const title = String(payload.title || courseId).trim();
    return contract.createCourse(courseId, title, capacity, false);
  }

  throw new Error("createCourse function not found in ABI. Expected createCourse(string,uint256) or createCourse(string,string,uint16,bool)");
}

async function sendEnroll(contract, payload) {
  const courseId = String(payload.courseId || "").trim();
  if (!courseId) {
    throw new Error("courseId is required");
  }

  if (hasFunction(contract, "enroll", 1)) {
    return contract.enroll(courseId);
  }

  if (hasFunction(contract, "enroll", 2)) {
    const studentUid = String(payload.studentUid || "").trim();
    if (!studentUid) {
      throw new Error("studentUid is required for this contract signature");
    }
    return contract.enroll(courseId, studentUid);
  }

  throw new Error("enroll function not found in ABI");
}

async function sendDrop(contract, payload) {
  const courseId = String(payload.courseId || "").trim();
  if (!courseId) {
    throw new Error("courseId is required");
  }

  if (hasFunction(contract, "drop", 1)) {
    return contract.drop(courseId);
  }

  if (hasFunction(contract, "withdrawFromCourse", 1)) {
    return contract.withdrawFromCourse(courseId);
  }

  if (hasFunction(contract, "drop", 2)) {
    const studentUid = String(payload.studentUid || "").trim();
    if (!studentUid) {
      throw new Error("studentUid is required for this contract signature");
    }
    return contract.drop(courseId, studentUid);
  }

  if (hasFunction(contract, "withdrawFromCourse", 2)) {
    const studentUid = String(payload.studentUid || "").trim();
    if (!studentUid) {
      throw new Error("studentUid is required for this contract signature");
    }
    return contract.withdrawFromCourse(courseId, studentUid);
  }

  throw new Error("drop/withdraw function not found in ABI");
}

module.exports = {
  CONTRACT_ADDRESS,
  createProvider,
  createReadContract,
  createWriteContext,
  fetchCourses,
  parseContractError,
  sendCreateCourse,
  sendEnroll,
  sendDrop
};
