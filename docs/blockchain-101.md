# Blockchain 101 — for ChainNusa

Short and practical. For deep theory, see references at the end.

## 1. EVM-compatible chains

| Chain | ID | Block time | Native | Use case |
|---|---|---|---|---|
| Ethereum | 1 | ~12s | ETH | DeFi blue chips, settlement |
| BNB Smart Chain | 56 | ~3s | BNB | High-volume retail |
| Polygon PoS | 137 | ~2s | MATIC | NFT, gaming |
| Arbitrum One | 42161 | ~250ms | ETH | L2 rollup, low fee |
| Base | 8453 | ~2s | ETH | Coinbase L2 |
| Optimism | 10 | ~2s | ETH | OP-stack rollup |

ChainNusa uses EVM only — all transactions are ABI-compatible, differing only by `chainId` + RPC.

## 2. Account types

- **EOA (Externally Owned Account)** — controlled by private key. Regular user wallet.
- **Contract Account** — bytecode, called via tx. Cannot initiate tx itself.

ChainNusa distinguishes EOA vs contract via heuristic: if `tx.input` is non-empty or the address has bytecode (`eth_getCode`), counterparty = contract.

## 3. Transaction anatomy

```
{ from, to, value, data (input), gas, gasPrice, nonce, hash, blockNumber }
```

- `value` = native amount (wei, 1 ETH = 1e18 wei).
- `data` (or `input`) = function selector (4 bytes) + ABI-encoded args.
- `methodId` = first 4 bytes of `keccak256(signature)`. Example: `0x38ed1739` = `swapExactTokensForTokens`. ChainNusa uses this for coarse classification.

## 4. ERC-20 Transfer event

```
event Transfer(address indexed from, address indexed to, uint256 value);
keccak256 → 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

Because `from` & `to` are indexed, they can be filtered via `eth_getLogs` topic 1/2. That's why `RpcProvider` (`apps/web/src/lib/providers/data/rpc.ts`) doesn't need Etherscan for token history.

## 5. Cryptography for wallet auth (SIWE)

Sign-in with Ethereum (EIP-4361):

1. Server generates nonce + domain.
2. Client builds human-readable message → wallet signs via `personal_sign`.
3. Server verifies signature using `ecrecover` → gets address → matches with claim.

Source of truth: Ethereum address = lower 160 bits of `keccak256(public_key)`.

## 6. Soulbound Token (SBT)

An NFT (ERC-721) that is **non-transferable**. Implementation: override `_update` / `_beforeTokenTransfer` in OpenZeppelin v5 to revert except mint/burn. Suitable for **identity reports / credentials** that should not be traded.

ChainNusa uses SBT for: "wallet `0xabc...` has an analysis report with IPFS CID X at block N." Permanent proof, cannot be flipped.

## 7. Oracle (Chainlink Price Feed)

```solidity
AggregatorV3Interface(0x5147eA642CAEF7BD9c1265AadcA78f997AbB9649)
  .latestRoundData() returns (int256 answer, ...);
```

For converting gas spent to USD. Always check `updatedAt` to avoid stale data.

## 8. L2 / scaling

- **Optimistic rollup** (Arbitrum, Optimism, Base): assumes tx is valid, 7-day window for fraud proof.
- **ZK rollup** (zkSync, Linea, Scroll): validity proof on-chain, mathematically instant finality.

ChainNusa deploys contracts to Sepolia (L1 testnet) + Arbitrum Sepolia + Base Sepolia for multi-rollup demo.

## 9. Decentralized storage

- **IPFS**: content-addressed (CID = `bafy...`). No persistence guarantee unless pinned.
- **Pinata / web3.storage**: pinning services. Free tier ~ 1GB.
- **Arweave**: pay once, store permanently. Suitable for archives.

ChainNusa stores analysis JSON on IPFS via Pinata, CID emitted on-chain via `AnalysisRegistry.recordAnalysis`.

## 10. Gas economics

- 1 gas unit = EVM computation unit (ETH transfer = 21000 gas; first SSTORE = 22100).
- Total fee = `gasUsed * gasPrice` (legacy) or `gasUsed * (baseFee + priorityFee)` (EIP-1559).
- ChainNusa calculates `gasSpent` only when wallet = `from`.

## References

- Mastering Ethereum (Antonopoulos & Wood) — open access book.
- EIPs: https://eips.ethereum.org
- Foundry Book: https://book.getfoundry.sh
- OpenZeppelin Contracts docs: https://docs.openzeppelin.com/contracts
