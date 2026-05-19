# Product Requirements Document
# Multi-Signature Wallet — Cross-Chain (EVM + Solana)

**Version:** 1.0.0
**Status:** Draft
**Author:** Faisal Affan
**Last Updated:** 2026-05-19

---

## 1. Overview

### 1.1 Product Summary

Multi-signature wallet smart contract yang membutuhkan persetujuan dari minimal N dari M owner sebelum transaksi dieksekusi. Dibangun dengan arsitektur **modular** (Pendekatan B) — kontrak mandiri MultiSigWallet + MultiSigGovernor adapter ke kontrak ChainNusa existing (AnalysisRegistry, ReportSBT). Dibangun sebagai portfolio project dengan production-grade quality: full test coverage, security audit, dan frontend yang dapat digunakan langsung.

### 1.2 Goals

- Demonstrasi kemampuan Solidity dan Rust smart contract development
- Production-ready codebase yang dapat dipresentasikan ke recruiter atau klien
- Arsitektur modular: MultiSigWallet (standalone) + MultiSigGovernor (governance untuk AnalysisRegistry & ReportSBT)
- Test coverage minimal 95% dengan forge test (EVM) dan solana-test-validator (Solana)
- Integrasi penuh dengan ChainNusa analytics platform yang sudah ada

### 1.3 Non-Goals

- Tidak mendukung token ERC-1155 pada versi pertama
- Tidak ada mekanisme dispute atau arbitrasi
- Tidak ada mobile app (web only)
- Tidak ada support multi-chain dalam satu deployment

---

## 2. Architecture — Pendekatan B (Modular)

### 2.1 Kenapa Modular?

Proyek ChainNusa sudah memiliki smart contract (`AnalysisRegistry.sol` + `ReportSBT.sol`) di `contracts/`. Arsitektur modular memungkinkan:

- **MultiSigWallet** — kontrak mandiri, tidak coupled dengan apa pun, reusable di proyek lain
- **MultiSigGovernor** — adapter pattern, menghubungkan MultiSigWallet dengan kontrak existing ChainNusa
- Incremental build: MultiSigWallet dulu (test + deploy), Governance menyusul
- Setiap komponen testable independen

### 2.2 Komponen

```
contracts/src/
├── multisig/
│   ├── MultiSigWallet.sol         # Kontrak multi-sig mandiri
│   └── IMultiSigWallet.sol        # Interface + events
├── governance/
│   ├── MultiSigGovernor.sol       # Adapter: multi-sig → existing contracts
│   └── IMultiSigGovernor.sol      # Interface governance
├── AnalysisRegistry.sol           # Existing — on-chain registry
├── ReportSBT.sol                  # Existing — soulbound NFT
├── lib/
│   └── MultiSigLib.sol            # Pure helper functions

contracts/test/
├── multisig/
│   ├── MultiSigWallet.t.sol       # Unit tests
│   └── MultiSigWallet.fuzz.t.sol  # Fuzz tests
├── governance/
│   ├── MultiSigGovernor.t.sol     # Unit tests
│   └── MultiSigGovernor.integration.t.sol  # Integration dengan kontrak existing
└── helpers/
    └── TestHelpers.sol            # Shared test utilities
```

### 2.3 Interaksi Antar Komponen

```
MultiSigWallet (standalone)
    │
    │  submit proposal → approve → execute
    │
    ├── Direct use: ETH/ERC-20 transfer, generic contract call
    │
    └── Governance via MultiSigGovernor:
         │
         ├── AnalysisRegistry: recordAnalysis() hanya via multi-sig
         ├── ReportSBT: mint() hanya via multi-sig
         └── (extensible) kontrak baru bisa plug-in ke governor
```

---

## 3. User Stories

### 3.1 MultiSigWallet (Standalone)

