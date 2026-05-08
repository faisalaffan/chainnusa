import {
  createPublicClient,
  http,
  fallback,
  parseAbi,
  pad,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { mainnet, bsc, polygon } from "viem/chains";
import type { ChainId } from "@/lib/chains";
import type {
  DataProvider,
  DataProviderInfo,
  FetchAllResult,
  NormalTx,
  TokenTx,
} from "./types";

/**
 * Self-hosted data provider using direct JSON-RPC.
 *
 * Trade-offs (intentional, see README):
 * - JSON-RPC has no "tx history by address" endpoint; we use eth_getLogs
 *   for ERC-20 Transfer events (indexed by from/to topics).
 * - Native ETH tx history is NOT fetched in RPC mode (would require
 *   block-by-block scanning, prohibitively slow on public RPCs).
 * - Native balance + ERC-20 transfers are fully covered.
 */

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

const ERC20_META_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

interface ChainRpcConfig {
  chain: typeof mainnet | typeof bsc | typeof polygon;
  defaults: string[];
}

const CHAIN_CFG: Record<ChainId, ChainRpcConfig> = {
  1: {
    chain: mainnet,
    defaults: [
      "https://eth.llamarpc.com",
      "https://cloudflare-eth.com",
      "https://eth.drpc.org",
    ],
  },
  56: {
    chain: bsc,
    defaults: [
      "https://bsc-dataseed.binance.org",
      "https://bsc.publicnode.com",
      "https://bsc.drpc.org",
    ],
  },
  137: {
    chain: polygon,
    defaults: [
      "https://polygon-rpc.com",
      "https://polygon.llamarpc.com",
      "https://polygon.drpc.org",
    ],
  },
};

function getRpcUrls(chainId: ChainId): string[] {
  const envKey = `RPC_URLS_${chainId}`;
  const raw = process.env[envKey];
  if (raw && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return CHAIN_CFG[chainId].defaults;
}

function getBlockRange(): bigint {
  const raw = Number(process.env.RPC_LOG_BLOCK_RANGE || 10000);
  return BigInt(Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100_000) : 10000);
}

function buildClient(chainId: ChainId): PublicClient {
  const cfg = CHAIN_CFG[chainId];
  const urls = getRpcUrls(chainId);
  const transports = urls.map((u) => http(u, { timeout: 15_000 }));
  return createPublicClient({
    chain: cfg.chain,
    transport: fallback(transports, { rank: false, retryCount: 1 }),
  });
}

function addressTopic(addr: Address): Hex {
  return pad(addr.toLowerCase() as Hex, { size: 32 }) as Hex;
}

interface RawRpcLog {
  address: Hex;
  topics: Hex[];
  data: Hex;
  blockNumber: Hex;
  transactionHash: Hex;
  logIndex: Hex;
}

interface DecodedTransfer {
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: number;
  from: Address;
  to: Address;
  value: bigint;
  contract: Address;
}

function decodeTransferLog(log: RawRpcLog): DecodedTransfer | null {
  if (!log.topics || log.topics.length < 3) return null;
  const [, fromTopic, toTopic] = log.topics;
  if (!fromTopic || !toTopic) return null;
  const from = ("0x" + fromTopic.slice(26)) as Address;
  const to = ("0x" + toTopic.slice(26)) as Address;
  let value = 0n;
  try {
    value = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
  } catch {
    value = 0n;
  }
  return {
    blockNumber: BigInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: Number(log.logIndex),
    from,
    to,
    value,
    contract: log.address as Address,
  };
}

async function rpcGetLogs(
  client: PublicClient,
  params: {
    fromBlock: bigint;
    toBlock: bigint;
    topics: (Hex | null)[];
  }
): Promise<RawRpcLog[]> {
  const result = (await client.request({
    method: "eth_getLogs" as const,
    params: [
      {
        fromBlock: toHex(params.fromBlock),
        toBlock: toHex(params.toBlock),
        topics: params.topics,
      },
    ] as never,
  })) as RawRpcLog[];
  return result;
}

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
}

