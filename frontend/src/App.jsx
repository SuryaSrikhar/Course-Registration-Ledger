import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { LogOut, RefreshCw, RadioTower } from "lucide-react";
import { api, setAuthToken } from "./services/api";
import { WalletPanel } from "./components/WalletPanel";
import { StatsBar } from "./components/StatsBar";
import { AdminPanel } from "./components/AdminPanel";
import { CourseCard } from "./components/CourseCard";

function nowLabel(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

const initialRegisterForm = {
  fullName: "",
  email: "",
  password: "",
  studentUid: ""
};

const initialLoginForm = {
  role: "student",
  email: "",
  password: ""
};

const initialCapacityForm = {
  courseId: "",
  capacity: ""
};

const initialAdminDropForm = {
  courseId: "",
  studentUid: ""
};

function readableError(error) {
  const candidates = [
    error?.shortMessage,
    error?.reason,
    error?.message,
    error?.info?.error?.message,
    error?.error?.message
  ].filter(Boolean);

  for (const message of candidates) {
    const reason = message.match(/execution reverted:?\s*([^\n]+)/i);
    if (reason?.[1]) {
      return reason[1].replace(/["']/g, "").trim();
    }
    if (!message.toLowerCase().includes("missing revert data")) {
      return message;
    }
  }

  return "Request failed";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [blockNumber, setBlockNumber] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletSynced, setWalletSynced] = useState(false);

  const [courses, setCourses] = useState([]);
  const [summary, setSummary] = useState({});
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [isCreating, setIsCreating] = useState(false);
  const [capacityForm, setCapacityForm] = useState(initialCapacityForm);
  const [adminDropForm, setAdminDropForm] = useState(initialAdminDropForm);
  const [students, setStudents] = useState([]);
  const [enrollmentRequests, setEnrollmentRequests] = useState([]);

  const role = session?.user?.role || "";
  const isAdmin = role === "admin";
  const isStudent = role === "student";

  const stage = useMemo(() => {
    if (!session) {
      return "auth";
    }
    if (!walletAddress) {
      return "wallet";
    }
    return "dashboard";
  }, [session, walletAddress]);

  const canEnroll = Boolean(walletAddress) && isStudent && walletSynced;

  async function loadCourses(showSpinner = false, silentError = false) {
    try {
      if (showSpinner) {
        setLoadingCourses(true);
      }

      const data = await api.getCourses();
      setCourses(data.courses || []);
      setSummary(data.summary || {});
      setLastUpdated(new Date());
    } catch (error) {
      if (!silentError) {
        toast.error(error.message || "Could not fetch courses");
      }
    } finally {
      setLoadingCourses(false);
    }
  }

  async function loadStudents() {
    if (!isAdmin) {
      return;
    }

    try {
      const response = await api.getStudents();
      setStudents(response.students || []);
    } catch {
      setStudents([]);
    }
  }

  async function loadEnrollmentRequests() {
    if (!isAdmin) {
      return;
    }

    try {
      const response = await api.getEnrollmentRequests();
      setEnrollmentRequests(response.requests || []);
    } catch {
      setEnrollmentRequests([]);
    }
  }

  async function refreshWalletBlock() {
    if (!window.ethereum || !walletAddress) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const nextBlock = await provider.getBlockNumber();
      setBlockNumber(nextBlock);
    } catch {
      // Ignore transient wallet RPC issues.
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      toast.error("MetaMask not detected");
      return;
    }

    try {
      setIsConnecting(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const connectedAddress = await signer.getAddress();
      const network = await provider.getNetwork();

      setWalletAddress(connectedAddress);
      setNetworkLabel(`${network.name} (${network.chainId.toString()})`);
      setBlockNumber(await provider.getBlockNumber());

      if (isStudent) {
        const syncResult = await api.syncStudentWallet({ walletAddress: connectedAddress });
        setWalletSynced(true);

        if (syncResult?.usedFallbackWallet) {
          toast.success("Connected. This account already links another student, so this student uses an assigned on-chain wallet for testing.");
        }
      } else {
        setWalletSynced(true);
      }

      toast.success("Wallet connected");
    } catch (error) {
      setWalletAddress("");
      setWalletSynced(false);
      toast.error(error?.message || "Wallet connection failed");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      setIsAuthenticating(true);
      const data = await api.login(loginForm);
      setAuthToken(data.token);
      setSession(data);
      setWalletAddress("");
      setWalletSynced(false);
      toast.success(`Logged in as ${data.user.role}`);
    } catch (error) {
      toast.error(error.message || "Login failed");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    try {
      setIsAuthenticating(true);
      await api.registerStudent(registerForm);
      setIsRegisterMode(false);
      setLoginForm((prev) => ({
        ...prev,
        role: "student",
        email: registerForm.email,
        password: ""
      }));
      setRegisterForm(initialRegisterForm);
      toast.success("Student account created. Please login.");
    } catch (error) {
      toast.error(error.message || "Registration failed");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    try {
      await api.logout().catch(() => null);
    } finally {
      setAuthToken("");
      setSession(null);
      setWalletAddress("");
      setWalletSynced(false);
      setStudents([]);
      setCourses([]);
      setSummary({});
      toast.success("Logged out");
    }
  }

  async function createCourse(form) {
    try {
      setIsCreating(true);
      const payload = {
        courseId: form.courseId,
        capacity: Number(form.capacity)
      };

      await api.createCourse(payload);
      toast.success("Course created on-chain");
      await loadCourses(true);
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setIsCreating(false);
    }
  }

  async function updateCapacity(event) {
    event.preventDefault();
    try {
      await api.updateCourseCapacity({
        courseId: capacityForm.courseId,
        capacity: Number(capacityForm.capacity)
      });
      toast.success("Course capacity updated");
      setCapacityForm(initialCapacityForm);
      await loadCourses(true);
    } catch (error) {
      toast.error(readableError(error));
    }
  }

  async function decideEnrollmentRequest(requestId, approved) {
    try {
      await api.decideEnrollmentRequest(requestId, { approved });
      toast.success(approved ? "Student approved and enrolled" : "Enrollment request rejected");
      await Promise.all([loadCourses(true), loadEnrollmentRequests()]);
    } catch (error) {
      toast.error(readableError(error));
    }
  }

  async function adminDropStudent(event) {
    event.preventDefault();
    try {
      await api.adminDropStudent(adminDropForm);
      toast.success("Student dropped from course");
      setAdminDropForm(initialAdminDropForm);
      await loadCourses(true);
    } catch (error) {
      toast.error(readableError(error));
    }
  }

  async function enroll(course) {
    const courseId = course.courseId || course.courseUid;
    const key = `${courseId}:enroll`;

    try {
      setLoadingAction(key);
      const response = await api.enroll({ courseId });
      if (response?.requiresApproval) {
        toast.success(`Enrollment request sent for ${courseId}. Waiting for admin approval.`);
      } else {
        toast.success(`Enrollment successful for ${courseId}`);
      }
      await loadCourses(true);
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setLoadingAction("");
    }
  }

  async function drop(course) {
    const courseId = course.courseId || course.courseUid;
    const key = `${courseId}:drop`;

    try {
      setLoadingAction(key);
      await api.drop({ courseId });
      toast.success(`Dropped ${courseId}`);
      await loadCourses(true);
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setLoadingAction("");
    }
  }

  useEffect(() => {
    if (stage !== "dashboard") {
      return;
    }

    loadCourses(true);
    if (isAdmin) {
      loadStudents();
      loadEnrollmentRequests();
    }

    const timer = setInterval(() => {
      loadCourses(false, true);
      refreshWalletBlock();
    }, 7000);

    return () => clearInterval(timer);
  }, [stage, isAdmin]);

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const accountsChangedHandler = (accounts) => {
      const account = accounts?.[0] || "";
      setWalletAddress(account);
      if (!account) {
        setWalletSynced(false);
        setNetworkLabel("Disconnected");
      }
    };

    const chainChangedHandler = () => {
      connectWallet();
    };

    window.ethereum.on("accountsChanged", accountsChangedHandler);
    window.ethereum.on("chainChanged", chainChangedHandler);

    return () => {
      window.ethereum.removeListener("accountsChanged", accountsChangedHandler);
      window.ethereum.removeListener("chainChanged", chainChangedHandler);
    };
  });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-brand-deep px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-0 top-28 h-80 w-80 animate-drift rounded-full bg-lime-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand-peach/25 blur-3xl" />
      </div>

      <Toaster position="top-right" toastOptions={{ duration: 2600 }} />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        {stage === "auth" ? (
          <section className="mx-auto w-full max-w-xl glass-panel">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">Course Registration Ledger</p>
            <h1 className="mt-2 font-display text-3xl text-white">Login Portal</h1>
            <p className="mt-2 text-sm text-slate-200">Choose admin or student access, then continue to wallet connection.</p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${!isRegisterMode ? "bg-cyan-300/20 text-cyan-100" : "bg-white/5 text-slate-200"}`}
                onClick={() => setIsRegisterMode(false)}
              >
                Login
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${isRegisterMode ? "bg-lime-300/20 text-lime-100" : "bg-white/5 text-slate-200"}`}
                onClick={() => {
                  setIsRegisterMode(true);
                  setLoginForm(initialLoginForm);
                }}
              >
                Student Register
              </button>
            </div>

            {!isRegisterMode ? (
              <form className="mt-4 space-y-3" onSubmit={handleLogin}>
                <select
                  className="input-shell"
                  value={loginForm.role}
                  onChange={(event) =>
                    setLoginForm({
                      role: event.target.value,
                      email: "",
                      password: ""
                    })
                  }
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>

                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="input-shell"
                  placeholder={loginForm.role === "admin" ? "admin@example.com" : "student email"}
                  required
                  type="email"
                />

                <input
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="input-shell"
                  placeholder={loginForm.role === "admin" ? "admin123" : "password"}
                  required
                  type="password"
                />

                <button className="cta-button w-full" disabled={isAuthenticating} type="submit">
                  {isAuthenticating ? "Signing in..." : "Login"}
                </button>
              </form>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={handleRegister}>
                <input
                  value={registerForm.fullName}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  className="input-shell"
                  placeholder="Full Name"
                  required
                />

                <input
                  value={registerForm.studentUid}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, studentUid: event.target.value }))}
                  className="input-shell"
                  placeholder="Student UID (PES123)"
                  required
                />

                <input
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="input-shell"
                  placeholder="student@example.com"
                  required
                  type="email"
                />

                <input
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="input-shell"
                  placeholder="password"
                  required
                  type="password"
                />

                <button className="cta-button w-full" disabled={isAuthenticating} type="submit">
                  {isAuthenticating ? "Creating account..." : "Register Student"}
                </button>
              </form>
            )}
          </section>
        ) : null}

        {stage === "wallet" ? (
          <section className="mx-auto w-full max-w-3xl space-y-4">
            <div className="glass-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">Wallet Step</p>
                  <h2 className="mt-1 font-display text-2xl text-white">Connect Wallet Before Dashboard</h2>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Back to Login
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-200">
                Logged in as {session?.user?.email} ({session?.user?.role}). Connect MetaMask to continue.
              </p>
              {isStudent ? (
                <p className="mt-2 text-xs text-slate-300">
                  Student UID: {session?.user?.studentUid}. Wallet will be linked on-chain during connect.
                </p>
              ) : null}
            </div>

            <WalletPanel
              walletAddress={walletAddress}
              networkLabel={networkLabel}
              blockNumber={blockNumber}
              onConnect={connectWallet}
              isConnecting={isConnecting}
            />
          </section>
        ) : null}

        {stage === "dashboard" ? (
          <>
            <motion.header
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="glass-panel"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">Blockchain Registration Ledger</p>
                  <h1 className="mt-2 font-display text-3xl text-white md:text-4xl">
                    {isAdmin ? "Admin Dashboard" : "Student Dashboard"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-200">
                    User: {session?.user?.email} | Wallet: {walletAddress}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    <RadioTower className="h-4 w-4" />
                    Last sync: {nowLabel(lastUpdated)}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadCourses(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-peach/40 bg-brand-peach/10 px-4 py-2 text-sm font-semibold text-brand-peach transition hover:bg-brand-peach/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </motion.header>

            <WalletPanel
              walletAddress={walletAddress}
              networkLabel={networkLabel}
              blockNumber={blockNumber}
              onConnect={connectWallet}
              isConnecting={isConnecting}
            />

            <StatsBar summary={summary} />

            {isAdmin ? (
              <>
                <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <AdminPanel onCreateCourse={createCourse} isCreating={isCreating} />

                  <section className="glass-panel h-full space-y-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-300/90">Admin Controls</p>
                    <h3 className="text-lg font-display text-white">Capacity Management</h3>

                    <form className="space-y-3" onSubmit={updateCapacity}>
                      <p className="text-sm text-slate-200">Update capacity</p>
                      <input
                        className="input-shell"
                        placeholder="Course ID"
                        value={capacityForm.courseId}
                        onChange={(event) => setCapacityForm((prev) => ({ ...prev, courseId: event.target.value }))}
                        required
                      />
                      <input
                        className="input-shell"
                        placeholder="New capacity"
                        type="number"
                        min="1"
                        value={capacityForm.capacity}
                        onChange={(event) => setCapacityForm((prev) => ({ ...prev, capacity: event.target.value }))}
                        required
                      />
                      <button className="cta-button w-full" type="submit">Update Capacity</button>
                    </form>
                  </section>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <section className="glass-panel space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-300/90">Enrollment Requests</p>
                        <h3 className="text-lg font-display text-white">Pending Student Approvals</h3>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                        onClick={loadEnrollmentRequests}
                      >
                        Reload
                      </button>
                    </div>

                    <div className="space-y-2">
                      {enrollmentRequests
                        .filter((item) => item.status === "pending")
                        .map((request) => (
                          <div key={request.id} className="metric-card">
                            <p className="metric-label">{request.courseId}</p>
                            <p className="text-sm text-white">{request.studentName || "Student"} ({request.studentUid})</p>
                            <p className="mt-1 text-xs text-slate-300">{request.studentEmail || "No email"}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-lime-200/40 bg-lime-200/10 px-3 py-1 text-xs font-semibold text-lime-100"
                                onClick={() => decideEnrollmentRequest(request.id, true)}
                              >
                                Approve and Enroll
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-brand-peach/40 bg-brand-peach/10 px-3 py-1 text-xs font-semibold text-brand-peach"
                                onClick={() => decideEnrollmentRequest(request.id, false)}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      {enrollmentRequests.filter((item) => item.status === "pending").length === 0 ? (
                        <p className="text-sm text-slate-300">No pending enrollment requests.</p>
                      ) : null}
                    </div>
                  </section>

                  <section className="glass-panel space-y-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-300/90">Admin Drop</p>
                    <h3 className="text-lg font-display text-white">Drop Student from Course</h3>
                    <form className="space-y-3" onSubmit={adminDropStudent}>
                      <input
                        className="input-shell"
                        placeholder="Course ID"
                        value={adminDropForm.courseId}
                        onChange={(event) => setAdminDropForm((prev) => ({ ...prev, courseId: event.target.value }))}
                        required
                      />
                      <input
                        className="input-shell"
                        placeholder="Student UID"
                        value={adminDropForm.studentUid}
                        onChange={(event) => setAdminDropForm((prev) => ({ ...prev, studentUid: event.target.value }))}
                        required
                      />
                      <button className="cta-button w-full" type="submit">Drop Student</button>
                    </form>
                  </section>
                </section>

                <section className="glass-panel">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-xl text-white">Registered Student Accounts</h3>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                      onClick={loadStudents}
                    >
                      Reload Students
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {students.map((student) => (
                      <div key={student.email} className="metric-card">
                        <p className="metric-label">{student.studentUid}</p>
                        <p className="metric-value text-white">{student.fullName}</p>
                        <p className="mt-1 text-xs text-slate-300">{student.email}</p>
                        <p className="mt-2 text-xs text-slate-300">
                          Enrolled: {Array.isArray(student.enrolledCourses) && student.enrolledCourses.length > 0
                            ? student.enrolledCourses.join(", ")
                            : "None"}
                        </p>
                      </div>
                    ))}
                    {students.length === 0 ? <p className="text-sm text-slate-300">No student accounts yet.</p> : null}
                  </div>
                </section>
              </>
            ) : (
              <section className="glass-panel">
                <p className="text-sm text-slate-200">
                  Student rules: every enrollment request needs admin approval first, and each student can be enrolled in up to 6 courses.
                </p>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-white">Course Catalog</h2>
                {loadingCourses ? <span className="text-sm text-slate-300">Updating from chain...</span> : null}
              </div>

              {courses.length === 0 && !loadingCourses ? (
                <div className="glass-panel text-center text-slate-200">
                  No on-chain courses found. {isAdmin ? "Create one from Admin Panel." : "Wait for admin to add courses."}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {courses.map((course) => (
                  <CourseCard
                    key={course.courseId || course.courseUid}
                    course={course}
                    onEnroll={enroll}
                    onDrop={drop}
                    loadingAction={loadingAction}
                    canEnroll={isAdmin ? false : canEnroll}
                    showActions={!isAdmin}
                  />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
