# Product Requirements Document
# Multi-Signature Wallet — Cross-Chain (EVM + Solana)

**Versi:** 1.0.0
**Status:** Draf
**Penulis:** Faisal Affan
**Terakhir Diperbarui:** 2026-05-19

---

## 1. Gambaran Umum

### 1.1 Ringkasan Produk

Sebuah smart contract multi-signature wallet yang memerlukan persetujuan minimal N dari M pemilik sebelum sebuah transaksi dapat dieksekusi. Dibangun dengan arsitektur **modular** (Pendekatan B) — kontrak MultiSigWallet mandiri + adaptor MultiSigGovernor ke kontrak ChainNusa yang sudah ada (AnalysisRegistry, ReportSBT). Dibangun sebagai proyek portofolio dengan kualitas production-grade: cakupan test penuh, audit keamanan, dan frontend yang dapat digunakan langsung.

### 1.2 Tujuan

- Mendemonstrasikan keterampilan pengembangan smart contract Solidity dan Rust
- Codebase siap produksi yang dapat dipresentasikan kepada recruiter atau klien
- Arsitektur modular: MultiSigWallet (mandiri) + MultiSigGovernor (tata kelola untuk AnalysisRegistry & ReportSBT)
- Minimal 95% cakupan test dengan forge test (EVM) dan solana-test-validator (Solana)
- Integrasi penuh dengan platform analitik ChainNusa yang sudah ada

### 1.3 Non-Tujuan

- Tidak ada dukungan token ERC-1155 di versi pertama
- Tidak ada mekanisme sengketa atau arbitrase
- Tidak ada aplikasi mobile (web saja)
- Tidak ada dukungan multi-chain dalam satu deployment

---

## 2. Arsitektur — Pendekatan B (Modular)

### 2.1 Mengapa Modular?

Proyek ChainNusa sudah memiliki smart contract (`AnalysisRegistry.sol` + `ReportSBT.sol`) di `contracts/`. Arsitektur modular memungkinkan:

- **MultiSigWallet** — kontrak mandiri, tidak terikat pada apapun, dapat digunakan ulang di proyek lain
- **MultiSigGovernor** — pola adaptor, menghubungkan MultiSigWallet dengan kontrak ChainNusa yang sudah ada
- Build inkremental: MultiSigWallet dulu (test + deploy), Governance menyusul
- Setiap komponen dapat diuji secara independen

### 2.2 Komponen

```
contracts/src/
├── multisig/
│   ├── MultiSigWallet.sol         # Kontrak multi-sig mandiri
│   └── IMultiSigWallet.sol        # Interface + events
├── governance/
│   ├── MultiSigGovernor.sol       # Adaptor: multi-sig → kontrak existing
│   └── IMultiSigGovernor.sol      # Interface tata kelola
├── AnalysisRegistry.sol           # Existing — registry on-chain
├── ReportSBT.sol                  # Existing — soulbound NFT
├── lib/
│   └── MultiSigLib.sol            # Fungsi helper murni

contracts/test/
├── multisig/
│   ├── MultiSigWallet.t.sol       # Unit test
│   └── MultiSigWallet.fuzz.t.sol  # Fuzz test
├── governance/
│   ├── MultiSigGovernor.t.sol     # Unit test
│   └── MultiSigGovernor.integration.t.sol  # Integrasi dengan kontrak existing
└── helpers/
    └── TestHelpers.sol            # Utilitas test bersama
```

### 2.3 Interaksi Komponen

```
MultiSigWallet (mandiri)
    │
    │  submit proposal → approve → execute
    │
    ├── Penggunaan langsung: transfer ETH/ERC-20, panggilan kontrak generik
    │
    └── Tata kelola via MultiSigGovernor:
         │
         ├── AnalysisRegistry: recordAnalysis() hanya via multi-sig
         ├── ReportSBT: mint() hanya via multi-sig
         └── (dapat diperluas) kontrak baru dapat terhubung ke governor
```

---

## 3. User Stories

### 3.1 MultiSigWallet (Mandiri)

