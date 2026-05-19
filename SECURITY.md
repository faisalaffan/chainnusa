# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting a Vulnerability

**JANGAN buat issue publik untuk vulnerability.**

Kirim laporan ke: **faisalaffan@proton.me**

Response time target:
- Acknowledgment: 48 jam
- Initial assessment: 5 hari kerja
- Fix release: tergantung severity (7-30 hari)

### Scope

Yang termasuk vulnerability:
- Smart contract reentrancy, overflow, access control bypass
- Private key atau API key leak di codebase/CI logs
- SQL injection, XSS, SSRF di web app
- RCE di ML service

Yang bukan vulnerability:
- Missing HTTP security headers (low severity)
- Rate limiting (enhancement)
- Dependency versions yang tidak EOL

## Smart Contract Security

Kontrak di `contracts/src/` mengikuti praktik berikut:

- Solidity ^0.8.24 — built-in overflow protection
- CEI (Checks-Effects-Interactions) pattern untuk semua eksternal call
- Custom errors untuk gas efficiency
- OpenZeppelin contracts untuk standar komponen (ERC-721, Ownable)

### Audit Status

Slither static analysis dijalankan via CI (`pnpm contracts:slither`).

## Disclosure Policy

1. Reporter mengirim laporan
2. Maintainer acknowledge dalam 48 jam
3. Fix dikembangkan di private branch
4. Coordinated disclosure: patch release + advisory
5. Credit diberikan di release notes (kecuali reporter memilih anonim)
