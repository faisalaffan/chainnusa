# Threat Model — ChainNusa

## Scope

Threat model fokus pada 3 lapisan:
1. **Web app** (Next.js) — frontend + API.
2. **ML service** (FastAPI) — internal-only.
3. **Smart contracts** (Solidity) — public, on-chain.

## STRIDE per komponen

### 1. Web app (`apps/web`)

| Threat | Vector | Mitigation |
|---|---|---|
| **Spoofing** | Sign-in palsu | SIWE (EIP-4361): server verify signature server-side, nonce single-use, expiry 5 menit |
| **Tampering** | Forging analysis result client-side | Server-side validation; cache key = chainId+address+payload hash |
| **Repudiation** | User claim tidak pernah trigger analisis | Audit log di Postgres `analysis_runs` table; on-chain proof via SBT |
| **Info disclosure** | API key bocor (Etherscan/Anthropic) | Env vars server-only; tidak pernah ke client; ESLint rule against `process.env.ETHERSCAN_API_KEY` di file `client` |
| **DoS** | Brute-force `/api/analyze` | Rate limit per IP via middleware (Upstash atau in-memory token bucket); cache TTL 1h hindari re-fetch |
| **Elevation of privilege** | XSS lewat AI summary | `MarkdownLite` (whitelist subset MD); React auto-escape; no `dangerouslySetInnerHTML` |

### 2. ML service (`ml-service`)

| Threat | Vector | Mitigation |
|---|---|---|
| **Spoofing** | Web pretend internal call | Internal-only network (docker-compose); shared secret header `X-Internal-Token` |
| **Tampering** | Adversarial input untuk fool classifier | Input validation: Pydantic schema, range check; SHAP audit |
| **Info disclosure** | Model artifact contains PII | Tidak ada PII di feature space (hanya alamat publik on-chain); model di MLflow registry private |
| **DoS** | Heavy `/predict` request flood | Concurrency limit (uvicorn workers + asyncio semaphore); circuit breaker |
| **Model poisoning** | Attacker upload bad training data via DVC | DVC remote = MinIO with auth; model registry hanya admin promote |

### 3. Smart contracts (`contracts`)

| Threat | Vector | Mitigation |
|---|---|---|
| **Reentrancy** | Calling external contract before state update | OpenZeppelin `ReentrancyGuard`; checks-effects-interactions pattern |
| **Access control** | Unauthorized mint of SBT | `OwnerOnly` modifier; multi-sig owner di production |
| **Integer overflow** | Solidity <0.8 | Solidity 0.8.x default checked math |
| **Gas griefing** | DoS via revert in callback | Gas budget caps; pull-payment pattern |
| **Front-running** | MEV bot copy tx | Tidak ada financial action (recordAnalysis hanya emit event) — low MEV surface |
| **Oracle manipulation** | Stale Chainlink price | Check `updatedAt` timestamp; reject if > 1 hour old |
| **Soulbound bypass** | Override transfer hook missed | Test `_update`/`safeTransferFrom` should revert; fuzz invariant tests |

## Security tooling di CI

- **Slither** (static analysis Solidity) — fail di high severity.
- **Mythril** (symbolic execution, opsional, slower) — di nightly job.
- **gitleaks** (scan secret) — fail kalau API key kebobolan.
- **pip-audit** + **npm audit** — dependency CVE check.
- **forge test --gas-report** — guard regression gas usage.

## Out-of-scope (intentional)

- L1 consensus security (asumsi: chain valid).
- Phishing user UI (UI is internal demo).
- Browser wallet vulnerabilities (asumsi MetaMask trusted).
- Quantum-resistant crypto (asumsi ECDSA aman dalam horizon proyek).

## Disclosure policy

Bug report → email maintainer (placeholder: `security@chainnusa.example`). Public disclosure 90 hari setelah patch atau coordinated disclosure.