| ID | Sebagai | Saya ingin | Sehingga |
|----|---------|------------|----------|
| US-01 | Owner | Deploy wallet dengan daftar owner dan threshold | Wallet siap dipakai |
| US-02 | Owner | Submit transaksi baru | Owner lain bisa approve |
| US-03 | Owner | Approve transaksi yang disubmit owner lain | Transaksi bisa dieksekusi |
| US-04 | Owner | Revoke approval saya sebelum eksekusi | Saya bisa berubah pikiran |
| US-05 | Anyone | Eksekusi transaksi yang sudah cukup approval | Dana terkirim ke recipient |
| US-06 | Owner | Lihat semua transaksi pending | Saya tahu apa yang perlu di-approve |
| US-07 | Anyone | Lihat history transaksi yang sudah dieksekusi | Ada audit trail |
| US-08 | Anyone | Deposit ETH ke wallet | Wallet punya saldo |
| US-09 | Owner | Submit proposal tambah/hapus owner (butuh threshold) | Manajemen akses |
| US-10 | Owner | Submit proposal ganti threshold (butuh threshold) | Fleksibilitas governance |
| US-11 | Owner | Kirim ERC-20 dari multi-sig wallet | Multi-token support |

### 3.2 MultiSigGovernor (Integrasi ChainNusa)

| ID | Sebagai | Saya ingin | Sehingga |
|----|---------|------------|----------|
| US-12 | Team lead | Record analysis ke on-chain hanya via multi-sig approval | Tidak ada single point of authority |
| US-13 | Team lead | Mint ReportSBT hanya via multi-sig approval | SBT benar-benar representasi tim, bukan individu |
| US-14 | Team lead | Upgrade AnalysisRegistry ke versi baru via multi-sig | Deployment terkoordinasi |

---

## 4. Functional Requirements

### 4.1 MultiSigWallet — Core Features

#### FR-01: Deployment & Initialization

- Contract menerima array `owners` dan nilai `required` (threshold) saat deploy
- Validasi: `owners` tidak boleh kosong, tidak ada duplikat, tidak ada zero address
- Validasi: `required` harus antara 1 dan panjang array `owners`
- Event `WalletCreated(address[] owners, uint required)` di-emit saat deploy
- Gunakan OpenZeppelin Ownable2Step untuk owner management contract sendiri (jika perlu upgrade path)

#### FR-02: Submit Transaction

- Owner dapat submit transaksi dengan parameter: `to`, `value`, `data`
- Setiap transaksi mendapat `txIndex` unik yang auto-increment
- Submitter otomatis menjadi approver pertama
- Event `SubmitTransaction(address indexed owner, uint indexed txIndex, address indexed to, uint value, bytes data)`

#### FR-03: Approve Transaction

- Owner dapat approve transaksi berdasarkan `txIndex`
- Satu owner hanya bisa approve sekali per transaksi
- Tidak bisa approve transaksi yang sudah dieksekusi
- Event `ApproveTransaction(address indexed owner, uint indexed txIndex)`

#### FR-04: Revoke Approval

- Owner dapat revoke approval selama transaksi belum dieksekusi
- Event `RevokeConfirmation(address indexed owner, uint indexed txIndex)`

#### FR-05: Execute Transaction

- Siapapun (bukan hanya owner) dapat trigger eksekusi jika approval count >= required
- Eksekusi menggunakan low-level call untuk support arbitrary calldata
- Jika eksekusi gagal (revert), transaksi tetap marked tidak dieksekusi (tidak atomic revert)
- Event `ExecuteTransaction(address indexed owner, uint indexed txIndex)`

#### FR-06: Deposit

- Contract menerima ETH via receive() function
- Event `Deposit(address indexed sender, uint amount, uint balance)`

#### FR-07: ERC-20 Transfer

- MultiSigWallet dapat memegang dan mengirim ERC-20 token
- Eksekusi via `IERC20.transfer()` dengan calldata encoded

#### FR-08: Owner Management (via internal proposals)

- Tambah owner: butuh threshold approval, di-encode sebagai proposal ke alamat contract sendiri
- Hapus owner: sama, dengan validasi threshold tidak melebihi jumlah owner setelah penghapusan
- Ganti threshold: sama, dengan validasi `newThreshold >= 1` dan `newThreshold <= ownerCount`

### 4.2 MultiSigGovernor — Features

#### FR-09: Governance Wrapper untuk AnalysisRegistry

- `MultiSigGovernor` menjadi callee untuk `AnalysisRegistry.recordAnalysis()`
- Function `proposeRecordAnalysis(cidBytes, chainId, indexedWallet)` → submit proposal ke MultiSigWallet
- Hanya bisa di-eksekusi setelah cukup approval

#### FR-10: Governance Wrapper untuk ReportSBT

- `MultiSigGovernor` menjadi callee untuk `ReportSBT.mint()`
- Function `proposeMintSBT(to, analysisId, cidBytes)` → submit proposal ke MultiSigWallet
- Hanya bisa di-eksekusi setelah cukup approval

