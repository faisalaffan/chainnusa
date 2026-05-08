import type { ChainId } from "@/lib/chains";

/**
 * Normalized transaction shape used by the analyzer.
 * All providers must produce this shape regardless of upstream source.
 */
export interface NormalTx {
  hash: string;
  blockNumber: string;
  timeStamp: string; // unix seconds (string for parity with Etherscan)
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

export type DataProviderId = "etherscan" | "rpc";

export interface DataProviderInfo {
  id: DataProviderId;
  label: string;
  capabilities: {
    nativeTxHistory: boolean;
    erc20TxHistory: boolean;
    nativeBalance: boolean;
  };
  notes?: string[];
}

export interface FetchAllResult {
  nativeBalanceWei: string;
  normalTxs: NormalTx[];
  tokenTxs: TokenTx[];
  providerInfo: DataProviderInfo;
}

export interface DataProvider {
  readonly info: DataProviderInfo;
  fetchAll(chainId: ChainId, address: string): Promise<FetchAllResult>;
}
