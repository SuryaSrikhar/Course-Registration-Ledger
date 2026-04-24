const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.resolve(__dirname, "student-users.json");
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const sessions = new Map();

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]\n", "utf8");
  }
}

function readStudents() {
  ensureUsersFile();
  const raw = fs.readFileSync(USERS_FILE, "utf8").trim() || "[]";
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function saveStudents(students) {
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(students, null, 2)}\n`, "utf8");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sanitizeStudent(student) {
  return {
    role: "student",
    email: student.email,
    fullName: student.fullName,
    studentUid: student.studentUid
  };
}

function registerStudentUser(payload) {
  const fullName = String(payload.fullName || "").trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const studentUid = String(payload.studentUid || "").trim();

  if (!fullName) {
    throw new Error("fullName is required");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }
  if (password.length < 4) {
    throw new Error("Password must be at least 4 characters");
  }
  if (!studentUid) {
    throw new Error("studentUid is required");
  }

  const students = readStudents();

  if (students.some((item) => item.email === email)) {
    throw new Error("Email is already registered");
  }

  if (students.some((item) => item.studentUid.toLowerCase() === studentUid.toLowerCase())) {
    throw new Error("studentUid is already registered");
  }

  const student = {
    id: crypto.randomUUID(),
    email,
    fullName,
    studentUid,
    passwordHash: sha256(password)
  };

  students.push(student);
  saveStudents(students);

  return sanitizeStudent(student);
}

function authenticate(payload) {
  const role = String(payload.role || "").trim().toLowerCase();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");

  if (role === "admin") {
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      throw new Error("Invalid admin credentials");
    }

    return {
      role: "admin",
      email: ADMIN_EMAIL,
      fullName: "System Admin"
    };
  }

  if (role !== "student") {
    throw new Error("role must be admin or student");
  }

  const students = readStudents();
  const student = students.find((item) => item.email === email);

  if (!student || student.passwordHash !== sha256(password)) {
    throw new Error("Invalid student credentials");
  }

  return sanitizeStudent(student);
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    token,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSession(token) {
  const session = sessions.get(String(token || ""));
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function removeSession(token) {
  sessions.delete(String(token || ""));
}

function listStudents() {
  return readStudents().map((item) => sanitizeStudent(item));
}

module.exports = {
  ADMIN_EMAIL,
  createSession,
  authenticate,
  getSession,
  listStudents,
  registerStudentUser,
  removeSession
};
