<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/01_BANNER_DARK.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/02_BANNER_LIGHT.png">
  <img alt="ChainNusa Banner" src="assets/02_BANNER_LIGHT.png">
</picture>

<p align="center">
  <img src="assets/03_LOGO_DARK.png" alt="ChainNusa Logo" width="120">
</p>

<p align="center">
  <a href="README_ID.md">🇮🇩 Bahasa Indonesia</a>
</p>

# ChainNusa — Crypto Wallet Analyzer

> On-chain intelligence platform for Southeast Asia.
> Multi-chain wallet analyzer with AI summary. Powered by **Etherscan V2 + Claude (Anthropic)**.

Input: `wallet address` + `chain` → Output: spending pattern analysis + AI summary in natural language.

---

## Features

- **Pluggable providers (adapter pattern)** — swap data source & LLM via env, no code changes:
  - Data: **Etherscan V2** (hosted, full history) ↔ **Direct JSON-RPC** (self-hosted via viem, ERC-20 only)
  - LLM: **Claude** (hosted, via LangChain) ↔ **Ollama** (local, via LangChain)
- **Multi-chain** — Ethereum, BSC, Polygon (via Etherscan V2 multichain or viem chains).
- **Data pipeline**:
  - Fetch native balance + last 500 tx + last 500 ERC-20 transfers (parallel).
  - Heuristic categorization: transfer / contract / DEX swap (methodId) / failed / self.
  - Aggregation: total in/out, gas spent, top counterparties, token summary, daily activity.
- **LLM orchestration via LangChain** (`ChatPromptTemplate` + `RunnableSequence` + `StringOutputParser`) — anti-hallucination system prompt, structured output.
- **SQLite caching** — previously scanned wallets served from cache (TTL 1 hour, configurable). Force-refresh button in UI.
- **UI** — Next.js 14 + Tailwind + Recharts + Lucide. Dark theme, responsive, real-time provider badge.

---

## Stack

```
Data Source   → Etherscan V2 API  ↔  Direct JSON-RPC (viem + public RPC)
Storage       → SQLite (better-sqlite3) — file-based, zero infra
LLM Layer     → LangChain (ChatAnthropic ↔ ChatOllama)
Backend       → Next.js Route Handlers (Node runtime)
Frontend      → Next.js 14 App Router + Tailwind + Recharts
```

### Provider matrix

| Mode                  | Data         | LLM    | API key needed        | Privacy              |
| --------------------- | ------------ | ------ | --------------------- | -------------------- |
| **Hosted** (default)  | Etherscan V2 | Claude | Etherscan + Anthropic | Third-party data     |
| **Hybrid A**          | Etherscan V2 | Ollama | Etherscan only        | Local LLM            |
| **Hybrid B**          | RPC          | Claude | Anthropic only        | Data via RPC         |
| **Fully self-hosted** | RPC          | Ollama | _none_                | 100% local           |

---

## Setup

### 1. Prerequisites

- Node.js 18.18+ or 20+, pnpm 10+
- API keys based on mode (see table above) — can be _none_ for RPC + Ollama.

### 2. Install

```bash
pnpm install
```

`better-sqlite3` is a native module — requires build tools (Xcode CLT on macOS, build-essential on Linux). pnpm auto-builds via `onlyBuiltDependencies`.

### 3. Configure env

```bash
cp .env.example .env
```

Edit `.env`. Choose combination per the matrix:

```ini
# Default (hosted)
DATA_PROVIDER=etherscan
LLM_PROVIDER=claude
ETHERSCAN_API_KEY=...
ANTHROPIC_API_KEY=...

# or Fully self-hosted
DATA_PROVIDER=rpc
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

### 4. Run

```bash
pnpm dev
```

Open http://localhost:3000 — the badge in the analysis result shows the active provider.

### 5. Production build

```bash
pnpm build && pnpm start
```

---

## Self-Hosted Mode (Ollama + RPC)

### Option A: Docker Compose (recommended)

```bash
cp .env.example .env
# set DATA_PROVIDER=rpc and LLM_PROVIDER=ollama in .env
docker compose up -d

# Pull model in the ollama container:
docker compose exec ollama ollama pull qwen2.5:7b
```

App at `http://localhost:3000`, Ollama at `http://localhost:11434`. Data persisted in `chainnusa-data` & `ollama-models` volumes.

### Option B: Native Ollama install

```bash
# macOS / Linux:
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull qwen2.5:7b   # or llama3.1:8b, mistral, etc.

# in this repo:
# .env -> LLM_PROVIDER=ollama, DATA_PROVIDER=rpc
pnpm dev
```

### Recommended local models

