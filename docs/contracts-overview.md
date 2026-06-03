# ChainNusa Smart Contracts — Overview

Arsitektur smart contract ChainNusa terdiri dari 4 kontrak yang bekerja dalam 2 layer: **Data Layer** (on-chain proof) dan **Governance Layer** (multi-sig kontrol).

## Diagram Arsitektur

```
┌─────────────────────────────────────────────────┐
│                  GOVERNANCE LAYER               │
│                                                 │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │ MultiSigWallet   │◄──│ MultiSigGovernor   │  │
│  │ (N-of-M wallet)  │   │ (Proposal router)  │  │
│  └────────┬─────────┘   └────────┬───────────┘  │
│           │ owner_of              │ submits      │
│           ▼                       ▼              │
├─────────────────────────────────────────────────┤
│                    DATA LAYER                    │
│                                                 │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │ AnalysisRegistry │   │ ReportSBT          │  │
│  │ (Record storage) │   │ (Soulbound NFT)    │  │
│  └──────────────────┘   └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Daftar Contract

| Contract | File | Role |
|---|---|---|
| `AnalysisRegistry` | `src/AnalysisRegistry.sol` | Registry on-chain untuk hasil analisis wallet |
| `ReportSBT` | `src/ReportSBT.sol` | Soulbound Token (NFT non-transferable) sebagai bukti analisis |
| `MultiSigWallet` | `src/multisig/MultiSigWallet.sol` | Wallet multi-signature N-of-M |
| `MultiSigGovernor` | `src/governance/MultiSigGovernor.sol` | Adapter governance — route proposal ke ChainNusa contracts |

## Dependencies

```
ReportSBT ──── OpenZeppelin ERC721, Ownable
AnalysisRegistry ──── OpenZeppelin Ownable
MultiSigWallet ──── (standalone, no deps)
MultiSigGovernor ──── MultiSigWallet, AnalysisRegistry, ReportSBT
```

## Flow End-to-End

### 1. Analisis Wallet → On-Chain Proof

```
User / Frontend
     │
     ▼
AnalysisRegistry.recordAnalysis(cidBytes, chainId, walletAddress)
     │
     ├── Simpan record: {cidBytes, timestamp, chainId, indexedWallet, analyst}
     ├── Emit AnalysisRecorded event
     └── Return analysisId
     │
     ▼
ReportSBT.mint(walletAddress, analysisId, cidBytes)
     │
     ├── Mint ERC-721 token (soulbound — tidak bisa transfer)
     ├── Emit ReportMinted event
     └── Return tokenId
```

### 2. Governance Flow (production)

```
MultiSig Owner
     │
     ▼
MultiSigGovernor.proposeRecordAnalysis(...)
     │
     ▼
MultiSigWallet.submitTransaction(...)
     │
     ▼
MultiSig Owners confirm (N of M)
     │
     ▼
MultiSigWallet.executeTransaction(...)
     │
     ▼
AnalysisRegistry.recordAnalysis(...) / ReportSBT.mint(...)
```

## Struktur Direktori

```
contracts/
├── src/
│   ├── AnalysisRegistry.sol      # Registry kontrak
│   ├── ReportSBT.sol             # Soulbound token
│   ├── governance/
│   │   └── MultiSigGovernor.sol  # Governance adapter
│   └── multisig/
│       └── MultiSigWallet.sol    # Multi-sig wallet
├── script/
│   ├── Deploy.s.sol              # Deploy AnalysisRegistry + ReportSBT
│   └── DeployMultiSig.s.sol      # Deploy MultiSigWallet + Governor
├── test/
│   ├── AnalysisRegistry.t.sol
│   ├── ReportSBT.t.sol
│   ├── governance/
│   │   ├── MultiSigGovernor.t.sol
│   │   └── MultiSigGovernor.integration.t.sol
│   └── multisig/
│       ├── MultiSigWallet.t.sol
│       └── MultiSigWallet.fuzz.t.sol
├── foundry.toml                  # Konfigurasi Foundry (solc, evm, rpc)
└── lib/                          # Dependencies (OpenZeppelin, forge-std)
```

## Tech Stack

| Item | Value |
|---|---|
| Compiler | Solidity 0.8.24 |
| EVM Target | Cancun |
| Framework | Foundry (forge) |
| Dependencies | OpenZeppelin 5.6.1 (ERC-721, Ownable) |
| Test | forge test (unit + fuzz + integration) |
| Deploy | forge script (Deploy.s.sol, DeployMultiSig.s.sol) |