async function fetchTokenMetaBatch(
  client: PublicClient,
  contracts: Address[]
): Promise<Map<string, TokenMeta>> {
  const out = new Map<string, TokenMeta>();
  if (contracts.length === 0) return out;

  // Use multicall (viem auto-detects support; falls back to individual calls).
  const calls = contracts.flatMap((addr) => [
    { address: addr, abi: ERC20_META_ABI, functionName: "name" as const },
    { address: addr, abi: ERC20_META_ABI, functionName: "symbol" as const },
    { address: addr, abi: ERC20_META_ABI, functionName: "decimals" as const },
  ]);

  const results = await client.multicall({ contracts: calls, allowFailure: true });

  for (let i = 0; i < contracts.length; i++) {
    const nameRes = results[i * 3];
    const symRes = results[i * 3 + 1];
    const decRes = results[i * 3 + 2];
    out.set(contracts[i].toLowerCase(), {
      name: nameRes?.status === "success" ? String(nameRes.result) : "Unknown",
      symbol: symRes?.status === "success" ? String(symRes.result) : "?",
      decimals: decRes?.status === "success" ? Number(decRes.result) : 18,
    });
  }
  return out;
}

async function fetchBlockTimestamps(
  client: PublicClient,
  blocks: Set<bigint>
): Promise<Map<string, bigint>> {
  const map = new Map<string, bigint>();
  // Limit concurrency to avoid hammering public RPCs.
  const arr = Array.from(blocks);
  const concurrency = 6;
  for (let i = 0; i < arr.length; i += concurrency) {
    const batch = arr.slice(i, i + concurrency);
    const blocksData = await Promise.all(
      batch.map((bn) =>
        client.getBlock({ blockNumber: bn }).catch(() => null)
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const b = blocksData[j];
      if (b) map.set(batch[j].toString(), b.timestamp);
    }
  }
  return map;
}

export class RpcProvider implements DataProvider {
  readonly info: DataProviderInfo = {
    id: "rpc",
    label: "Direct JSON-RPC (viem + public endpoints)",
    capabilities: {
      nativeTxHistory: false,
      erc20TxHistory: true,
      nativeBalance: true,
    },
    notes: [
      "Tidak butuh API key — pakai public RPC",
      "Native tx history TIDAK tersedia (limitasi JSON-RPC)",
      "ERC-20 transfers di-fetch dari N blok terakhir via eth_getLogs",
    ],
  };

  async fetchAll(chainId: ChainId, address: string): Promise<FetchAllResult> {
    const client = buildClient(chainId);
    const addr = address as Address;

    const blockRange = getBlockRange();
    const latest = await client.getBlockNumber();
    const fromBlock = latest > blockRange ? latest - blockRange : 0n;

    const [nativeBalance, outLogs, inLogs] = await Promise.all([
      client.getBalance({ address: addr }),
      rpcGetLogs(client, {
        fromBlock,
        toBlock: latest,
        topics: [TRANSFER_TOPIC, addressTopic(addr), null],
      }),
      rpcGetLogs(client, {
        fromBlock,
        toBlock: latest,
        topics: [TRANSFER_TOPIC, null, addressTopic(addr)],
      }),
    ]);

    const allLogs = [...outLogs, ...inLogs];
    const decoded: DecodedTransfer[] = [];
    for (const log of allLogs) {
      const d = decodeTransferLog(log);
      if (d) decoded.push(d);
    }

    // de-dup by (txHash, logIndex)
    const seen = new Set<string>();
    const unique = decoded.filter((d) => {
      const k = `${d.transactionHash}-${d.logIndex}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Cap to last 500 to mirror Etherscan provider behavior.
    unique.sort((a, b) => Number(b.blockNumber - a.blockNumber));
    const trimmed = unique.slice(0, 500);

    const uniqueContracts = Array.from(
      new Set(trimmed.map((d) => d.contract.toLowerCase()))
    ).map((s) => s as Address);

    const uniqueBlocks = new Set<bigint>(trimmed.map((d) => d.blockNumber));

    const [tokenMeta, blockTs] = await Promise.all([
      fetchTokenMetaBatch(client, uniqueContracts),
      fetchBlockTimestamps(client, uniqueBlocks),
    ]);

    const tokenTxs: TokenTx[] = trimmed.map((d) => {
      const meta = tokenMeta.get(d.contract.toLowerCase());
      const ts = blockTs.get(d.blockNumber.toString()) ?? 0n;
      return {
        hash: d.transactionHash || "",
        blockNumber: d.blockNumber.toString(),
        timeStamp: ts.toString(),
        from: d.from,
        to: d.to,
        value: d.value.toString(),
        tokenName: meta?.name || "Unknown",
        tokenSymbol: meta?.symbol || "?",
        tokenDecimal: String(meta?.decimals ?? 18),
        contractAddress: d.contract,
      };
    });

    return {
      nativeBalanceWei: nativeBalance.toString(),
      normalTxs: [], // not available via plain RPC
      tokenTxs,
      providerInfo: this.info,
    };
  }
}
