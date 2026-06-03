import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "crypto";

const REPORT_MINTED_SIG = "0x0e9610a0498cf82d997d16fba620db395ebf8cc1e28333b9e0a8be89a768a276";
const ANALYSIS_RECORDED_SIG = "0xec007a1b11758c648cfcaa49f57246c1d59aa950d16173339243ca5982ccaf60";

// ---- ABIs (minimal — only used selectors) ----

const REGISTRY_ABI = [
  {
    type: "function",
    name: "recordAnalysis",
    inputs: [
      { name: "cidBytes", type: "bytes32" },
      { name: "chainId", type: "uint256" },
      { name: "indexedWallet", type: "address" },
    ],
    outputs: [{ name: "analysisId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAnalysesForWallet",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "analysisCount",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "records",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "cidBytes", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "chainId", type: "uint256" },
      { name: "indexedWallet", type: "address" },
      { name: "analyst", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AnalysisRecorded",
    inputs: [
      { name: "analysisId", type: "bytes32", indexed: true },
      { name: "indexedWallet", type: "address", indexed: true },
      { name: "cidBytes", type: "bytes32", indexed: false },
      { name: "chainId", type: "uint256", indexed: false },
      { name: "analyst", type: "address", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const SBT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "analysisId", type: "bytes32" },
      { name: "cidBytes", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "hasMinted",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ReportMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "analysisId", type: "bytes32", indexed: true },
      { name: "cidBytes", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

// ---- Config from env ----

function getRegistryAddress(): Address {
  const addr = process.env.ANALYSIS_REGISTRY_ADDRESS;
  if (!addr) throw new Error("ANALYSIS_REGISTRY_ADDRESS not set");
  return addr as Address;
}

function getSbtAddress(): Address {
  const addr = process.env.REPORT_SBT_ADDRESS;
  if (!addr) throw new Error("REPORT_SBT_ADDRESS not set");
  return addr as Address;
}

function getDeployerKey(): Hex {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  return key as Hex;
}

function getRpcUrl(): string {
  return (
    process.env.RPC_URLS_31337?.split(",")[0]?.trim() ||
    "http://127.0.0.1:8545"
  );
}

// ---- Clients ----

function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: anvil,
    transport: http(getRpcUrl()),
  });
}

function getWalletClient(): WalletClient {
  const account = privateKeyToAccount(getDeployerKey());
  return createWalletClient({
    chain: anvil,
    transport: http(getRpcUrl()),
    account,
  });
}

// ---- Helpers ----

function bytesToHex32(input: string): Hex {
  const data = new TextEncoder().encode(input);
  const sha = createHash("sha256").update(data).digest("hex");
  return `0x${sha}` as Hex;
}

// ---- Public API ----

export interface RecordAnalysisResult {
  analysisId: Hex;
  registryTxHash: Hex;
  sbtTokenId: bigint;
  sbtTxHash: Hex;
}

/**
 * Record analysis on-chain + mint SBT in one operation.
 * Uses the deployer account (owner of both contracts).
 */
export async function recordAndMint(
  walletAddress: string,
  chainId: number,
  analysisJson: string
): Promise<RecordAnalysisResult> {
  const publicClient = getPublicClient();
  const wallet = getWalletClient();

  const cidBytes = bytesToHex32(analysisJson);
  const registryAddr = getRegistryAddress();
  const sbtAddr = getSbtAddress();

  // Step 1: recordAnalysis
  const { request: regRequest } = await publicClient.simulateContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: "recordAnalysis",
    args: [cidBytes, BigInt(chainId), walletAddress as Address],
    account: wallet.account,
  });

  const regTxHash = await wallet.writeContract(regRequest);
  const regReceipt = await publicClient.waitForTransactionReceipt({
    hash: regTxHash,
  });

  // Parse analysisId from AnalysisRecorded event
  const analysisId = parseAnalysisId(regReceipt.logs, registryAddr);
  if (!analysisId) throw new Error("Failed to parse analysisId from event");

  // Step 2: mint SBT
  const { request: mintRequest } = await publicClient.simulateContract({
    address: sbtAddr,
    abi: SBT_ABI,
    functionName: "mint",
    args: [walletAddress as Address, analysisId, cidBytes],
    account: wallet.account,
  });

  const sbtTxHash = await wallet.writeContract(mintRequest);
  const sbtReceipt = await publicClient.waitForTransactionReceipt({
    hash: sbtTxHash,
  });

  const tokenId = parseTokenId(sbtReceipt.logs, sbtAddr);
  if (tokenId === null) throw new Error("Failed to parse tokenId from event");

  return {
    analysisId,
    registryTxHash: regTxHash,
    sbtTokenId: tokenId,
    sbtTxHash,
  };
}

function parseAnalysisId(
  logs: { address: Address; topics: Hex[]; data: Hex }[],
  registryAddr: Address
): Hex | null {
  for (const log of logs) {
    if (log.address.toLowerCase() !== registryAddr.toLowerCase()) continue;
    if (log.topics[0] !== ANALYSIS_RECORDED_SIG) continue;
    // AnalysisRecorded: topics[1] = analysisId (indexed bytes32)
    if (log.topics.length >= 2) return log.topics[1];
  }
  return null;
}

function parseTokenId(
  logs: { address: Address; topics: Hex[]; data: Hex }[],
  sbtAddr: Address
): bigint | null {
  for (const log of logs) {
    if (log.address.toLowerCase() !== sbtAddr.toLowerCase()) continue;
    if (log.topics[0] !== REPORT_MINTED_SIG) continue;
    // ReportMinted: topics[1] = tokenId (indexed uint256)
    if (log.topics.length >= 2) return BigInt(log.topics[1]);
  }
  return null;
}

/**
 * Get all analysis IDs for a wallet (read-only).
 */
export async function getAnalysesForWallet(
  walletAddress: string
): Promise<Hex[]> {
  const client = getPublicClient();
  const ids = await client.readContract({
    address: getRegistryAddress(),
    abi: REGISTRY_ABI,
    functionName: "getAnalysesForWallet",
    args: [walletAddress as Address],
  });
  return ids as Hex[];
}

/**
 * Check if an SBT has already been minted for a wallet+analysis.
 */
export async function hasSbtMinted(
  walletAddress: string,
  analysisId: Hex
): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: getSbtAddress(),
    abi: SBT_ABI,
    functionName: "hasMinted",
    args: [walletAddress as Address, analysisId],
  }) as Promise<boolean>;
}
