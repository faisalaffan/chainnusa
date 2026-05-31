import type { NormalTx, TokenTx } from "./providers/data/types";
import { getChain, type ChainId } from "./chains";

/**
 * Heuristic analyzer.
 * - Aggregate native flows (in/out/gas)
 * - Categorize tx type (transfer/contract/DEX swap heuristic)
 * - Top counterparties by interaction count
 * - Per-token summary (in/out per ERC-20)
 * - Daily activity histogram
 */

export type TxCategory =
  | "native_transfer_in"
  | "native_transfer_out"
  | "contract_interaction"
  | "dex_swap"
  | "gmx"
  | "dydx"
  | "token_transfer"
  | "failed"
  | "self";

export interface TxCategoryCount {
  category: TxCategory;
  count: number;
}

export interface CounterpartyStat {
  address: string;
  interactions: number;
  isContract: boolean;
  label?: string;
}

export interface TokenStat {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  transferCount: number;
  totalIn: string; // decimal string
  totalOut: string; // decimal string
}

export interface DailyActivityPoint {
  date: string; // YYYY-MM-DD
  txCount: number;
  nativeIn: number;
  nativeOut: number;
}

export interface AnalysisTotals {
  nativeBalance: string; // decimal
  nativeIn: string; // decimal
  nativeOut: string; // decimal
  gasSpent: string; // decimal
  txCount: number;
  tokenTxCount: number;
  failedTxCount: number;
  uniqueCounterparties: number;
  firstTxAt: number | null; // unix seconds
  lastTxAt: number | null; // unix seconds
  activeDays: number;
}

export interface AnalysisResult {
  chainId: ChainId;
  chainName: string;
  nativeSymbol: string;
  address: string;
  totals: AnalysisTotals;
  categories: TxCategoryCount[];
  topCounterparties: CounterpartyStat[];
  tokens: TokenStat[];
  dailyActivity: DailyActivityPoint[];
  sampleTxs: NormalTx[]; // last 10 tx (subset, for UI)
  generatedAt: number;
}

const DEX_ROUTER_METHOD_PREFIXES = new Set([
  "0x38ed1739", // swapExactTokensForTokens
  "0x7ff36ab5", // swapExactETHForTokens
  "0x18cbafe5", // swapExactTokensForETH
  "0x5c11d795", // swapExactTokensForTokensSupportingFeeOnTransferTokens
  "0x414bf389", // exactInputSingle (UniswapV3)
  "0xc04b8d59", // exactInput
  "0xdb3e2198", // exactOutputSingle
  "0xf28c0498", // exactOutput
  "0xac9650d8", // multicall
]);

// GMX v2 ExchangeRouter method IDs (Arbitrum One, Avalanche)
const GMX_METHOD_PREFIXES = new Set([
  "0x2b0640f4", // sendTokens(address,address,address,uint256)
  "0x2e5bb6cc", // sendNativeToken(address,address,uint256)
  "0x0d3f2df4", // createOrder((address,address,address,address,uint256,uint256,uint256,uint256,uint256,bytes32))
  "0x5056f1a4", // cancelOrder(bytes32)
  "0x46c67253", // claimFundingFees(address[],address[],address[])
]);

// dYdX v3 SoloMargin method IDs (Ethereum L1)
const DYDX_METHOD_PREFIXES = new Set([
  "0x4f675e9e", // operate((address,uint256,uint256,uint256,uint8,bytes32)[])
  "0x47e7ef24", // deposit(address,uint256)
  "0xf3fef3a3", // withdraw(address,uint256)
  "0xbeabacc8", // transfer(address,address,uint256)
]);

// Known protocol contract addresses keyed by chain ID
const PROTOCOL_ADDRESSES: Partial<Record<number, Record<string, string[]>>> = {
  1: {
    // Ethereum Mainnet
    dydx: ["0x1e0447b19bb6ecfdae1e4ae1694b0c3659614e4e"], // SoloMargin
  },
  // GMX lives on Arbitrum (42161) and Avalanche (43114) — not yet supported chains.
  // When Arbitrum support is added:
  // 42161: { gmx: ["0x7c68c42de679ffb0f16216154c996678f3d03a7a"] },
};

const WEI_PER_ETH = 10n ** 18n;

