# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting a Vulnerability

**Do NOT open a public issue for vulnerabilities.**

Send reports to: **faisalaffan@proton.me**

Response time targets:
- Acknowledgment: 48 hours
- Initial assessment: 5 business days
- Fix release: depends on severity (7–30 days)

### Scope

In-scope vulnerabilities:
- Smart contract reentrancy, overflow, access control bypass
- Private key or API key leaks in codebase/CI logs
- SQL injection, XSS, SSRF in the web app
- RCE in the ML service

Out of scope:
- Missing HTTP security headers (low severity)
- Rate limiting (enhancement)
- Non-EOL dependency versions

## Smart Contract Security

Contracts in `contracts/src/` follow these practices:

- Solidity ^0.8.24 — built-in overflow protection
- CEI (Checks-Effects-Interactions) pattern for all external calls
- Custom errors for gas efficiency
- OpenZeppelin contracts for standard components (ERC-721, Ownable)

### Audit Status

Slither static analysis runs via CI (`pnpm contracts:slither`).

## Disclosure Policy

1. Reporter submits a report
2. Maintainer acknowledges within 48 hours
3. Fix is developed in a private branch
4. Coordinated disclosure: patch release + advisory
5. Credit given in release notes (unless reporter chooses anonymity)
