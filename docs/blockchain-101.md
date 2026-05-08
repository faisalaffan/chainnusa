# Blockchain 101 — for ChainNusa

Singkat dan praktis. Untuk teori mendalam, lihat referensi di akhir.

## 1. EVM-compatible chains

| Chain | ID | Block time | Native | Use case |
|---|---|---|---|---|
| Ethereum | 1 | ~12s | ETH | DeFi blue chips, settlement |
| BNB Smart Chain | 56 | ~3s | BNB | High-volume retail |
| Polygon PoS | 137 | ~2s | MATIC | NFT, gaming |
| Arbitrum One | 42161 | ~250ms | ETH | L2 rollup, low fee |
| Base | 8453 | ~2s | ETH | Coinbase L2 |
| Optimism | 10 | ~2s | ETH | OP-stack rollup |

ChainNusa pakai EVM only — semua transaksi compatible dengan ABI yang sama, beda hanya `chainId` + RPC.

## 2. Account types

- **EOA (Externally Owned Account)** — dimiliki via private key. User wallet biasa.
- **Contract Account** — bytecode, dipanggil via tx. Tidak bisa initiate tx sendiri.

ChainNusa membedakan EOA vs contract via heuristic: bila `tx.input` non-empty atau alamat punya bytecode (`eth_getCode`), counterparty = contract.

## 3. Transaction anatomy

```
{ from, to, value, data (input), gas, gasPrice, nonce, hash, blockNumber }
```

- `value` = native amount (wei, 1 ETH = 1e18 wei).
- `data` (atau `input`) = function selector (4 byte) + ABI-encoded args.
- `methodId` = first 4 bytes of `keccak256(signature)`. Contoh `0x38ed1739` = `swapExactTokensForTokens`. ChainNusa gunakan ini untuk klasifikasi kasar.

## 4. ERC-20 Transfer event

```
event Transfer(address indexed from, address indexed to, uint256 value);
keccak256 → 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

Karena `from` & `to` indexed, bisa di-filter via `eth_getLogs` topic 1/2. Itulah mengapa `RpcProvider` (`apps/web/src/lib/providers/data/rpc.ts`) tidak butuh Etherscan untuk ambil token history.

## 5. Cryptography untuk wallet auth (SIWE)

Sign-in with Ethereum (EIP-4361):

1. Server generate nonce + domain.
2. Client build human-readable message → wallet sign via `personal_sign`.
3. Server verify signature pakai `ecrecover` → dapat alamat → cocokkan dengan claim.

Sumber kebenaran: alamat Ethereum = lower-160-bit dari `keccak256(public_key)`.

## 6. Soulbound Token (SBT)

NFT (ERC-721) yang **non-transferable**. Implementasi: override `_update` / `_beforeTokenTransfer` di OpenZeppelin v5 untuk revert kecuali mint/burn. Cocok untuk **report identitas / kredensial** yang seharusnya tidak diperjualbelikan.

ChainNusa pakai SBT untuk: "wallet `0xabc...` punya laporan analisis dengan CID IPFS X di blok N." Bukti permanen, tidak bisa di-flip.

## 7. Oracle (Chainlink Price Feed)

```solidity
AggregatorV3Interface(0x5147eA642CAEF7BD9c1265AadcA78f997AbB9649)
  .latestRoundData() returns (int256 answer, ...);
```

Untuk konversi gas spent ke USD. Always check `updatedAt` agar tidak pakai data stale.

## 8. L2 / scaling

- **Optimistic rollup** (Arbitrum, Optimism, Base): asumsi tx valid, ada window 7 hari untuk fraud proof.
- **ZK rollup** (zkSync, Linea, Scroll): validity proof on-chain, finalitas instan secara matematis.

ChainNusa deploy contract ke Sepolia (L1 testnet) + Arbitrum Sepolia + Base Sepolia untuk demo multi-rollup.

## 9. Decentralized storage

- **IPFS**: content-addressed (CID = `bafy...`). Tidak garantee persistence kecuali di-pin.
- **Pinata / web3.storage**: layanan pinning. Free tier ~ 1GB.
- **Arweave**: bayar sekali, simpan permanen. Cocok untuk archive.

ChainNusa simpan analysis JSON di IPFS lewat Pinata, CID di-emit on-chain via `AnalysisRegistry.recordAnalysis`.

## 10. Gas economics

- 1 gas unit = unit komputasi EVM (transfer ETH = 21000 gas; SSTORE pertama = 22100).
- Total fee = `gasUsed * gasPrice` (legacy) atau `gasUsed * (baseFee + priorityFee)` (EIP-1559).
- ChainNusa hitung `gasSpent` hanya saat wallet = `from`.

## Referensi

- Mastering Ethereum (Antonopoulos & Wood) — buku open access.
- EIPs: https://eips.ethereum.org
- Foundry Book: https://book.getfoundry.sh
- OpenZeppelin Contracts docs: https://docs.openzeppelin.com/contracts
