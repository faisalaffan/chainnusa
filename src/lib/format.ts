export function shortAddr(a: string, head = 6, tail = 4): string {
  if (!a) return "";
  if (a.length <= head + tail + 2) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function formatNumber(n: number | string, max = 6): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return String(n);
  if (Math.abs(num) >= 1) {
    return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return num.toLocaleString("en-US", { maximumFractionDigits: max });
}

export function formatTs(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "-";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    native_transfer_in: "Native In",
    native_transfer_out: "Native Out",
    contract_interaction: "Contract Interaction",
    dex_swap: "DEX Swap",
    token_transfer: "Token Transfer",
    failed: "Failed",
    self: "Self Tx",
  };
  return map[c] || c;
}

export function categoryColor(c: string): string {
  const map: Record<string, string> = {
    native_transfer_in: "#22c55e",
    native_transfer_out: "#ef4444",
    contract_interaction: "#3b82f6",
    dex_swap: "#a855f7",
    token_transfer: "#f59e0b",
    failed: "#9ca3af",
    self: "#6b7280",
  };
  return map[c] || "#3b82f6";
}
