const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { PORT, CORS_ORIGIN, CONTRACT_ABI } = require("./config");
const {
  createSession,
  authenticate,
  getSession,
  getStudentByUid,
  listStudents,
  registerStudentUser,
  removeSession
} = require("./auth-store");
const {
  createOrRefreshPendingRequest,
  findRequestById,
  listEnrollmentRequests,
  updateEnrollmentRequestDecision
} = require("./enrollment-requests");
const {
  CONTRACT_ADDRESS,
  createProvider,
  createReadContract,
  createWriteContext,
  fetchStudent,
  fetchCourses,
  getLinkedStudentKeyByWallet,
  listStudentEnrollments,
  isStudentApprovedForCourse,
  parseContractError,
  sendApproveStudent,
  sendCreateCourse,
  sendEnroll,
  sendRegisterStudent,
  sendUpdateCourseCapacity,
  validateEnrollRequest,
  sendDrop
} = require("./blockchain");

const MAX_STUDENT_ENROLLMENTS = 6;

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

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.auth = {
    token,
    user: session.user
  };

  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.auth?.user?.role !== role) {
      return res.status(403).json({ error: `Forbidden: ${role} access required` });
    }

    return next();
  };
}

async function syncStudentWallet(writeContract, user, walletAddress) {
  const studentUid = String(user.studentUid || "").trim();
  if (!studentUid) {
    throw new Error("studentUid is not configured for this account");
  }

  if (!ethers.isAddress(walletAddress)) {
    throw new Error("walletAddress must be a valid address");
  }

  const linkedKey = await getLinkedStudentKeyByWallet(writeContract, walletAddress);
  const persistedStudent = getStudentByUid(studentUid);
  const fallbackChainWallet = persistedStudent?.chainWallet;

  let registrationWallet = walletAddress;
  if (linkedKey !== ethers.ZeroHash) {
    if (!fallbackChainWallet || !ethers.isAddress(fallbackChainWallet)) {
      throw new Error("No fallback wallet available for this student account");
    }

    registrationWallet = fallbackChainWallet;
  }

  const student = await fetchStudent(writeContract, studentUid);

  if (!student.exists) {
    const tx = await sendRegisterStudent(writeContract, {
      studentUid,
      walletAddress: registrationWallet,
      eligible: true
    });
    await tx.wait();
    return {
      synced: true,
      studentUid,
      walletAddress,
      chainWallet: registrationWallet,
      createdOnChain: true,
      eligible: true,
      usedFallbackWallet: registrationWallet.toLowerCase() !== walletAddress.toLowerCase()
    };
  }

  if (String(student.wallet).toLowerCase() !== String(registrationWallet).toLowerCase()) {
    throw new Error("This student UID is already linked to another wallet. Contact admin.");
  }

  return {
    synced: true,
    studentUid,
    walletAddress,
    chainWallet: registrationWallet,
    createdOnChain: false,
    usedFallbackWallet: registrationWallet.toLowerCase() !== walletAddress.toLowerCase(),
    eligible: Boolean(student.eligible)
  };
}

app.post("/auth/register", (req, res) => {
  try {
    const user = registerStudentUser(req.body || {});
    res.status(201).json({ message: "Student account created", user });
  } catch (error) {
    res.status(400).json({ error: error.message || "Registration failed" });
  }
});

app.post("/auth/login", (req, res) => {
  try {
    const user = authenticate(req.body || {});
    const token = createSession(user);
    res.status(200).json({ token, user });
  } catch (error) {
    res.status(401).json({ error: error.message || "Login failed" });
  }
});

app.post("/auth/logout", requireAuth, (req, res) => {
  removeSession(req.auth.token);
  res.status(200).json({ message: "Logged out" });
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.auth.user });
});

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

