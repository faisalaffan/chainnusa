# ChainNusa — Architecture

## Components

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

## Service responsibilities

| Service | Tech | Responsibility |
|---|---|---|
| `apps/web` | Next.js 14, viem, LangChain | UI + API gateway, wallet auth, calls ML svc & contracts |
| `ml-service` | Python 3.11, FastAPI, sklearn, XGBoost, PyTorch | Feature extraction, classifier, anomaly, LSTM, SHAP |
| `contracts` | Solidity 0.8, Foundry | On-chain proof of analysis (registry + soulbound NFT) |
| `infra` | Docker Compose | Postgres + MinIO + MLflow + Prometheus + Grafana |

## Data flow: end-to-end wallet analysis

1. User opens dashboard → connects wallet (SIWE) → submits address + chain.
2. `apps/web` POSTs `/api/analyze`:
   - Fetches tx data via Etherscan or RPC adapter.
   - Aggregates with TS analyzer → core stats.
   - Calls `ml-service /predict` for classifier + anomaly score + SHAP.
   - Calls LangChain (Claude or Ollama) for natural language summary.
3. Result cached in SQLite (per chain+address, TTL 1h).
4. (Optional) User clicks **"Mint proof"**:
   - JSON of the analysis pinned to IPFS (Pinata) → returns CID.
   - `apps/web` calls `AnalysisRegistry.recordAnalysis(address, cid)` → emits event.
   - Optional: `ReportSBT.mint(user, cid)` → soulbound NFT (transferless, signed by wallet).

## Decision log

- **Why monorepo?** 3 distinct languages (TS, Python, Solidity) with shared docs + CI. pnpm workspace for TS, separate dirs for non-TS.
- **Why Postgres alongside SQLite?** SQLite stays for dev cache (no setup). Postgres is for ML pipeline (feature store, label store, run history) — needed once dataset >100k rows.
- **Why MinIO not raw S3?** Local-first dev; can be swapped to S3 by env var.
- **Why MLflow not W&B?** Self-hostable, no signup, fits the "open infra" theme.
- **Why Foundry not Hardhat?** Faster tests, native fuzzing, Solidity-only test files (no JS context switch).

## Trust boundaries

```
[ User Wallet ]──────signed message──────▶[ apps/web /auth ]
                                                  │
                                                  ▼
[ apps/web ]───service token──▶[ ml-service ]   (internal only, not exposed)
[ apps/web ]───public RPC─────▶[ chain ]
[ user wallet ]──tx────▶[ AnalysisRegistry / ReportSBT ]   (gas paid by user)
```