### 4.3 View Functions (Read-Only, Gas-Free)

- `getOwners()` → array semua owner aktif
- `getTransactionCount()` → total jumlah transaksi
- `getTransaction(txIndex)` → detail satu transaksi
- `isOwner(address)` → boolean
- `isConfirmed(txIndex, address)` → boolean
- `getConfirmationCount(txIndex)` → uint
- `getBalance()` → balance ETH contract

---

## 5. Smart Contract Specification

### 5.1 Storage Layout (MultiSigWallet.sol)

```solidity
// Slot 0
address[] public owners;

// Slot 1
uint public required;

// Slot 2
Transaction[] public transactions;

// Slot 3
mapping(address => bool) public isOwner;

// Slot 4
mapping(uint => mapping(address => bool)) public isConfirmed;

struct Transaction {
    address to;       // 20 bytes
    uint96 value;     // 12 bytes — packed dengan 'to' dalam 1 slot
    bytes data;
    bool executed;
    uint numConfirmations;
}
```

### 5.2 Events

```solidity
event Deposit(address indexed sender, uint amount, uint balance);
event SubmitTransaction(
    address indexed owner,
    uint indexed txIndex,
    address indexed to,
    uint value,
    bytes data
);
event ConfirmTransaction(address indexed owner, uint indexed txIndex);
event RevokeConfirmation(address indexed owner, uint indexed txIndex);
event ExecuteTransaction(address indexed owner, uint indexed txIndex);
event OwnerAdded(address indexed newOwner);
event OwnerRemoved(address indexed removedOwner);
event RequirementChanged(uint newRequired);
```

### 5.3 Custom Errors (Gas Efficient)

```solidity
error NotOwner();
error TxNotExist();
error TxAlreadyExecuted();
error TxAlreadyConfirmed();
error NotEnoughConfirmations();
error ExecutionFailed();
error InvalidOwner();
error InvalidRequired();
error DuplicateOwner();
error OwnerNotFound();
error CannotRemoveLastOwner();
```

### 5.4 MultiSigGovernor.sol

```solidity
contract MultiSigGovernor {
    MultiSigWallet public immutable wallet;
    AnalysisRegistry public immutable registry;
    ReportSBT public immutable sbt;

    constructor(address _wallet, address _registry, address _sbt) { ... }

    function proposeRecordAnalysis(
        bytes32 cidBytes,
        uint256 chainId,
        address indexedWallet
    ) external onlyOwner returns (uint txIndex) {
        bytes memory data = abi.encodeWithSelector(
            AnalysisRegistry.recordAnalysis.selector,
            cidBytes, chainId, indexedWallet
        );
        txIndex = wallet.submitTransaction(address(registry), 0, data);
    }

    function proposeMintSBT(
        address to,
        bytes32 analysisId,
        bytes32 cidBytes
    ) external onlyOwner returns (uint txIndex) {
        bytes memory data = abi.encodeWithSelector(
            ReportSBT.mint.selector,
            to, analysisId, cidBytes
        );
        txIndex = wallet.submitTransaction(address(sbt), 0, data);
    }
}
```

### 5.5 Solana Account Layout

```rust
// Wallet PDA: seeds = ["wallet", creator.key()]
#[account]
pub struct WalletState {
    pub owners: Vec<Pubkey>,       // Max 10 owners
    pub required: u8,
    pub tx_count: u64,
    pub bump: u8,
}

// Transaction PDA: seeds = ["tx", wallet.key(), tx_index]
#[account]
pub struct TransactionState {
    pub wallet: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub data: Vec<u8>,
    pub executed: bool,
    pub approvals: Vec<Pubkey>,
    pub bump: u8,
}
```

---

## 6. Security Requirements

### 6.1 Access Control

- Semua fungsi state-changing harus check `isOwner[msg.sender]`
- Tidak ada admin key atau upgradeability — immutable by design
- Owner tidak bisa approve transaksinya dua kali
- MultiSigGovernor: hanya owner MultiSigWallet yang bisa submit proposal

### 6.2 Reentrancy Protection

- Execute function menggunakan Checks-Effects-Interactions pattern
- Set `transaction.executed = true` SEBELUM melakukan external call
- Gunakan `ReentrancyGuard` dari OpenZeppelin sebagai defense in depth

