# Blockchain 101 — untuk ChainNusa

Singkat dan praktis. Untuk teori mendalam, lihat referensi di bagian akhir.

## 1. Chain yang kompatibel dengan EVM

| Chain | ID | Block time | Native | Use case |
|---|---|---|---|---|
| Ethereum | 1 | ~12s | ETH | DeFi blue chips, settlement |
| BNB Smart Chain | 56 | ~3s | BNB | Retail volume tinggi |
| Polygon PoS | 137 | ~2s | MATIC | NFT, gaming |
| Arbitrum One | 42161 | ~250ms | ETH | L2 rollup, biaya rendah |
| Base | 8453 | ~2s | ETH | Coinbase L2 |
| Optimism | 10 | ~2s | ETH | OP-stack rollup |

ChainNusa hanya menggunakan EVM — semua transaksi kompatibel ABI, hanya berbeda pada `chainId` + RPC.

## 2. Tipe akun

- **EOA (Externally Owned Account)** — dikendalikan oleh private key. Wallet user biasa.
- **Contract Account** — bytecode, dipanggil melalui tx. Tidak dapat memulai tx sendiri.

ChainNusa membedakan EOA vs kontrak melalui heuristik: jika `tx.input` tidak kosong atau address memiliki bytecode (`eth_getCode`), counterparty = kontrak.

## 3. Anatomi transaksi

```
{ from, to, value, data (input), gas, gasPrice, nonce, hash, blockNumber }
```

- `value` = jumlah native (wei, 1 ETH = 1e18 wei).
- `data` (atau `input`) = function selector (4 bytes) + argumen yang di-encode ABI.
- `methodId` = 4 byte pertama dari `keccak256(signature)`. Contoh: `0x38ed1739` = `swapExactTokensForTokens`. ChainNusa menggunakan ini untuk klasifikasi kasar.

## 4. Event Transfer ERC-20

```
event Transfer(address indexed from, address indexed to, uint256 value);
keccak256 → 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

Karena `from` & `to` di-index, mereka dapat difilter melalui topic 1/2 `eth_getLogs`. Itulah mengapa `RpcProvider` (`apps/web/src/lib/providers/data/rpc.ts`) tidak memerlukan Etherscan untuk riwayat token.

## 5. Kriptografi untuk auth wallet (SIWE)

Sign-in with Ethereum (EIP-4361):

1. Server menghasilkan nonce + domain.
2. Client membuat pesan yang dapat dibaca manusia → wallet menandatangani via `personal_sign`.
3. Server memverifikasi tanda tangan menggunakan `ecrecover` → mendapatkan address → mencocokkan dengan klaim.

Sumber kebenaran: Alamat Ethereum = 160 bit rendah dari `keccak256(public_key)`.

## 6. Soulbound Token (SBT)

NFT (ERC-721) yang **tidak dapat ditransfer**. Implementasi: override `_update` / `_beforeTokenTransfer` di OpenZeppelin v5 untuk revert kecuali mint/burn. Cocok untuk **laporan identitas / kredensial** yang tidak boleh diperjualbelikan.

ChainNusa menggunakan SBT untuk: "wallet `0xabc...` memiliki laporan analisis dengan IPFS CID X di blok N." Bukti permanen, tidak dapat dibalik.

## 7. Oracle (Chainlink Price Feed)

```solidity
AggregatorV3Interface(0x5147eA642CAEF7BD9c1265AadcA78f997AbB9649)
  .latestRoundData() returns (int256 answer, ...);
```

Untuk mengonversi gas yang digunakan ke USD. Selalu periksa `updatedAt` untuk menghindari data basi.

## 8. L2 / scaling

- **Optimistic rollup** (Arbitrum, Optimism, Base): mengasumsikan tx valid, jendela 7 hari untuk fraud proof.
- **ZK rollup** (zkSync, Linea, Scroll): bukti validitas on-chain, finalitas instan secara matematis.

ChainNusa menyebarkan kontrak ke Sepolia (L1 testnet) + Arbitrum Sepolia + Base Sepolia untuk demonstrasi multi-rollup.

## 9. Penyimpanan terdesentralisasi

- **IPFS**: content-addressed (CID = `bafy...`). Tidak ada jaminan persistensi kecuali di-pin.
- **Pinata / web3.storage**: layanan pinning. Tier gratis ~ 1GB.
- **Arweave**: bayar sekali, simpan permanen. Cocok untuk arsip.

ChainNusa menyimpan JSON analisis di IPFS via Pinata, CID dipancarkan on-chain melalui `AnalysisRegistry.recordAnalysis`.

## 10. Ekonomi gas

- 1 unit gas = unit komputasi EVM (transfer ETH = 21000 gas; SSTORE pertama = 22100).
- Total biaya = `gasUsed * gasPrice` (legacy) atau `gasUsed * (baseFee + priorityFee)` (EIP-1559).
- ChainNusa menghitung `gasSpent` hanya jika wallet = `from`.

## Referensi

- Mastering Ethereum (Antonopoulos & Wood) — buku akses terbuka.
- EIPs: https://eips.ethereum.org
- Foundry Book: https://book.getfoundry.sh
- OpenZeppelin Contracts docs: https://docs.openzeppelin.com/contracts
