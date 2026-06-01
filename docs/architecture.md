# ChainNusa — Arsitektur

## Komponen

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/web (Next.js 14)                        │
│   - Frontend dashboard (Tailwind, Recharts, Lucide)              │
│   - API routes: /api/analyze, /api/ml/*                          │
│   - Wallet sign-in (SIWE), wagmi/viem                            │
│   - Calls Etherscan / RPC + LangChain (Claude/Ollama) + ML svc   │
└─────────────────────────────────────────────────────────────────┘
                │                    │                    │
        ┌───────┘                    │                    └───────┐
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐         ┌─────────────────┐
│  ml-service      │       │  PostgreSQL 16   │         │  Smart Contract │
│  (FastAPI)       │       │  - wallet_features│        │  (Solidity)     │
│  - features/     │◀─────▶│  - analysis_runs │         │  AnalysisRegistry│
│  - models/       │       │  - labels        │         │  ReportSBT       │
│  - etl/          │       └──────────────────┘         │  Foundry tests  │
│  - sklearn/PyTorch│                                   └─────────────────┘
└──────────────────┘                                            │
        │                                                       │
        ▼                                                       ▼
┌──────────────────┐                              ┌──────────────────────┐
│  MinIO / S3      │                              │  IPFS (Pinata)       │
│  - models/       │                              │  - analysis JSON CID │
│  - datasets/     │                              └──────────────────────┘
└──────────────────┘
        │
        ▼
┌──────────────────┐
│  MLflow Tracking │
│  - experiments   │
│  - registry      │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│  Prometheus +    │
│  Grafana         │
└──────────────────┘
```

## Tanggung jawab layanan

| Service | Tech | Responsibility |
|---|---|---|
| `apps/web` | Next.js 14, viem, LangChain | UI + API gateway, wallet auth, memanggil ML svc & kontrak |
| `ml-service` | Python 3.11, FastAPI, sklearn, XGBoost, PyTorch | Ekstraksi fitur, classifier, anomaly, LSTM, SHAP |
| `contracts` | Solidity 0.8, Foundry | Bukti analisis on-chain (registry + soulbound NFT) |
| `infra` | Docker Compose | Postgres + MinIO + MLflow + Prometheus + Grafana |

## Alur data: analisis wallet end-to-end

1. User membuka dashboard → menghubungkan wallet (SIWE) → mengirimkan address + chain.
2. `apps/web` POST ke `/api/analyze`:
   - Mengambil data tx melalui Etherscan atau RPC adapter.
   - Mengagregasi dengan TS analyzer → statistik inti.
   - Memanggil `ml-service /predict` untuk classifier + anomaly score + SHAP.
   - Memanggil LangChain (Claude atau Ollama) untuk ringkasan bahasa alami.
3. Hasil di-cache di SQLite (per chain+address, TTL 1 jam).
4. (Opsional) User klik **"Mint proof"**:
   - JSON analisis di-pin ke IPFS (Pinata) → mengembalikan CID.
   - `apps/web` memanggil `AnalysisRegistry.recordAnalysis(address, cid)` → memancarkan event.
   - Opsional: `ReportSBT.mint(user, cid)` → soulbound NFT (tidak dapat ditransfer, ditandatangani oleh wallet).

## Catatan keputusan

- **Mengapa monorepo?** 3 bahasa berbeda (TS, Python, Solidity) dengan docs + CI bersama. pnpm workspace untuk TS, direktori terpisah untuk non-TS.
- **Mengapa Postgres di samping SQLite?** SQLite tetap untuk cache dev (tanpa setup). Postgres untuk ML pipeline (feature store, label store, run history) — diperlukan setelah dataset >100k baris.
- **Mengapa MinIO bukan S3 langsung?** Development local-first; dapat ditukar ke S3 melalui env var.
- **Mengapa MLflow bukan W&B?** Dapat di-host sendiri, tanpa signup, sesuai tema "open infra".
- **Mengapa Foundry bukan Hardhat?** Test lebih cepat, fuzzing native, file test hanya Solidity (tanpa switch konteks JS).

## Batas kepercayaan

```
[ User Wallet ]──────pesan ditandatangani──────▶[ apps/web /auth ]
                                                          │
                                                          ▼
[ apps/web ]───service token──▶[ ml-service ]   (internal only, tidak diekspos)
[ apps/web ]───public RPC─────▶[ chain ]
[ user wallet ]──tx────▶[ AnalysisRegistry / ReportSBT ]   (gas dibayar user)
```