| ID | Sebagai | Saya ingin | Sehingga |
|----|---------|------------|----------|
| US-01 | Pemilik | Deploy wallet dengan daftar pemilik dan threshold | Wallet siap digunakan |
| US-02 | Pemilik | Submit transaksi baru | Pemilik lain dapat menyetujui |
| US-03 | Pemilik | Menyetujui transaksi yang diajukan pemilik lain | Transaksi dapat dieksekusi |
| US-04 | Pemilik | Membatalkan persetujuan saya sebelum eksekusi | Saya dapat mengubah pikiran |
| US-05 | Siapa saja | Mengeksekusi transaksi dengan persetujuan cukup | Dana dikirim ke penerima |
| US-06 | Pemilik | Melihat semua transaksi tertunda | Saya tahu apa yang perlu disetujui |
| US-07 | Siapa saja | Melihat riwayat transaksi yang telah dieksekusi | Ada jejak audit |
| US-08 | Siapa saja | Deposit ETH ke wallet | Wallet memiliki saldo |
| US-09 | Pemilik | Mengajukan proposal untuk menambah/menghapus pemilik (membutuhkan threshold) | Manajemen akses |
| US-10 | Pemilik | Mengajukan proposal untuk mengubah threshold (membutuhkan threshold) | Fleksibilitas tata kelola |
| US-11 | Pemilik | Mengirim ERC-20 dari multi-sig wallet | Dukungan multi-token |

### 3.2 MultiSigGovernor (Integrasi ChainNusa)

| ID | Sebagai | Saya ingin | Sehingga |
|----|---------|------------|----------|
| US-12 | Pimpinan tim | Merekam analisis on-chain hanya melalui persetujuan multi-sig | Tidak ada otoritas tunggal |
| US-13 | Pimpinan tim | Mint ReportSBT hanya melalui persetujuan multi-sig | SBT benar-benar mewakili tim, bukan individu |
| US-14 | Pimpinan tim | Upgrade AnalysisRegistry ke versi baru melalui multi-sig | Deployment terkoordinasi |

---

## 4. Persyaratan Fungsional

### 4.1 MultiSigWallet — Fitur Inti

#### FR-01: Deployment & Inisialisasi

- Kontrak menerima array `owners` dan nilai `required` (threshold) saat deploy
- Validasi: `owners` tidak boleh kosong, tidak boleh duplikat, tidak boleh alamat nol
- Validasi: `required` harus antara 1 dan panjang array `owners`
- Event `WalletCreated(address[] owners, uint required)` dipancarkan saat deploy
- Gunakan OpenZeppelin Ownable2Step untuk manajemen pemilik kontrak (jika perlu jalur upgrade)

#### FR-02: Submit Transaksi

- Pemilik dapat submit transaksi dengan parameter: `to`, `value`, `data`
- Setiap transaksi menerima `txIndex` auto-increment unik
- Pengirim secara otomatis menjadi penyetuju pertama
- Event `SubmitTransaction(address indexed owner, uint indexed txIndex, address indexed to, uint value, bytes data)`

#### FR-03: Setujui Transaksi

- Pemilik dapat menyetujui transaksi berdasarkan `txIndex`
- Satu pemilik hanya dapat menyetujui sekali per transaksi
- Tidak dapat menyetujui transaksi yang sudah dieksekusi
- Event `ApproveTransaction(address indexed owner, uint indexed txIndex)`

#### FR-04: Batalkan Persetujuan

- Pemilik dapat membatalkan persetujuan selama transaksi belum dieksekusi
- Event `RevokeConfirmation(address indexed owner, uint indexed txIndex)`

#### FR-05: Eksekusi Transaksi

- Siapa saja (bukan hanya pemilik) dapat memicu eksekusi jika jumlah persetujuan >= required
- Eksekusi menggunakan low-level call untuk mendukung calldata arbitrer
- Jika eksekusi gagal (revert), transaksi tetap ditandai sebagai belum dieksekusi (tidak ada atomic revert)
- Event `ExecuteTransaction(address indexed owner, uint indexed txIndex)`

#### FR-06: Deposit

- Kontrak menerima ETH melalui fungsi receive()
- Event `Deposit(address indexed sender, uint amount, uint balance)`

#### FR-07: Transfer ERC-20

- MultiSigWallet dapat menampung dan mengirim token ERC-20
- Eksekusi via `IERC20.transfer()` dengan calldata yang dienkode

#### FR-08: Manajemen Pemilik (via proposal internal)

- Tambah pemilik: membutuhkan persetujuan threshold, dienkode sebagai proposal ke alamat kontrak sendiri
- Hapus pemilik: sama, dengan validasi bahwa threshold tidak melebihi jumlah pemilik setelah penghapusan
- Ubah threshold: sama, dengan validasi `newThreshold >= 1` dan `newThreshold <= jumlahPemilik`

### 4.2 MultiSigGovernor — Fitur

#### FR-09: Pembungkus Tata Kelola untuk AnalysisRegistry

- `MultiSigGovernor` menjadi penerima panggil untuk `AnalysisRegistry.recordAnalysis()`
- Fungsi `proposeRecordAnalysis(cidBytes, chainId, indexedWallet)` → submit proposal ke MultiSigWallet
- Hanya dapat dieksekusi setelah persetujuan cukup

