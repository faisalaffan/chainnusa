import { ChainId } from "./chains";

/**
 * Etherscan V2 multichain API client.
 * Docs: https://docs.etherscan.io/etherscan-v2
 * Single endpoint + single API key for 50+ chains via `chainid` query param.
 */

const BASE_URL = "https://api.etherscan.io/v2/api";

export interface NormalTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string; // wei
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string; // "0" | "1"
  input: string;
  contractAddress: string;
  functionName?: string;
  methodId?: string;
}

export interface TokenTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string; // raw with decimals
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

interface EtherscanResponse<T> {
  status: string; // "1" = ok, "0" = error/empty
  message: string;
  result: T;
}

class EtherscanError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = "EtherscanError";
  }
}

function getApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new EtherscanError("ETHERSCAN_API_KEY is not set");
  return key;
}

async function callEtherscan<T>(params: Record<string, string | number>): Promise<T> {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apikey", getApiKey());

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Accept": "application/json" },
    // Avoid Next.js caching — we have our own cache layer.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EtherscanError(`HTTP ${res.status} ${res.statusText}`, { url: url.toString() });
  }

  const json = (await res.json()) as EtherscanResponse<T>;

  // Etherscan returns status "0" + message "No transactions found" for empty results.
  // That's not an error — treat it as empty.
  if (json.status !== "1") {
    const msg = String(json.message || "").toLowerCase();
    if (msg.includes("no transactions found") || msg.includes("no records found")) {
      return [] as unknown as T;
    }
    // Rate limit or invalid key
    throw new EtherscanError(`Etherscan error: ${json.message} — ${JSON.stringify(json.result)}`, {
      params,
    });
  }

  return json.result;
}

export async function getNativeBalance(chainId: ChainId, address: string): Promise<string> {
  const result = await callEtherscan<string>({
    chainid: chainId,
    module: "account",
    action: "balance",
    address,
    tag: "latest",
  });
  return result;
}

export async function getNormalTxs(
  chainId: ChainId,
  address: string,
  opts: { page?: number; offset?: number; sort?: "asc" | "desc" } = {}
): Promise<NormalTx[]> {
  const { page = 1, offset = 500, sort = "desc" } = opts;
  const result = await callEtherscan<NormalTx[]>({
    chainid: chainId,
    module: "account",
    action: "txlist",
    address,
    startblock: 0,
    endblock: 99999999,
    page,
    offset,
    sort,
  });
  return Array.isArray(result) ? result : [];
}

export async function getTokenTxs(
  chainId: ChainId,
  address: string,
  opts: { page?: number; offset?: number; sort?: "asc" | "desc" } = {}
): Promise<TokenTx[]> {
  const { page = 1, offset = 500, sort = "desc" } = opts;
  const result = await callEtherscan<TokenTx[]>({
    chainid: chainId,
    module: "account",
    action: "tokentx",
    address,
    startblock: 0,
    endblock: 99999999,
    page,
    offset,
    sort,
  });
  return Array.isArray(result) ? result : [];
}

export { EtherscanError };