| Model         | Size   | Strengths       | Indonesian        |
| ------------- | ------ | --------------- | ----------------- |
| `qwen2.5:7b`  | ~4.7GB | Fast, balanced  | Good              |
| `llama3.1:8b` | ~4.9GB | Strong reasoning | Decent            |
| `mistral:7b`  | ~4.1GB | Concise         | Adequate          |
| `qwen2.5:14b` | ~9GB   | More accurate   | Very good         |

---

## API

### `POST /api/analyze`

Request:

```json
{
  "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  "chainId": 1,
  "forceRefresh": false
}
```

`chainId`: `1` (Ethereum), `56` (BSC), `137` (Polygon).

Response (200):

```json
{
  "ok": true,
  "cached": false,
  "analysis": {
    "chainId": 1,
    "chainName": "Ethereum Mainnet",
    "nativeSymbol": "ETH",
    "address": "0x...",
    "totals": {
      "nativeBalance": "1.234",
      "nativeIn": "100.5",
      "nativeOut": "98.2",
      "gasSpent": "0.42",
      "txCount": 500,
      "tokenTxCount": 312,
      "failedTxCount": 4,
      "uniqueCounterparties": 87,
      "firstTxAt": 1620000000,
      "lastTxAt": 1759999999,
      "activeDays": 145
    },
    "categories": [{ "category": "dex_swap", "count": 42 }],
    "topCounterparties": [
      { "address": "0x...", "interactions": 12, "isContract": true }
    ],
    "tokens": [
      {
        "symbol": "USDC",
        "totalIn": "1000",
        "totalOut": "500",
        "transferCount": 12
      }
    ],
    "dailyActivity": [
      { "date": "2024-01-01", "txCount": 5, "nativeIn": 0.1, "nativeOut": 0 }
    ],
    "sampleTxs": []
  },
  "aiSummary": "## Summary\n- ..."
}
```

Error (4xx/5xx):

```json
{ "ok": false, "error": "Invalid EVM address ..." }
```

---

## Project Structure

```
apps/web/                           # Next.js 14 App Router
├── src/
│   ├── app/api/analyze/route.ts     # POST endpoint, factory-driven
│   ├── app/api/auth/                # SIWE sign-in (nonce + verify)
│   ├── components/                  # Analyzer, Charts, MarkdownLite
│   └── lib/
│       ├── analyzer.ts              # Aggregation + categorization heuristic
│       ├── chains.ts                # Chain registry (ETH, BSC, Polygon)
│       ├── db.ts                    # SQLite + schema
│       ├── cache.ts                 # Cache & scan history
│       ├── ml-client.ts             # ML service client
│       ├── siwe.ts                  # EIP-4361 auth helpers
│       ├── contracts/               # ABI + write helpers
│       └── providers/               # Adapter pattern: data + llm
├── Dockerfile
└── package.json

ml-service/                          # Python FastAPI
├── app/
│   ├── main.py                      # API entry point
│   ├── routers/                     # /predict, /explain, /cluster
│   ├── models/                      # RF/XGBoost, IsolationForest, LSTM
│   ├── features/extractor.py        # 30+ wallet features
│   └── etl/                         # Extract → Transform → Load
├── notebooks/                       # 8 Jupyter notebooks
├── tests/
├── Dockerfile
└── pyproject.toml

contracts/                           # Solidity (Foundry)
├── src/AnalysisRegistry.sol         # On-chain CID registry
├── src/ReportSBT.sol                # Soulbound NFT
├── test/
├── script/Deploy.s.sol
└── foundry.toml

infra/                               # Docker Compose
├── docker-compose.yml               # PostgreSQL 16, MinIO, MLflow, Prometheus, Grafana
├── prometheus/prometheus.yml
└── grafana/
```

---

## Limitations

### `etherscan` mode

- Only pulls the **last 500 txs** and **last 500 token transfers** per scan to conserve free-tier rate limits (5 req/s).
- DEX swap categorization is based on **known router methodIds** (Uniswap V2/V3 + multicall). Other DEXs may be classified as _contract_interaction_.

### `rpc` mode

- **No native tx history** — JSON-RPC has no "txlist by address" endpoint. Only ERC-20 Transfer events via `eth_getLogs` (indexed by topic).
- Block range limited to the last `RPC_LOG_BLOCK_RANGE` blocks (default 10k ≈ ~1.5 hours on ETH).
- Public RPCs may rate-limit; provider auto-falls back to the next endpoint.

### `ollama` mode

- Latency depends on local hardware. `qwen2.5:7b` on M-series Mac ~5-15 seconds per request.
- Output quality varies by model size — try `qwen2.5:14b` for higher quality.

### General

- AI summary is **heuristic**. Not financial advice.

---

## License

MIT — see `LICENSE`.
