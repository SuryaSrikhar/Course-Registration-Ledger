const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REQUESTS_FILE = path.resolve(__dirname, "enrollment-requests.json");

function ensureFile() {
  if (!fs.existsSync(REQUESTS_FILE)) {
    fs.writeFileSync(REQUESTS_FILE, "[]\n", "utf8");
  }
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(REQUESTS_FILE, "utf8").trim() || "[]";
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(items) {
  fs.writeFileSync(REQUESTS_FILE, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function listEnrollmentRequests() {
  const items = readAll();
  items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return items;
}

function createOrRefreshPendingRequest(payload) {
  const studentUid = String(payload.studentUid || "").trim();
  const courseId = String(payload.courseId || "").trim();

  if (!studentUid || !courseId) {
    throw new Error("studentUid and courseId are required");
  }

  const items = readAll();
  const currentPending = items.find(
    (item) => item.studentUid === studentUid && item.courseId === courseId && item.status === "pending"
  );

  if (currentPending) {
    return currentPending;
  }

  const request = {
    id: crypto.randomUUID(),
    studentUid,
    studentEmail: String(payload.studentEmail || ""),
    studentName: String(payload.studentName || ""),
    courseId,
    status: "pending",
    createdAt: Date.now(),
    decidedAt: null,
    decidedBy: ""
  };

  items.push(request);
  writeAll(items);
  return request;
}

function updateEnrollmentRequestDecision(payload) {
  const requestId = String(payload.requestId || "").trim();
  const approved = Boolean(payload.approved);
  const decidedBy = String(payload.decidedBy || "").trim();

  if (!requestId) {
    throw new Error("requestId is required");
  }

  const items = readAll();
  const request = items.find((item) => item.id === requestId);

  if (!request) {
    throw new Error("Enrollment request not found");
  }

  request.status = approved ? "approved" : "rejected";
  request.decidedAt = Date.now();
  request.decidedBy = decidedBy;

  writeAll(items);
  return request;
}

function findRequestById(requestId) {
  const items = readAll();
  return items.find((item) => item.id === String(requestId || "").trim()) || null;
}

module.exports = {
  createOrRefreshPendingRequest,
  findRequestById,
  listEnrollmentRequests,
  updateEnrollmentRequestDecision
};
