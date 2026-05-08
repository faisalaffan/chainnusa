import type { ChainId } from "@/lib/chains";
import type {
  DataProvider,
  DataProviderInfo,
  FetchAllResult,
  NormalTx,
  TokenTx,
} from "./types";

const BASE_URL = "https://api.etherscan.io/v2/api";

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

export class EtherscanError extends Error {
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
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("apikey", getApiKey());

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EtherscanError(`HTTP ${res.status} ${res.statusText}`, { url: url.toString() });
  }

  const json = (await res.json()) as EtherscanResponse<T>;

  if (json.status !== "1") {
    const msg = String(json.message || "").toLowerCase();
    if (msg.includes("no transactions found") || msg.includes("no records found")) {
      return [] as unknown as T;
    }
    throw new EtherscanError(
      `Etherscan error: ${json.message} — ${JSON.stringify(json.result)}`,
      { params }
    );
  }

  return json.result;
}

export class EtherscanProvider implements DataProvider {
  readonly info: DataProviderInfo = {
    id: "etherscan",
    label: "Etherscan V2 (multichain API)",
    capabilities: {
      nativeTxHistory: true,
      erc20TxHistory: true,
      nativeBalance: true,
    },
    notes: ["Membutuhkan ETHERSCAN_API_KEY", "Limit: 5 req/s pada free tier"],
  };

  async fetchAll(chainId: ChainId, address: string): Promise<FetchAllResult> {
    const [nativeBalanceWei, normalTxs, tokenTxs] = await Promise.all([
      this.getNativeBalance(chainId, address),
      this.getNormalTxs(chainId, address),
      this.getTokenTxs(chainId, address),
    ]);
    return { nativeBalanceWei, normalTxs, tokenTxs, providerInfo: this.info };
  }

  private async getNativeBalance(chainId: ChainId, address: string): Promise<string> {
    return callEtherscan<string>({
      chainid: chainId,
      module: "account",
      action: "balance",
      address,
      tag: "latest",
    });
  }

  private async getNormalTxs(chainId: ChainId, address: string): Promise<NormalTx[]> {
    const result = await callEtherscan<NormalTx[]>({
      chainid: chainId,
      module: "account",
      action: "txlist",
      address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 500,
      sort: "desc",
    });
    return Array.isArray(result) ? result : [];
  }

  private async getTokenTxs(chainId: ChainId, address: string): Promise<TokenTx[]> {
    const result = await callEtherscan<TokenTx[]>({
      chainid: chainId,
      module: "account",
      action: "tokentx",
      address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 500,
      sort: "desc",
    });
    return Array.isArray(result) ? result : [];
  }
}
