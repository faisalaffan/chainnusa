# Belajar Smart Contract ChainNusa

Panduan belajar smart contract ChainNusa dari nol sampai production.

## Sebelum Mulai

Kamu perlu:
- **Solidity dasar** — variable, function, struct, mapping, modifier, event, inheritance
- **Foundry terinstall** — `forge`, `cast`, `anvil` (lihat [Quickstart](internal/tutorial/00-quickstart.md))
- **Git** — repo sudah di-clone, dependencies terinstall (`forge install`)

## Jalur Belajar

Baca berurutan. Setiap langkah bangun konsep dari langkah sebelumnya.

```
1. Quickstart
   └── Setup Foundry, Anvil, build, test, cast dasar
       │
2. Arsitektur Overview
   └── Diagram, 4 kontrak, 2 layer, flow end-to-end
       │
3. AnalysisRegistry  ←────────── Mulai dari sini (paling sederhana)
   └── Struct, mapping, event, recordAnalysis, view functions
       │
4. ReportSBT
   └── ERC-721, soulbound, tokenURI, anti-duplicate, custom errors
       │
5. MultiSigWallet
   └── N-of-M, submit-confirm-execute, checks-effects-interactions, gas optimization
       │
6. MultiSigGovernor
   └── Adapter pattern, immutable, onlyWalletOwner, encodeWithSelector
       │
7. Deploy
   └── Anvil → Sepolia → Mainnet, verifikasi, troubleshooting
```

| # | Dokumen | Kontrak | Konsep Kunci |
|---|---|---|---|
| 1 | [Quickstart](internal/tutorial/00-quickstart.md) 🔒 | — | Foundry, Anvil, forge, cast |
| 2 | [Arsitektur Overview](internal/tutorial/01-contracts-overview.md) 🔒 | Semua | Data layer, governance layer |
| 3 | [Tutorial: AnalysisRegistry](internal/tutorial/tutorial-analysis-registry.md) 🔒 | `AnalysisRegistry.sol` | Struct, mapping, event, view |
| 4 | [Tutorial: ReportSBT](internal/tutorial/tutorial-report-sbt.md) 🔒 | `ReportSBT.sol` | ERC-721, soulbound, tokenURI |
| 5 | [Tutorial: MultiSigWallet](internal/tutorial/tutorial-multisig-wallet.md) 🔒 | `MultiSigWallet.sol` | N-of-M, CEI, gas packing |
| 6 | [Tutorial: MultiSigGovernor](internal/tutorial/tutorial-multisig-governor.md) 🔒 | `MultiSigGovernor.sol` | Adapter, immutable, ABI encode |
| 7 | [Tutorial: Deploy](internal/tutorial/tutorial-deploy.md) 🔒 | Semua | forge script, verify, production |

## Referensi Tambahan

- [Spesifikasi Teknis](internal/SPEC.md) (encrypted, akses terbatas)
- [Threat Model](internal/threat-model.md) (encrypted, akses terbatas)
- [Blockchain 101](internal/blockchain-101.md) — konsep dasar blockchain
- [Git Crypt Setup](GIT_CRYPT.md) — akses dokumen internal

## Kontrak Source Code

```
contracts/src/
├── AnalysisRegistry.sol         # Registry on-chain
├── ReportSBT.sol                # Soulbound token
├── governance/
│   └── MultiSigGovernor.sol     # Governance adapter
└── multisig/
    └── MultiSigWallet.sol       # Multi-sig wallet
```

Tes: `contracts/test/` — unit, fuzz, integration.  
Deploy script: `contracts/script/Deploy.s.sol`, `DeployMultiSig.s.sol`.

## Mulai

Langsung ke [Quickstart →](internal/tutorial/00-quickstart.md)
