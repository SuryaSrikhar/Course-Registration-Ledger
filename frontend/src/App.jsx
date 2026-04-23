import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { RefreshCw, RadioTower } from "lucide-react";
import { api } from "./services/api";
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

export default function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [blockNumber, setBlockNumber] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletContract, setWalletContract] = useState(null);
  const [txMode, setTxMode] = useState("backend");

  const [courses, setCourses] = useState([]);
  const [summary, setSummary] = useState({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAction, setLoadingAction] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);

  const canEnroll = useMemo(() => Boolean(walletAddress), [walletAddress]);

  function hasFunction(contract, name, inputCount) {
    return contract?.interface?.fragments?.some(
      (fragment) =>
        fragment.type === "function" &&
        fragment.name === name &&
        (inputCount === undefined || fragment.inputs.length === inputCount)
    );
  }

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
        return reason[1].replace(/['"]/g, "").trim();
      }
      if (!message.toLowerCase().includes("missing revert data")) {
        return message;
      }
    }

    return "Transaction failed";
  }

  function isValidBackendContractConfig(config) {
    return (
      ethers.isAddress(config?.contractAddress || "") &&
      Array.isArray(config?.contractAbi) &&
      config.contractAbi.length > 0
    );
  }

  async function refreshWalletBlock() {
    if (!window.ethereum) {
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

      const contractConfig = await api.getContractConfig().catch(() => null);

      if (isValidBackendContractConfig(contractConfig)) {
        const contract = new ethers.Contract(
          contractConfig.contractAddress,
          contractConfig.contractAbi,
          signer
        );
        setWalletContract(contract);
        setTxMode("metamask");
      } else {
        setWalletContract(null);
        setTxMode("backend");
      }

      toast.success("Wallet connected");
    } catch (error) {
      toast.error(error?.message || "Wallet connection failed");
    } finally {
      setIsConnecting(false);
    }
  }

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

  async function createCourse(form) {
    try {
      setIsCreating(true);
      const payload = {
        courseId: form.courseId,
        capacity: Number(form.capacity)
      };

      if (walletContract) {
        let tx;
        if (hasFunction(walletContract, "createCourse", 2)) {
          tx = await walletContract.createCourse(payload.courseId, payload.capacity);
        } else if (hasFunction(walletContract, "createCourse", 4)) {
          tx = await walletContract.createCourse(payload.courseId, payload.courseId, payload.capacity, false);
        } else {
          throw new Error("createCourse function was not found in frontend contract ABI");
        }
        await tx.wait();
      } else {
        await api.createCourse(payload);
      }

      toast.success("Course created on-chain");
      await loadCourses();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setIsCreating(false);
    }
  }

  async function enroll(course) {
    if (!walletAddress) {
      toast.error("Connect MetaMask first");
      return;
    }

    const courseId = course.courseId || course.courseUid;
    const key = `${courseId}:enroll`;
    try {
      setLoadingAction(key);

      if (walletContract) {
        let tx;
        if (hasFunction(walletContract, "enroll", 1)) {
          tx = await walletContract.enroll(courseId);
        } else {
          throw new Error("enroll(string) was not found in frontend contract ABI");
        }
        await tx.wait();
      } else {
        await api.enroll({ courseId, walletAddress });
      }

      toast.success(`Enrollment successful for ${courseId}`);
      await loadCourses();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setLoadingAction("");
    }
  }

  async function drop(course) {
    if (!walletAddress) {
      toast.error("Connect MetaMask first");
      return;
    }

    const courseId = course.courseId || course.courseUid;
    const key = `${courseId}:drop`;
    try {
      setLoadingAction(key);

      if (walletContract) {
        let tx;
        if (hasFunction(walletContract, "drop", 1)) {
          tx = await walletContract.drop(courseId);
        } else if (hasFunction(walletContract, "withdrawFromCourse", 1)) {
          tx = await walletContract.withdrawFromCourse(courseId);
        } else {
          throw new Error("drop(string) was not found in frontend contract ABI");
        }
        await tx.wait();
      } else {
        await api.drop({ courseId });
      }

      toast.success(`Dropped ${courseId}`);
      await loadCourses();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setLoadingAction("");
    }
  }

  useEffect(() => {
    loadCourses(true);
    const timer = setInterval(() => {
      loadCourses(false, true);
      refreshWalletBlock();
    }, 7000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const accountsChangedHandler = (accounts) => {
      const account = accounts?.[0] || "";
      setWalletAddress(account);
      if (!account) {
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
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-brand-deep px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-0 top-28 h-80 w-80 animate-drift rounded-full bg-lime-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand-peach/25 blur-3xl" />
      </div>

      <Toaster position="top-right" toastOptions={{ duration: 2600 }} />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
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
                Course Enrollment, Secured by Smart Contracts
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Real-time decentralized seat tracking with immutable records and guaranteed over-enrollment prevention.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                <RadioTower className="h-4 w-4" />
                Last sync: {nowLabel(lastUpdated)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-lime-200/30 bg-lime-300/10 px-3 py-1 text-xs text-lime-100">
                Tx mode: {txMode}
              </span>
              <button
                type="button"
                onClick={() => loadCourses(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
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

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <AdminPanel onCreateCourse={createCourse} isCreating={isCreating} />

          <section className="glass-panel h-full">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300/90">Contract Setup</p>
            <h3 className="mt-1 text-lg font-display text-white">Automated Ganache Configuration</h3>
            <p className="mt-3 text-sm text-slate-200">
              Contract address and ABI are loaded automatically after deployment from backend artifact files.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              When backend contract config is available, transactions run via MetaMask. Otherwise, backend APIs are used.
            </p>
          </section>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-white">Course Catalog</h2>
            {loadingCourses ? <span className="text-sm text-slate-300">Updating from chain...</span> : null}
          </div>

          {courses.length === 0 && !loadingCourses ? (
            <div className="glass-panel text-center text-slate-200">
              No on-chain courses found. Create one from the Admin Panel.
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
                canEnroll={canEnroll}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
