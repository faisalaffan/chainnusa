/**
 * Contract interaction helpers — used client-side with wagmi/viem.
 *
 * Prerequisites (add to apps/web):
 *   pnpm add wagmi viem @wagmi/core @wagmi/connectors
 */

import { encodeFunctionData, keccak256, toHex, type Address, type Hash } from "viem";

export { ANALYSIS_REGISTRY_ABI, REPORT_SBT_ABI } from "./abi";

/**
 * Encode recordAnalysis() call data for use with sendTransaction or useWriteContract.
 */
export function encodeRecordAnalysis(
  cidBytes: Hash,
  chainId: number,
  indexedWallet: Address,
): Hash {
  return encodeFunctionData({
    abi: [
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
    ],
    functionName: "recordAnalysis",
    args: [cidBytes, BigInt(chainId), indexedWallet],
  }) as Hash;
}

/**
 * CID string → bytes32.
 * For CIDv1 in IPFS: use first 32 bytes of the raw multihash,
 * or keccak256 of the CID string as a simple approach.
 */
export function cidToBytes32(cid: string): Hash {
  return keccak256(toHex(cid));
}
