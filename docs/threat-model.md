# Threat Model — ChainNusa

## Cakupan

Threat model berfokus pada 3 lapisan:
1. **Web app** (Next.js) — frontend + API.
2. **ML service** (FastAPI) — internal-only.
3. **Smart contracts** (Solidity) — publik, on-chain.

## STRIDE per komponen

### 1. Web app (`apps/web`)

| Threat | Vector | Mitigasi |
|---|---|---|
| **Spoofing** | Login palsu | SIWE (EIP-4361): server memverifikasi tanda tangan di sisi server, nonce sekali pakai, kedaluwarsa 5 menit |
| **Tampering** | Memalsukan hasil analisis di sisi client | Validasi server-side; cache key = chainId+address+hash payload |
| **Repudiation** | User mengaku tidak pernah memicu analisis | Audit log di tabel Postgres `analysis_runs`; bukti on-chain via SBT |
| **Info disclosure** | Bocornya API key (Etherscan/Anthropic) | Env vars hanya di server; tidak pernah dikirim ke client; aturan ESLint terhadap `process.env.ETHERSCAN_API_KEY` di file `client` |
| **DoS** | Brute-force `/api/analyze` | Rate limit per IP via middleware (Upstash atau in-memory token bucket); cache TTL 1 jam menghindari pengambilan ulang |
| **Elevation of privilege** | XSS melalui ringkasan AI | `MarkdownLite` (subset MD whitelist); React auto-escape; tanpa `dangerouslySetInnerHTML` |

### 2. ML service (`ml-service`)

| Threat | Vector | Mitigasi |
|---|---|---|
| **Spoofing** | Web berpura-pura sebagai panggilan internal | Jaringan internal-only (docker-compose); shared secret header `X-Internal-Token` |
| **Tampering** | Input adversarial untuk menipu classifier | Validasi input: skema Pydantic, pemeriksaan rentang; audit SHAP |
| **Info disclosure** | Artifact model mengandung PII | Tidak ada PII di ruang fitur (hanya alamat on-chain publik); model di registry MLflow privat |
| **DoS** | Banjir request berat `/predict` | Batas konkurensi (uvicorn workers + asyncio semaphore); circuit breaker |
| **Model poisoning** | Penyerang mengunggah data training berbahaya via DVC | Remote DVC = MinIO dengan auth; hanya admin yang dapat mempromosikan ke model registry |

### 3. Smart contracts (`contracts`)

| Threat | Vector | Mitigasi |
|---|---|---|
| **Reentrancy** | Memanggil kontrak eksternal sebelum update state | OpenZeppelin `ReentrancyGuard`; pola checks-effects-interactions |
| **Access control** | Mint SBT tidak sah | Modifier `OwnerOnly`; multi-sig owner di produksi |
| **Integer overflow** | Solidity <0.8 | Solidity 0.8.x default checked math |
| **Gas griefing** | DoS melalui revert di callback | Batas anggaran gas; pola pull-payment |
| **Front-running** | MEV bot menyalin tx | Tidak ada aksi finansial (`recordAnalysis` hanya memancarkan event) — permukaan MEV rendah |
| **Oracle manipulation** | Harga Chainlink basi | Periksa timestamp `updatedAt`; tolak jika > 1 jam |
| **Bypass Soulbound** | Override transfer hook terlewat | Test `_update`/`safeTransferFrom` harus revert; fuzz invariant test |

## Security tooling di CI

- **Slither** (analisis statis untuk Solidity) — gagal pada severity tinggi.
- **Mythril** (symbolic execution, opsional, lebih lambat) — di job nightly.
- **gitleaks** (secret scanning) — gagal jika API key bocor.
- **pip-audit** + **npm audit** — pemeriksaan CVE dependensi.
- **forge test --gas-report** — perlindungan terhadap regresi penggunaan gas.

## Di luar cakupan (disengaja)

- Keamanan konsensus L1 (asumsi: chain valid).
- Phishing UI pengguna (UI adalah demo internal).
- Kerentanan browser wallet (asumsi: MetaMask terpercaya).
- Kripto tahan-kuantum (asumsi: ECDSA aman dalam horizon proyek).

## Kebijakan pengungkapan

Laporan bug → email maintainer (placeholder: `security@chainnusa.example`). Pengungkapan publik 90 hari setelah patch atau pengungkapan terkoordinasi.
