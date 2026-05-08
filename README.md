# ChainNusa — Crypto Wallet Analyzer

> Southeast Asia's on-chain intelligence platform.
> Multi-chain wallet analyzer dengan AI summary. Powered by **Etherscan V2 + Claude (Anthropic)**.

Input: `wallet address` + `chain` → Output: spending pattern analysis + AI summary natural language (Bahasa Indonesia).

---

## ✨ Fitur

- **Multi-chain (50+ via Etherscan V2)** — saat ini diaktifkan: Ethereum, BNB Smart Chain, Polygon. 1 API key untuk semua chain.
- **Pipeline data lengkap**:
  - Fetch native balance + last 500 normal tx + last 500 ERC-20 transfers (paralel).
  - Heuristic categorization: native transfer in/out, contract interaction, DEX swap (via methodId), token transfer, failed, self.
  - Aggregation: total in/out, gas spent, top counterparties, token-level summary, daily activity.
- **AI Layer (Claude)** — summary terstruktur (Ringkasan, Pola Aktivitas, Token & Counterparty, Indikator Perilaku) dengan instruksi anti-halusinasi.
- **Caching SQLite** — wallet yang sudah pernah di-scan dilayani dari cache (TTL 1 jam, configurable). Tombol _force refresh_ di UI.
- **UI modern** — Next.js 14 (App Router) + Tailwind + Recharts + Lucide. Dark theme, responsive.

---

## 🧱 Stack

```
Data Source   → Etherscan V2 multichain API (free, single key)
Storage       → SQLite (better-sqlite3) — file-based, zero infra
AI Layer      → Claude (Anthropic SDK)
Backend       → Next.js Route Handlers (Node runtime)
Frontend      → Next.js 14 App Router + Tailwind + Recharts
```

---

## 🚀 Setup

### 1. Prasyarat

- Node.js 18.18+ atau 20+
- 2 API key:
  - **Etherscan API key** — https://etherscan.io/myapikey (gratis, support multichain V2)
  - **Anthropic API key** — https://console.anthropic.com/

### 2. Install

```bash
npm install
```

> Catatan: `better-sqlite3` adalah native module, butuh build tools (Xcode CLT di macOS, build-essential di Linux).

### 3. Konfigurasi env

```bash
cp .env.example .env
```

Isi `.env`:

```
ETHERSCAN_API_KEY=...
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-3-5-sonnet-latest   # opsional
SQLITE_PATH=./data/chainnusa.db          # opsional
CACHE_TTL_SECONDS=3600                   # opsional, 1 jam
```

### 4. Jalankan

```bash
npm run dev
```

Buka http://localhost:3000

### 5. Production build

```bash
npm run build
npm start
```

---

## 🔌 API

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
  "aiSummary": "## Ringkasan\n- ..."
}
```

Error (4xx/5xx):

```json
{ "ok": false, "error": "Invalid EVM address ..." }
```

---

## 🏗️ Struktur Proyek

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # 1 halaman UI
│   ├── globals.css
│   └── api/analyze/route.ts      # POST endpoint
├── components/
│   ├── Analyzer.tsx              # main client component (form + results)
│   ├── Charts.tsx                # recharts wrappers
│   └── MarkdownLite.tsx          # tiny MD renderer untuk AI output
└── lib/
    ├── chains.ts                 # chain registry
    ├── etherscan.ts              # V2 multichain API client
    ├── analyzer.ts               # aggregation + categorization heuristic
    ├── claude.ts                 # Anthropic SDK wrapper + system prompt
    ├── db.ts                     # SQLite + schema
    ├── cache.ts                  # cache & scan history
    └── format.ts                 # display helpers
```

---

## 🎯 Mapping Domain (untuk portfolio narrative)

| Domain          | Bukti                                                                |
| --------------- | -------------------------------------------------------------------- |
| Web3/Blockchain | Decode tx (methodId DEX router), ERC-20 token transfer parsing       |
| Data Engineer   | Fetch → normalize → aggregate → store pipeline + caching layer       |
| AI Engineer     | LLM summarization dengan structured prompt + anti-halusinasi rules   |
| Backend         | REST endpoint validated, error handling, paralel fetch, multi-tenant |

---

## ⚠️ Limitasi yang Diketahui

- Hanya menarik **last 500 tx** dan **last 500 token transfer** per scan untuk hemat rate-limit Etherscan free tier (5 req/s). Untuk wallet super aktif, sample mungkin tidak lengkap.
- Kategorisasi DEX swap berbasis **methodId router yang dikenal** (Uniswap V2/V3 + multicall). DEX lain bisa terklasifikasi sebagai _contract_interaction_.
- Native balance saja yang ditampilkan; saldo per ERC-20 token tidak di-fetch on-chain (hanya agregasi flow dari tx history).
- AI summary bersifat **heuristik**. Bukan financial advice.

---

## 🛣️ Roadmap

- [ ] Fetch internal tx (untuk akurasi gas & smart contract interaction)
- [ ] Label kontrak terkenal (Uniswap, Aave, dll) via Etherscan tag API
- [ ] Export PDF/CSV
- [ ] Multi-wallet comparison
- [ ] Streaming AI response (SSE)

---

## 📜 License

MIT — lihat `LICENSE`.
