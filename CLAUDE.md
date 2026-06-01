# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Commands

```bash
# Development
pnpm dev                     # Run all services (Next.js dev)
pnpm web:dev                 # Next.js only
pnpm web:build               # Production build
pnpm web:start               # Run production build (port 3000)
pnpm web:typecheck           # TypeScript check (tsc --noEmit)
pnpm web:lint                # ESLint

# Smart Contracts — Foundry
pnpm contracts:build         # Forge build (solc 0.8.24)
pnpm contracts:test          # Forge test -vv
pnpm contracts:slither       # Slither static analysis

# ML Service
pnpm ml:dev                  # FastAPI dev server (port 8000)
pnpm ml:test                 # pytest

# Docker (self-hosted mode)
docker compose up -d
docker compose exec ollama ollama pull qwen2.5:7b
```

> Package manager: `pnpm@10`. Node >=20. Python >=3.11 for ml-service. Smart contracts: Foundry, solc 0.8.24, OpenZeppelin 5.6.1.
>
> **Security**: `docs/internal/` is encrypted via git-crypt. See `docs/GIT_CRYPT.md` for setup.

## Architecture

Monorepo with top-level `docker-compose.yml` (app + Ollama). Main source code in `apps/web/`.

### Provider Adapter Pattern

Data sources and LLMs are selected via env vars, not hardcoded. Both implement the same interface:

- **Data providers** (`src/lib/providers/data/`): `DataProvider` interface in `types.ts` → `EtherscanProvider` (V2 REST API, full native + ERC-20 history) or `RpcProvider` (viem + `eth_getLogs`, ERC-20 only). Selected via `DATA_PROVIDER` env.
- **LLM providers** (`src/lib/providers/llm/`): `LlmProvider` interface in `types.ts` → `ClaudeProvider` (LangChain ChatAnthropic) or `OllamaProvider` (LangChain ChatOllama). Selected via `LLM_PROVIDER` env.

Factory functions (`getDataProvider()` / `getLlmProvider()`) read env and return the correct implementation.

### Data Pipeline

`POST /api/analyze` (`src/app/api/analyze/route.ts`) — the single endpoint:
1. Validate address (regex `0x[a-fA-F0-9]{40}`) + chainId (1/56/137)
2. Check SQLite cache (`readCache`). If fresh (< TTL) → return immediately, regenerate AI summary.
3. If not: `dataProvider.fetchAll()` in parallel → `analyze()` aggregation → `writeCache()` → `llmProvider.generateSummary()` → JSON response.

### Analysis Layer (`src/lib/analyzer.ts`)

The `analyze()` function receives native balance + normal tx + token tx, producing:
- Heuristic categorization: transfer/contract/DEX swap (Uniswap V2/V3 + GMX v2 + dYdX v3)/failed/self
- Aggregation: total native in/out, gas spent, top counterparties, per-token summary, daily histogram
- No network/DB dependencies — pure computation

### Cache (`src/lib/cache.ts` + `src/lib/db.ts`)

SQLite via `better-sqlite3`. Two tables: `analysis_cache` (keyed by `chainId:address`) and `scan_history`. TTL via `CACHE_TTL_SECONDS` env (default 3600s). WAL mode, auto-create DB file.

### Chain Registry (`src/lib/chains.ts`)

Only 3 chains: Ethereum (1), BSC (56), Polygon (137). `ChainConfig` contains name, nativeSymbol, explorerUrl, color. `SUPPORTED_CHAIN_IDS` is the type-level union `1 | 56 | 137`.

### Frontend

- `src/app/page.tsx` — single page, minimal server component
- `src/components/Analyzer.tsx` — main client component (form + results + charts)
- `src/components/Charts.tsx` — Recharts wrappers (daily activity bar chart, category pie chart)
- `src/components/MarkdownLite.tsx` — lightweight markdown renderer for AI output

### Code Conventions

- Path alias `@/*` → `./src/*`
- Next.js 14 App Router, Node runtime (not Edge)
- `output: "standalone"` for Docker deployment
- `better-sqlite3` must be rebuilt as native module (listed in `.pnpm.onlyBuiltDependencies`)
- Environment variables are never bundled client-side (only accessed in server/route handlers)