### 6.3 Integer Safety

- Gunakan Solidity ^0.8.24 — overflow protection built-in
- Validasi `value` tidak melebihi `address(this).balance` sebelum eksekusi

### 6.4 Audit Checklist

- [ ] Slither static analysis — zero high/medium findings
- [ ] Manual review: reentrancy, access control, integer overflow
- [ ] Fuzz testing dengan forge test --fuzz-runs 10000
- [ ] Invariant testing: `numConfirmations` tidak pernah melebihi jumlah owner
- [ ] invariant: setelah remove owner, threshold tetap valid

---

## 7. Testing Requirements

### 7.1 EVM — forge test

**Unit Tests (MultiSigWallet):**

```
✓ test_Deploy_Success
✓ test_Deploy_RevertIf_NoOwners
✓ test_Deploy_RevertIf_InvalidRequired
✓ test_Deploy_RevertIf_DuplicateOwner
✓ test_Deposit_EmitsEvent
✓ test_Submit_Success
✓ test_Submit_RevertIf_NotOwner
✓ test_Confirm_Success
✓ test_Confirm_RevertIf_AlreadyConfirmed
✓ test_Confirm_RevertIf_TxNotExist
✓ test_Revoke_Success
✓ test_Revoke_RevertIf_NotConfirmed
✓ test_Execute_Success
✓ test_Execute_RevertIf_NotEnoughConfirmations
✓ test_Execute_RevertIf_AlreadyExecuted
✓ test_Execute_FailedCall_Reverts
✓ test_AddOwner_ViaMultiSig
✓ test_RemoveOwner_ViaMultiSig
✓ test_ChangeThreshold_ViaMultiSig
✓ test_ERC20_Transfer
```

**Unit Tests (MultiSigGovernor):**

```
✓ test_ProposeRecordAnalysis
✓ test_ProposeMintSBT
✓ test_ExecuteRecordAnalysis_AfterApproval
✓ test_ExecuteMintSBT_AfterApproval
✓ test_Proposal_RevertIf_NotOwner
```

**Integration Tests:**

```
✓ test_FullFlow_2of3_Wallet
✓ test_FullFlow_3of5_Wallet
✓ test_FullFlow_Governance_RecordAnalysis
✓ test_FullFlow_Governance_MintSBT
✓ test_OwnerCannotExecuteWithoutEnoughApprovals
✓ test_RevokeAndReapprove
✓ test_ExecuteWithCalldata (contract interaction)
```

**Fuzz Tests:**

```solidity
function testFuzz_Submit(address to, uint96 value, bytes calldata data) public { ... }
function testFuzz_Required(uint8 required, uint8 ownerCount) public { ... }
function testFuzz_Execute(uint96 value) public { ... }
```

**Coverage Target:** ≥ 95% line coverage, ≥ 90% branch coverage

### 7.2 Solana — anchor test

```typescript
describe("multisig", () => {
  it("initializes wallet", async () => { ... });
  it("submits transaction", async () => { ... });
  it("approves transaction", async () => { ... });
  it("executes after threshold met", async () => { ... });
  it("rejects execution below threshold", async () => { ... });
  it("revokes approval", async () => { ... });
});
```

---

## 8. Gas Optimization

| Teknik | Implementasi |
|--------|-------------|
| Custom errors | Ganti `require(cond, "string")` dengan `if (!cond) revert CustomError()` |
| Immutable variables | `required` jika tidak berubah → `immutable` |
| Struct packing | Pack `address` (20 bytes) dengan `uint96` (12 bytes) dalam 1 slot |
| Mapping vs array | Gunakan mapping untuk O(1) lookup owner |
| Calldata vs memory | Parameter fungsi external pakai `calldata` bukan `memory` |
| Short-circuit | Check murah (owner check) sebelum check mahal |

**Gas benchmark target:**

| Fungsi | Target max gas |
|--------|---------------|
| Deploy | 800,000 |
| Submit | 80,000 |
| Confirm | 50,000 |
| Execute (simple ETH) | 60,000 |
| Revoke | 35,000 |

---

## 9. Frontend Requirements

### 9.1 Pages (di dalam `apps/web/`)

**Dashboard (`/wallet`)**
- Tampilkan: wallet address, balance ETH, owner list, threshold
- Tombol: Connect Wallet, Deposit, Submit New Transaction
- Integrasi dengan existing `Analyzer` component di `page.tsx`