function weiToDecimal(wei: bigint, decimals = 18, precision = 6): string {
  if (wei === 0n) return "0";
  const neg = wei < 0n;
  const abs = neg ? -wei : wei;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  if (precision <= 0) return `${neg ? "-" : ""}${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${fracStr ? "." + fracStr : ""}`;
}

function safeBigInt(s: string | undefined): bigint {
  if (!s) return 0n;
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

function categorizeTx(tx: NormalTx, address: string, chainId?: number): TxCategory {
  const me = address.toLowerCase();
  const from = (tx.from || "").toLowerCase();
  const to = (tx.to || "").toLowerCase();

  if (tx.isError === "1") return "failed";
  if (from && to && from === to && from === me) return "self";

  const methodId = (tx.methodId || tx.input?.slice(0, 10) || "").toLowerCase();
  const hasInput = tx.input && tx.input !== "0x" && tx.input !== "0x0";

  if (!hasInput) {
    if (from === me && BigInt(tx.value || "0") > 0n) return "native_transfer_out";
    if (to === me && BigInt(tx.value || "0") > 0n) return "native_transfer_in";
    return "contract_interaction";
  }

  // Protocol-specific detection (more specific before generic DEX)
  if (GMX_METHOD_PREFIXES.has(methodId)) return "gmx";
  if (DYDX_METHOD_PREFIXES.has(methodId)) return "dydx";

  // Address-based detection for protocols without unique method IDs
  if (chainId && PROTOCOL_ADDRESSES[chainId]) {
    const protocolAddrs = PROTOCOL_ADDRESSES[chainId]!;
    for (const [protocol, addresses] of Object.entries(protocolAddrs)) {
      if (addresses.some((a) => a.toLowerCase() === to)) {
        if (protocol === "dydx") return "dydx";
        if (protocol === "gmx") return "gmx";
      }
    }
  }

  if (DEX_ROUTER_METHOD_PREFIXES.has(methodId)) return "dex_swap";

  return "contract_interaction";
}

function toDateUTC(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface AnalyzeInput {
  chainId: ChainId;
  address: string;
  nativeBalanceWei: string;
  normalTxs: NormalTx[];
  tokenTxs: TokenTx[];
}

export function analyze(input: AnalyzeInput): AnalysisResult {
  const { chainId, address, nativeBalanceWei, normalTxs, tokenTxs } = input;
  const me = address.toLowerCase();
  const chain = getChain(chainId);

  let nativeIn = 0n;
  let nativeOut = 0n;
  let gasSpent = 0n;
  let failed = 0;

  const catCounts: Record<TxCategory, number> = {
    native_transfer_in: 0,
    native_transfer_out: 0,
    contract_interaction: 0,
    dex_swap: 0,
    gmx: 0,
    dydx: 0,
    token_transfer: 0,
    failed: 0,
    self: 0,
  };

  const counterparty = new Map<string, { interactions: number; isContract: boolean }>();
  const daily = new Map<string, { txCount: number; nativeIn: bigint; nativeOut: bigint }>();

  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const tx of normalTxs) {
    const ts = Number(tx.timeStamp || 0);
    if (ts) {
      firstTs = firstTs === null ? ts : Math.min(firstTs, ts);
      lastTs = lastTs === null ? ts : Math.max(lastTs, ts);
    }

    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    const value = safeBigInt(tx.value);
    const gasUsed = safeBigInt(tx.gasUsed);
    const gasPrice = safeBigInt(tx.gasPrice);

    if (tx.isError === "1") failed++;

    const cat = categorizeTx(tx, me, chainId);
    catCounts[cat]++;

    // gas is only paid when the wallet is the sender
    if (from === me) {
      gasSpent += gasUsed * gasPrice;
      if (value > 0n) nativeOut += value;
    }
    if (to === me && value > 0n) nativeIn += value;

    // counterparty tally — the non-me side
    const other = from === me ? to : from;
    if (other && other !== me) {
      const existing = counterparty.get(other) || {
        interactions: 0,
        isContract: Boolean(tx.contractAddress && tx.contractAddress !== ""),
      };
      existing.interactions++;
      // if tx.input has data, "other" is likely a contract
      if (tx.input && tx.input !== "0x") existing.isContract = true;
      counterparty.set(other, existing);
    }

    // daily bucket
    if (ts) {
      const date = toDateUTC(ts);
      const bucket = daily.get(date) || { txCount: 0, nativeIn: 0n, nativeOut: 0n };
      bucket.txCount++;
      if (from === me && value > 0n) bucket.nativeOut += value;
      if (to === me && value > 0n) bucket.nativeIn += value;
      daily.set(date, bucket);
    }
  }

  // token transfers — aggregate per token contract
  const tokenMap = new Map<
    string,
    { symbol: string; name: string; decimals: number; count: number; totalIn: bigint; totalOut: bigint }
  >();
  for (const ttx of tokenTxs) {
    const contract = (ttx.contractAddress || "").toLowerCase();
    if (!contract) continue;
    const dec = Math.min(Number(ttx.tokenDecimal || 18), 36);
    const raw = safeBigInt(ttx.value);
    const entry = tokenMap.get(contract) || {
      symbol: ttx.tokenSymbol || "?",
      name: ttx.tokenName || "Unknown",
      decimals: dec,
      count: 0,
      totalIn: 0n,
      totalOut: 0n,
    };
    entry.count++;
    const from = (ttx.from || "").toLowerCase();
    const to = (ttx.to || "").toLowerCase();
    if (to === me) entry.totalIn += raw;
    if (from === me) entry.totalOut += raw;
    tokenMap.set(contract, entry);

    // include token counterparty too
    const other = from === me ? to : from;
    if (other && other !== me) {
      const existing = counterparty.get(other) || { interactions: 0, isContract: false };
      existing.interactions++;
      counterparty.set(other, existing);
    }

    // count the token transfer itself
    catCounts.token_transfer++;

    // update first/last
    const tts = Number(ttx.timeStamp || 0);
    if (tts) {
      firstTs = firstTs === null ? tts : Math.min(firstTs, tts);
      lastTs = lastTs === null ? tts : Math.max(lastTs, tts);
      const date = toDateUTC(tts);
      const bucket = daily.get(date) || { txCount: 0, nativeIn: 0n, nativeOut: 0n };
      bucket.txCount++;
      daily.set(date, bucket);
    }
  }

  const topCounterparties: CounterpartyStat[] = Array.from(counterparty.entries())
    .map(([address, v]) => ({
      address,
      interactions: v.interactions,
      isContract: v.isContract,
    }))
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 10);

  const tokens: TokenStat[] = Array.from(tokenMap.entries())
    .map(([contractAddress, v]) => ({
      contractAddress,
      symbol: v.symbol,
      name: v.name,
      decimals: v.decimals,
      transferCount: v.count,
      totalIn: weiToDecimal(v.totalIn, v.decimals),
      totalOut: weiToDecimal(v.totalOut, v.decimals),
    }))
    .sort((a, b) => b.transferCount - a.transferCount)
    .slice(0, 20);

  const dailyActivity: DailyActivityPoint[] = Array.from(daily.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({
      date,
      txCount: v.txCount,
      nativeIn: Number(weiToDecimal(v.nativeIn, 18, 6)),
      nativeOut: Number(weiToDecimal(v.nativeOut, 18, 6)),
    }));

  const categoriesArr: TxCategoryCount[] = Object.entries(catCounts)
    .filter(([, n]) => n > 0)
    .map(([category, count]) => ({ category: category as TxCategory, count }));

  const totals: AnalysisTotals = {
    nativeBalance: weiToDecimal(safeBigInt(nativeBalanceWei), 18, 6),
    nativeIn: weiToDecimal(nativeIn, 18, 6),
    nativeOut: weiToDecimal(nativeOut, 18, 6),
    gasSpent: weiToDecimal(gasSpent, 18, 6),
    txCount: normalTxs.length,
    tokenTxCount: tokenTxs.length,
    failedTxCount: failed,
    uniqueCounterparties: counterparty.size,
    firstTxAt: firstTs,
    lastTxAt: lastTs,
    activeDays: daily.size,
  };

  // lightweight sample (last 10) for UI
  const sampleTxs = [...normalTxs]
    .sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
    .slice(0, 10);

  return {
    chainId,
    chainName: chain.name,
    nativeSymbol: chain.nativeSymbol,
    address,
    totals,
    categories: categoriesArr,
    topCounterparties,
    tokens,
    dailyActivity,
    sampleTxs,
    generatedAt: Date.now(),
  };
}

// small helper exposed so API routes can reuse conversion (e.g. balance weighting)
export const _internal = { weiToDecimal, WEI_PER_ETH };
