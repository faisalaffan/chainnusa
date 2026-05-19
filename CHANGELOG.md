# Changelog

Semua perubahan signifikan di project ini didokumentasikan di sini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/),
dan project ini menggunakan [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05

### Added
- MultiSigWallet smart contract — N-of-M wallet dengan submit/approve/revoke/execute
- MultiSigGovernor — adapter governance untuk AnalysisRegistry & ReportSBT
- ERC-20 token support via multi-sig
- Fuzz testing (1100 runs) untuk semua fungsi multi-sig
- Deploy script untuk Arbitrum Sepolia
- GitHub CI: Forge tests, Slither static analysis, Docker build

### Changed
- Arsitektur kontrak modular — MultiSigWallet + MultiSigGovernor terpisah
- Root Dockerfile untuk GHCR deployment

### Fixed
- pnpm@10 pin di Dockerfile (sebelumnya corepack auto-download v11)
- `forge install` CI — remove `--no-commit` flag
- ReportSBT OpenZeppelin v5 compatibility (ERC721Burnable)

## [0.1.0] — 2025

### Added
- Multi-chain wallet analyzer (Ethereum, BSC, Polygon)
- Pluggable provider adapter: Etherscan V2 + JSON-RPC
- LLM integration: Claude (LangChain) + Ollama
- SQLite caching dengan TTL
- Next.js 14 frontend (App Router, Tailwind, Recharts)
- Heuristic transaction categorization (transfer, DEX swap, contract, failed, self)
- AnalysisRegistry + ReportSBT smart contracts
- Docker Compose untuk self-hosted (app + Ollama)
