/**
 * AnalysisRegistry ABI (minimal — for event listening and read calls).
 * Generated from contracts/src/AnalysisRegistry.sol
 */

export const ANALYSIS_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordAnalysis",
    inputs: [
      { name: "cidBytes", type: "bytes32", internalType: "bytes32" },
      { name: "chainId", type: "uint256", internalType: "uint256" },
      { name: "indexedWallet", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "analysisId", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "analysisCount",
    inputs: [{ name: "wallet", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAnalysesForWallet",
    inputs: [{ name: "wallet", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bytes32[]", internalType: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAnalyses",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AnalysisRecorded",
    inputs: [
      { name: "analysisId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "indexedWallet", type: "address", indexed: true, internalType: "address" },
      { name: "cidBytes", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "chainId", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "analyst", type: "address", indexed: false, internalType: "address" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;

/**
 * ReportSBT ABI (minimal).
 * Generated from contracts/src/ReportSBT.sol
 */

export const REPORT_SBT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "analysisId", type: "bytes32", internalType: "bytes32" },
      { name: "cidBytes", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasMinted",
    inputs: [
      { name: "wallet", type: "address", internalType: "address" },
      { name: "analysisId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "burn",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ReportMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "analysisId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "cidBytes", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "SoulboundTokenCannotTransfer",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadyMinted",
    inputs: [
      { name: "wallet", type: "address", internalType: "address" },
      { name: "analysisId", type: "bytes32", internalType: "bytes32" },
    ],
  },
] as const;
