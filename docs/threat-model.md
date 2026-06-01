# Threat Model — ChainNusa

## Scope

Threat model focused on 3 layers:
1. **Web app** (Next.js) — frontend + API.
2. **ML service** (FastAPI) — internal-only.
3. **Smart contracts** (Solidity) — public, on-chain.

## STRIDE per component

### 1. Web app (`apps/web`)

| Threat | Vector | Mitigation |
|---|---|---|
| **Spoofing** | Fake sign-in | SIWE (EIP-4361): server verifies signature server-side, single-use nonce, 5-minute expiry |
| **Tampering** | Forging analysis result client-side | Server-side validation; cache key = chainId+address+payload hash |
| **Repudiation** | User claims they never triggered analysis | Audit log in Postgres `analysis_runs` table; on-chain proof via SBT |
| **Info disclosure** | Leaked API keys (Etherscan/Anthropic) | Env vars server-only; never sent to client; ESLint rule against `process.env.ETHERSCAN_API_KEY` in `client` files |
| **DoS** | Brute-force `/api/analyze` | Rate limit per IP via middleware (Upstash or in-memory token bucket); 1h cache TTL avoids re-fetch |
| **Elevation of privilege** | XSS via AI summary | `MarkdownLite` (whitelist MD subset); React auto-escape; no `dangerouslySetInnerHTML` |

### 2. ML service (`ml-service`)

| Threat | Vector | Mitigation |
|---|---|---|
| **Spoofing** | Web pretends to be internal call | Internal-only network (docker-compose); shared secret header `X-Internal-Token` |
| **Tampering** | Adversarial input to fool classifier | Input validation: Pydantic schema, range check; SHAP audit |
| **Info disclosure** | Model artifact contains PII | No PII in feature space (only public on-chain addresses); models in private MLflow registry |
| **DoS** | Heavy `/predict` request flood | Concurrency limit (uvicorn workers + asyncio semaphore); circuit breaker |
| **Model poisoning** | Attacker uploads bad training data via DVC | DVC remote = MinIO with auth; only admin can promote to model registry |

### 3. Smart contracts (`contracts`)

| Threat | Vector | Mitigation |
|---|---|---|
| **Reentrancy** | Calling external contract before state update | OpenZeppelin `ReentrancyGuard`; checks-effects-interactions pattern |
| **Access control** | Unauthorized mint of SBT | `OwnerOnly` modifier; multi-sig owner in production |
| **Integer overflow** | Solidity <0.8 | Solidity 0.8.x default checked math |
| **Gas griefing** | DoS via revert in callback | Gas budget caps; pull-payment pattern |
| **Front-running** | MEV bot copies tx | No financial action (`recordAnalysis` only emits event) — low MEV surface |
| **Oracle manipulation** | Stale Chainlink price | Check `updatedAt` timestamp; reject if > 1 hour old |
| **Soulbound bypass** | Override transfer hook missed | Test `_update`/`safeTransferFrom` should revert; fuzz invariant tests |

## Security tooling in CI

- **Slither** (static analysis for Solidity) — fail on high severity.
- **Mythril** (symbolic execution, optional, slower) — in nightly job.
- **gitleaks** (secret scanning) — fail if API key leaked.
- **pip-audit** + **npm audit** — dependency CVE check.
- **forge test --gas-report** — guard against gas usage regression.

## Out-of-scope (intentional)

- L1 consensus security (assumption: chain is valid).
- Phishing of user UI (UI is internal demo).
- Browser wallet vulnerabilities (assumption: MetaMask trusted).
- Quantum-resistant crypto (assumption: ECDSA secure within project horizon).

## Disclosure policy

Bug report → email maintainer (placeholder: `security@chainnusa.example`). Public disclosure 90 days after patch or coordinated disclosure.
