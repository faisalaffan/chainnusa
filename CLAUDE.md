# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Perintah Umum

```bash
# Development
pnpm dev                     # Jalankan semua service (Next.js dev)
pnpm web:dev                 # Hanya Next.js
pnpm web:build               # Production build
pnpm web:start               # Jalankan production build (port 3000)
pnpm web:typecheck           # TypeScript check (tsc --noEmit)
pnpm web:lint                # ESLint

# ML Service
pnpm ml:dev                  # FastAPI dev server (port 8000)
pnpm ml:test                 # pytest

# Docker (self-hosted mode)
docker compose up -d
docker compose exec ollama ollama pull qwen2.5:7b
```

> Package manager: `pnpm@10`. Node >=20. Python >=3.11 untuk ml-service.

## Arsitektur

Monorepo dengan top-level `docker-compose.yml` (app + Ollama). Source code utama di `apps/web/`.

### Provider Adapter Pattern

Sumber data dan LLM dipilih via env var, bukan hardcoded. Keduanya menerapkan interface yang sama:

- **Data providers** (`src/lib/providers/data/`): `DataProvider` interface di `types.ts` → `EtherscanProvider` (V2 REST API, full native + ERC-20 history) atau `RpcProvider` (viem + `eth_getLogs`, hanya ERC-20). Dipilih via `DATA_PROVIDER` env.
- **LLM providers** (`src/lib/providers/llm/`): `LlmProvider` interface di `types.ts` → `ClaudeProvider` (LangChain ChatAnthropic) atau `OllamaProvider` (LangChain ChatOllama). Dipilih via `LLM_PROVIDER` env.

Factory function (`getDataProvider()` / `getLlmProvider()`) membaca env dan mengembalikan implementasi yang tepat.

### Pipeline Data

`POST /api/analyze` (`src/app/api/analyze/route.ts`) — satu-satunya endpoint:
1. Validasi address (regex `0x[a-fA-F0-9]{40}`) + chainId (1/56/137)
2. Cek cache SQLite (`readCache`). Jika fresh (< TTL) → return langsung, regenerate AI summary.
3. Jika tidak: `dataProvider.fetchAll()` paralel → `analyze()` aggregation → `writeCache()` → `llmProvider.generateSummary()` → response JSON.

### Layer Analisis (`src/lib/analyzer.ts`)

Fungsi `analyze()` menerima native balance + normal tx + token tx, menghasilkan:
- Kategorisasi heuristic: transfer/contract/DEX swap (methodId Uniswap V2/V3)/failed/self
- Agregasi: total native in/out, gas spent, top counterparties, per-token summary, daily histogram
- Tidak ada dependency network/DB — pure computation

### Cache (`src/lib/cache.ts` + `src/lib/db.ts`)

SQLite via `better-sqlite3`. Dua tabel: `analysis_cache` (keyed by `chainId:address`) dan `scan_history`. TTL via `CACHE_TTL_SECONDS` env (default 3600s). WAL mode, auto-create DB file.

### Chain Registry (`src/lib/chains.ts`)

Hanya 3 chain: Ethereum (1), BSC (56), Polygon (137). `ChainConfig` berisi name, nativeSymbol, explorerUrl, color. `SUPPORTED_CHAIN_IDS` adalah type-level union `1 | 56 | 137`.

### Frontend

- `src/app/page.tsx` — single page, server component minimal
- `src/components/Analyzer.tsx` — main client component (form + results + charts)
- `src/components/Charts.tsx` — Recharts wrappers (daily activity bar chart, category pie chart)
- `src/components/MarkdownLite.tsx` — lightweight markdown renderer untuk AI output

### Konvensi Kode

- Path alias `@/*` → `./src/*`
- Next.js 14 App Router, Node runtime (bukan Edge)
- `output: "standalone"` untuk Docker deployment
- `better-sqlite3` harus di-rebuild native (ada di `.pnpm.onlyBuiltDependencies`)
- Environment variables tidak pernah di-bundle client-side (hanya diakses di server/route handler)
