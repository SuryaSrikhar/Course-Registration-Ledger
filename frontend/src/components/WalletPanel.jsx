import { motion } from "framer-motion";
import { Wallet, Link2, Network } from "lucide-react";

export function WalletPanel({
  walletAddress,
  networkLabel,
  blockNumber,
  onConnect,
  isConnecting
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/85">
            Wallet Gateway
          </p>
          <h2 className="mt-1 text-xl font-display text-white">MetaMask Identity</h2>
        </div>
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnecting}
          className="group inline-flex items-center gap-2 rounded-full border border-cyan-200/35 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          {isConnecting ? "Connecting..." : walletAddress ? "Reconnect" : "Connect Wallet"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="metric-card">
          <p className="metric-label">Status</p>
          <p className="metric-value text-cyan-100">
            {walletAddress ? "Connected" : "Not Connected"}
          </p>
        </div>

        <div className="metric-card">
          <p className="metric-label">Address</p>
          <p className="metric-value truncate text-sm text-slate-100">
            {walletAddress || "Connect MetaMask"}
          </p>
        </div>

        <div className="metric-card">
          <p className="metric-label">Network / Block</p>
          <p className="metric-value text-sm text-slate-100">
            <span className="inline-flex items-center gap-1">
              <Network className="h-4 w-4 text-cyan-200" />
              {networkLabel || "Unknown"}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-slate-300">
              <Link2 className="h-4 w-4 text-lime-200" />
              #{blockNumber ?? "--"}
            </span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