#### FR-10: Pembungkus Tata Kelola untuk ReportSBT

- `MultiSigGovernor` menjadi penerima panggil untuk `ReportSBT.mint()`
- Fungsi `proposeMintSBT(to, analysisId, cidBytes)` → submit proposal ke MultiSigWallet
- Hanya dapat dieksekusi setelah persetujuan cukup

### 4.3 View Functions (Hanya Baca, Tanpa Gas)

- `getOwners()` → array semua pemilik aktif
- `getTransactionCount()` → total jumlah transaksi
- `getTransaction(txIndex)` → detail satu transaksi
- `isOwner(address)` → boolean
- `isConfirmed(txIndex, address)` → boolean
- `getConfirmationCount(txIndex)` → uint
- `getBalance()` → saldo ETH kontrak

---

## 5. Spesifikasi Smart Contract

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
    uint96 value;     // 12 bytes — dipak dengan 'to' dalam 1 slot
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

### 5.3 Custom Errors (Hemat Gas)

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
    pub owners: Vec<Pubkey>,       // Maks 10 pemilik
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

## 6. Persyaratan Keamanan

### 6.1 Kontrol Akses

- Semua fungsi yang mengubah state harus memeriksa `isOwner[msg.sender]`
- Tidak ada admin key atau upgradeability — immutable by design
- Pemilik tidak dapat menyetujui transaksi mereka sendiri dua kali
- MultiSigGovernor: hanya pemilik MultiSigWallet yang dapat submit proposal

### 6.2 Perlindungan Reentrancy

- Fungsi eksekusi menggunakan pola Checks-Effects-Interactions
- Set `transaction.executed = true` SEBELUM melakukan panggilan eksternal
- Gunakan `ReentrancyGuard` dari OpenZeppelin sebagai pertahanan berlapis

### 6.3 Keamanan Integer

- Gunakan Solidity ^0.8.24 — proteksi overflow bawaan
- Validasi `value` tidak melebihi `address(this).balance` sebelum eksekusi

### 6.4 Checklist Audit

- [ ] Slither static analysis — nol temuan high/medium
- [ ] Review manual: reentrancy, kontrol akses, integer overflow
- [ ] Fuzz testing dengan forge test --fuzz-runs 10000
- [ ] Invariant testing: `numConfirmations` tidak pernah melebihi jumlah pemilik
- [ ] Invariant: setelah menghapus pemilik, threshold tetap valid

---

## 7. Persyaratan Testing

### 7.1 EVM — forge test

**Unit Test (MultiSigWallet):**

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

**Unit Test (MultiSigGovernor):**

```
✓ test_ProposeRecordAnalysis
✓ test_ProposeMintSBT
✓ test_ExecuteRecordAnalysis_AfterApproval
✓ test_ExecuteMintSBT_AfterApproval
✓ test_Proposal_RevertIf_NotOwner
```

**Integration Test:**

```
✓ test_FullFlow_2of3_Wallet
✓ test_FullFlow_3of5_Wallet
✓ test_FullFlow_Governance_RecordAnalysis
✓ test_FullFlow_Governance_MintSBT
✓ test_OwnerCannotExecuteWithoutEnoughApprovals
✓ test_RevokeAndReapprove
✓ test_ExecuteWithCalldata (interaksi kontrak)
```

**Fuzz Test:**

```solidity
function testFuzz_Submit(address to, uint96 value, bytes calldata data) public { ... }
function testFuzz_Required(uint8 required, uint8 ownerCount) public { ... }
function testFuzz_Execute(uint96 value) public { ... }
```

**Target Cakupan:** ≥ 95% cakupan baris, ≥ 90% cakupan cabang

### 7.2 Solana — anchor test

```typescript
describe("multisig", () => {
  it("menginisialisasi wallet", async () => { ... });
  it("submit transaksi", async () => { ... });
  it("menyetujui transaksi", async () => { ... });
  it("eksekusi setelah threshold terpenuhi", async () => { ... });
  it("menolak eksekusi di bawah threshold", async () => { ... });
  it("membatalkan persetujuan", async () => { ... });
});
```

---

## 8. Optimasi Gas

| Teknik | Implementasi |
|--------|--------------|
| Custom errors | Ganti `require(cond, "string")` dengan `if (!cond) revert CustomError()` |
| Immutable variables | `required` jika tidak berubah → `immutable` |
| Struct packing | Pak `address` (20 bytes) dengan `uint96` (12 bytes) dalam 1 slot |
| Mapping vs array | Gunakan mapping untuk pencarian O(1) pemilik |
| Calldata vs memory | Parameter fungsi eksternal gunakan `calldata` bukan `memory` |
| Short-circuit | Periksa operasi murah (cek pemilik) sebelum operasi mahal |