**Transactions (`/wallet/transactions`)**
- List semua transaksi (pending dan executed) dengan pagination
- Filter: All / Pending / Executed
- Setiap card: to, value, approval progress bar, tombol approve/revoke/execute

**Transaction Detail (`/wallet/transactions/[txIndex]`)**
- Detail lengkap termasuk calldata
- Daftar siapa yang sudah approve
- Timeline eksekusi

### 9.2 Wallet Connection

- Support MetaMask dan WalletConnect via RainbowKit
- WAGMI hooks: `useReadContract`, `useWriteContract`, `useWatchContractEvent`
- Auto-detect chain — warning jika bukan Arbitrum/Base
- Handle wrong network dengan prompt switch

### 9.3 Real-time Updates

- Watch `ConfirmTransaction` dan `ExecuteTransaction` events
- Update approval count dan status tanpa refresh manual

---

## 10. Deployment Plan

### 10.1 EVM Deployment Steps

```bash
# 1. Test lokal
forge test -vvv

# 2. Coverage check
forge coverage --report lcov

# 3. Deploy ke testnet
forge create src/multisig/MultiSigWallet.sol:MultiSigWallet \
  --constructor-args "[0xOwner1, 0xOwner2, 0xOwner3]" 2 \
  --rpc-url arbitrum_sepolia \
  --private-key $PRIVATE_KEY \
  --verify \
  --etherscan-api-key $ARBISCAN_KEY

# 4. Deploy MultiSigGovernor
forge create src/governance/MultiSigGovernor.sol:MultiSigGovernor \
  --constructor-args "$MULTISIG_ADDRESS $REGISTRY_ADDRESS $SBT_ADDRESS" \
  --rpc-url arbitrum_sepolia \
  --private-key $PRIVATE_KEY \
  --verify

# 5. Transfer ownership existing contracts ke MultiSigGovernor
#   AnalysisRegistry.transferOwnership(governorAddress)
#   ReportSBT.transferOwnership(governorAddress)

# 6. Deploy mainnet (setelah audit)
```

### 10.2 Solana Deployment Steps

```bash
anchor build
anchor test
anchor deploy --provider.cluster devnet
anchor deploy --provider.cluster mainnet-beta
```

### 10.3 Frontend Deployment

```bash
# Existing Next.js app — tambahkan halaman wallet
pnpm web:dev
pnpm web:build
vercel deploy --prod
```

---

## 11. Milestones & Timeline

| Milestone | Deliverable | Estimasi |
|-----------|-------------|----------|
| M1 | MultiSigWallet.sol + unit tests (forge) | Minggu 1 |
| M2 | Integration tests + fuzz tests | Minggu 1-2 |
| M3 | MultiSigGovernor.sol + tests | Minggu 2 |
| M4 | Deploy ke Arbitrum Sepolia + verified | Minggu 2 |
| M5 | Next.js UI (read + write + events) | Minggu 2-3 |
| M6 | Frontend deploy ke Vercel | Minggu 3 |
| M7 | Slither audit + gas optimization | Minggu 3-4 |
| M8 | Rust/Anchor implementation (Solana) | Minggu 5-6 |
| M9 | Deploy mainnet (EVM) + final docs | Setelah M7 |

---

## 12. Definition of Done

Contract dianggap production-ready jika:

- [ ] Semua unit dan integration test pass
- [ ] forge coverage ≥ 95%
- [ ] Slither — zero high severity finding
- [ ] Contract verified di Arbiscan/Basescan
- [ ] Gas usage dalam target benchmark
- [ ] Frontend live di Vercel dengan domain custom
- [ ] MultiSigGovernor terintegrasi dengan AnalysisRegistry & ReportSBT
- [ ] README lengkap: arsitektur modular, cara deploy, cara test, cara upgrade
- [ ] NatSpec documentation di semua fungsi public

---

## 13. References

- [Solidity docs](https://docs.soliditylang.org)
- [Foundry Book](https://book.getfoundry.sh)
- [Anchor Book](https://www.anchor-lang.com)
- [wagmi docs](https://wagmi.sh)
- [RainbowKit](https://www.rainbowkit.com)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Gnosis Safe](https://github.com/safe-global/safe-contracts) — referensi implementasi production
- [Slither](https://github.com/crytic/slither) — static analyzer
