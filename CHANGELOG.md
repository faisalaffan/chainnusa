# Changelog

All significant changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05

### Added
- MultiSigWallet smart contract — N-of-M wallet with submit/approve/revoke/execute
- MultiSigGovernor — governance adapter for AnalysisRegistry & ReportSBT
- ERC-20 token support via multi-sig
- Fuzz testing (1100 runs) for all multi-sig functions
- Deploy script for Arbitrum Sepolia
- GitHub CI: Forge tests, Slither static analysis, Docker build
- Hardhat dual-build support alongside Foundry
- GMX v2 and dYdX v3 protocol detection in wallet analyzer
- Dual build system: Foundry + Hardhat, solc 0.8.24, OpenZeppelin 5.6.1

### Changed
- Modular contract architecture — MultiSigWallet + MultiSigGovernor separated
- Root Dockerfile for GHCR deployment