**Target benchmark gas:**

| Fungsi | Target gas maks |
|--------|----------------|
| Deploy | 800.000 |
| Submit | 80.000 |
| Confirm | 50.000 |
| Execute (ETH sederhana) | 60.000 |
| Revoke | 35.000 |

---

## 9. Persyaratan Frontend

### 9.1 Halaman (di dalam `apps/web/`)

**Dashboard (`/wallet`)**
- Tampilkan: alamat wallet, saldo ETH, daftar pemilik, threshold
- Tombol: Connect Wallet, Deposit, Submit New Transaction
- Integrasi dengan komponen `Analyzer` yang sudah ada di `page.tsx`

**Transaksi (`/wallet/transactions`)**
- Daftar semua transaksi (tertunda dan dieksekusi) dengan pagination
- Filter: Semua / Tertunda / Dieksekusi
- Setiap kartu: to, value, progress bar persetujuan, tombol approve/revoke/execute

**Detail Transaksi (`/wallet/transactions/[txIndex]`)**
- Detail lengkap termasuk calldata
- Daftar siapa yang telah menyetujui
- Timeline eksekusi

### 9.2 Koneksi Wallet

- Dukungan MetaMask dan WalletConnect via RainbowKit
- Hook WAGMI: `useReadContract`, `useWriteContract`, `useWatchContractEvent`
- Deteksi chain otomatis — peringatkan jika bukan Arbitrum/Base
- Tangani jaringan salah dengan prompt switch

### 9.3 Pembaruan Real-time

- Pantau event `ConfirmTransaction` dan `ExecuteTransaction`
- Perbarui jumlah persetujuan dan status tanpa refresh manual

---

## 10. Rencana Deployment

### 10.1 Langkah Deployment EVM

```bash
# 1. Test lokal
forge test -vvv

# 2. Cek cakupan
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

# 5. Transfer kepemilikan kontrak existing ke MultiSigGovernor
#   AnalysisRegistry.transferOwnership(governorAddress)
#   ReportSBT.transferOwnership(governorAddress)

# 6. Deploy ke mainnet (setelah audit)
```

### 10.2 Langkah Deployment Solana

```bash
anchor build
anchor test
anchor deploy --provider.cluster devnet
anchor deploy --provider.cluster mainnet-beta
```

### 10.3 Deployment Frontend

```bash
# Aplikasi Next.js yang sudah ada — tambah halaman wallet
pnpm web:dev
pnpm web:build
vercel deploy --prod
```

---

## 11. Milestones & Timeline

| Milestone | Deliverable | Estimasi |
|-----------|-------------|----------|
| M1 | MultiSigWallet.sol + unit test (forge) | Minggu 1 |
| M2 | Integration test + fuzz test | Minggu 1-2 |
| M3 | MultiSigGovernor.sol + test | Minggu 2 |
| M4 | Deploy ke Arbitrum Sepolia + verifikasi | Minggu 2 |
| M5 | Next.js UI (read + write + events) | Minggu 2-3 |
| M6 | Deploy frontend ke Vercel | Minggu 3 |
| M7 | Audit Slither + optimasi gas | Minggu 3-4 |
| M8 | Implementasi Rust/Anchor (Solana) | Minggu 5-6 |
| M9 | Deploy mainnet (EVM) + dokumen akhir | Setelah M7 |

---

## 12. Definisi Selesai

Kontrak dianggap siap produksi jika:

- [ ] Semua unit dan integration test lulus
- [ ] forge coverage ≥ 95%
- [ ] Slither — nol temuan severity tinggi
- [ ] Kontrak diverifikasi di Arbiscan/Basescan
- [ ] Penggunaan gas dalam target benchmark
- [ ] Frontend live di Vercel dengan domain kustom
- [ ] MultiSigGovernor terintegrasi dengan AnalysisRegistry & ReportSBT
- [ ] README lengkap: arsitektur modular, cara deploy, cara test, cara upgrade
- [ ] Dokumentasi NatSpec pada semua fungsi publik

---

## 13. Referensi

- [Dokumentasi Solidity](https://docs.soliditylang.org)
- [Foundry Book](https://book.getfoundry.sh)
- [Anchor Book](https://www.anchor-lang.com)
- [Dokumentasi wagmi](https://wagmi.sh)
- [RainbowKit](https://www.rainbowkit.com)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Gnosis Safe](https://github.com/safe-global/safe-contracts) — referensi implementasi produksi
- [Slither](https://github.com/crytic/slither) — static analyzer