app.get("/admin/students", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const baseStudents = listStudents();
    const students = await Promise.all(
      baseStudents.map(async (student) => {
        try {
          const enrolledCourses = await listStudentEnrollments(readContract, student.studentUid);
          return {
            ...student,
            enrolledCourses
          };
        } catch {
          return {
            ...student,
            enrolledCourses: []
          };
        }
      })
    );

    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

app.post("/admin/create-course", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const tx = await sendCreateCourse(writeContract, {
      ...(req.body || {}),
      approvalRequired: true
    });
    const receipt = await tx.wait();

    res.status(201).json({
      message: "Course created successfully",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/admin/update-course-capacity", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const tx = await sendUpdateCourseCapacity(writeContract, req.body || {});
    const receipt = await tx.wait();

    res.status(200).json({
      message: "Course capacity updated",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.get("/admin/enrollment-requests", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({ requests: listEnrollmentRequests() });
});

app.post("/admin/enrollment-requests/:requestId/decision", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const request = findRequestById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Enrollment request not found" });
    }

    const approved = Boolean(req.body?.approved);
    const writeContract = getWriteContract();
    let approvalTxHash = "";
    let enrollmentTxHash = "";

    if (approved) {
      const approvalTx = await sendApproveStudent(writeContract, {
        courseId: request.courseId,
        studentUid: request.studentUid,
        approved: true
      });
      const approvalReceipt = await approvalTx.wait();
      approvalTxHash = approvalReceipt.hash;

      await validateEnrollRequest(readContract, {
        courseId: request.courseId,
        studentUid: request.studentUid
      });

      const enrollTx = await sendEnroll(writeContract, {
        courseId: request.courseId,
        studentUid: request.studentUid
      });
      const enrollReceipt = await enrollTx.wait();
      enrollmentTxHash = enrollReceipt.hash;
    }

    const updatedRequest = updateEnrollmentRequestDecision({
      requestId: request.id,
      approved,
      decidedBy: req.auth.user.email
    });

    return res.status(200).json({
      message: approved ? "Student approved and enrolled" : "Enrollment request rejected",
      request: updatedRequest,
      approvalTxHash,
      enrollmentTxHash
    });
  } catch (error) {
    return res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/admin/drop-student", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const courseId = String(req.body?.courseId || "").trim();
    const studentUid = String(req.body?.studentUid || "").trim();

    if (!courseId || !studentUid) {
      throw new Error("courseId and studentUid are required");
    }

    const writeContract = getWriteContract();
    const tx = await sendDrop(writeContract, { courseId, studentUid });
    const receipt = await tx.wait();

    res.status(200).json({
      message: "Student dropped from course",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/student/sync-wallet", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const walletAddress = String(req.body?.walletAddress || "").trim();
    const result = await syncStudentWallet(writeContract, req.auth.user, walletAddress);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/student/enroll", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const courseId = String(req.body?.courseId || "").trim();
    const studentUid = String(req.auth.user?.studentUid || "").trim();

    if (!courseId) {
      throw new Error("courseId is required");
    }
    if (!studentUid) {
      throw new Error("studentUid is not available in current session");
    }

    const activeCourses = await listStudentEnrollments(readContract, studentUid);
    if (activeCourses.length >= MAX_STUDENT_ENROLLMENTS && !activeCourses.includes(courseId)) {
      throw new Error(
        `Student can enroll in up to ${MAX_STUDENT_ENROLLMENTS} courses only. Already enrolled in: ${activeCourses.join(", ")}`
      );
    }

    await validateEnrollRequest(readContract, { courseId, studentUid });

    const approvedForCourse = await isStudentApprovedForCourse(readContract, courseId, studentUid);
    if (!approvedForCourse) {
      const request = createOrRefreshPendingRequest({
        courseId,
        studentUid,
        studentEmail: req.auth.user.email,
        studentName: req.auth.user.fullName
      });

      return res.status(202).json({
        message: "Enrollment request submitted. Wait for admin approval.",
        request,
        requiresApproval: true
      });
    }

    const tx = await sendEnroll(writeContract, { courseId, studentUid });
    const receipt = await tx.wait();

    res.status(200).json({
      message: "Enrollment successful",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
  }
});

app.post("/student/drop", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const writeContract = getWriteContract();
    const courseId = String(req.body?.courseId || "").trim();
    const studentUid = String(req.auth.user?.studentUid || "").trim();

    if (!courseId) {
      throw new Error("courseId is required");
    }
    if (!studentUid) {
      throw new Error("studentUid is not available in current session");
    }

    const tx = await sendDrop(writeContract, { courseId, studentUid });
    const receipt = await tx.wait();

    res.status(200).json({
      message: "Course dropped successfully",
      txHash: receipt.hash
    });
  } catch (error) {
    res.status(400).json({ error: parseContractError(error) });
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
