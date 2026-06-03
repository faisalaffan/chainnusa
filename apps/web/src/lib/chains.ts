export type ChainId = 1 | 56 | 137 | 31337;

export interface ChainConfig {
  id: ChainId;
  name: string;
  shortName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  explorerUrl: string;
  color: string;
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  1: {
    id: 1,
    name: "Ethereum Mainnet",
    shortName: "Ethereum",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerUrl: "https://etherscan.io",
    color: "#627EEA",
  },
  56: {
    id: 56,
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
    explorerUrl: "https://bscscan.com",
    color: "#F0B90B",
  },
  137: {
    id: 137,
    name: "Polygon",
    shortName: "Polygon",
    nativeSymbol: "MATIC",
    nativeDecimals: 18,
    explorerUrl: "https://polygonscan.com",
    color: "#8247E5",
  },
  31337: {
    id: 31337,
    name: "Anvil Local Testnet",
    shortName: "Anvil",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerUrl: "",
    color: "#A855F7",
  },
};

export const SUPPORTED_CHAIN_IDS: ChainId[] = [1, 56, 137, 31337];

export function getChain(chainId: number): ChainConfig {
  const cfg = CHAINS[chainId as ChainId];
  if (!cfg) throw new Error(`Unsupported chainId: ${chainId}`);
  return cfg;
}

export function isSupportedChain(chainId: number): chainId is ChainId {
  return SUPPORTED_CHAIN_IDS.includes(chainId as ChainId);
}
