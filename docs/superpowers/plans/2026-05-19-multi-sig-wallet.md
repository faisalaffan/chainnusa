# Multi-Sig Wallet — Rencana Implementasi (M1–M4)

> **Untuk pekerja agenik:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengimplementasikan rencana ini tugas-per-tugas. Langkah-langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Implementasi kontrak multi-sig wallet modular (MultiSigWallet + MultiSigGovernor) dengan cakupan test penuh, deploy ke Arbitrum Sepolia testnet.

**Arsitektur:** Modular Pendekatan B — `MultiSigWallet.sol` (wallet N-of-M mandiri: submit/approve/revoke/execute ETH + ERC-20 + panggilan generik) ditambah `MultiSigGovernor.sol` (adaptor yang menghubungkan multi-sig ke `AnalysisRegistry.sol` dan `ReportSBT.sol` yang sudah ada). Keduanya menggunakan OpenZeppelin Contracts (Ownable2Step, ReentrancyGuard).

**Tech Stack:** Solidity ^0.8.24, Foundry, OpenZeppelin Contracts, forge-std

**Prasyarat:** `contracts/` sudah ter-setup dengan Foundry + OpenZeppelin via remappings. `AnalysisRegistry.sol` dan `ReportSBT.sol` yang sudah ada dan berfungsi.

**Lingkup:** Task 1–13 = M1 (MultiSigWallet + unit test), Task 14–20 = M2 (integration + fuzz), Task 21–28 = M3 (MultiSigGovernor + test), Task 29–33 = M4 (deploy script + testnet). Frontend (M5) dan Solana (M8) adalah rencana lanjutan terpisah.

---

## Struktur File

```
contracts/
├── src/
│   ├── multisig/
│   │   └── MultiSigWallet.sol     # BUAT — wallet N-of-M inti
│   ├── governance/
│   │   └── MultiSigGovernor.sol   # BUAT — adaptor ke kontrak existing
│   ├── AnalysisRegistry.sol       # SUDAH ADA — tidak ada perubahan
│   └── ReportSBT.sol              # SUDAH ADA — tidak ada perubahan
├── test/
│   ├── multisig/
│   │   ├── MultiSigWallet.t.sol       # BUAT — unit test
│   │   └── MultiSigWallet.fuzz.t.sol  # BUAT — fuzz test
│   ├── governance/
│   │   ├── MultiSigGovernor.t.sol     # BUAT — unit test
│   │   └── MultiSigGovernor.integration.t.sol  # BUAT — integration test
│   ├── AnalysisRegistry.t.sol     # SUDAH ADA — tidak ada perubahan
│   └── ReportSBT.t.sol            # SUDAH ADA — tidak ada perubahan
└── script/
    └── DeployMultiSig.s.sol       # BUAT — deploy script
```

---

### Task 1: Buat direktori multi-sig dan scaffolding test

**File:**
- Buat: `contracts/src/multisig/MultiSigWallet.sol` (scaffolding kosong)
- Buat: `contracts/test/multisig/MultiSigWallet.t.sol` (scaffolding test)

- [ ] **Langkah 1: Buat struktur direktori**

```bash
mkdir -p contracts/src/multisig contracts/test/multisig
```

- [ ] **Langkah 2: Tulis kontrak kosong dengan NatSpec dan errors (belum ada logika)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigWallet
 * @notice N-of-M multi-signature wallet. Membutuhkan `required` dari `owners` persetujuan
 *         sebelum sebuah transaksi dapat dieksekusi.
 */
contract MultiSigWallet {
    error NotOwner();
    error TxNotExist();
    error TxAlreadyExecuted();
    error TxAlreadyConfirmed();
    error NotEnoughConfirmations();
    error NotConfirmed();
    error ExecutionFailed();
    error InvalidOwner();
    error InvalidRequired();
    error DuplicateOwner();
    error OwnerNotFound();
}
```

File: `contracts/src/multisig/MultiSigWallet.sol`

- [ ] **Langkah 3: Tulis file test dengan setUp dan test gagal pertama**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";

contract MultiSigWalletTest is Test {
    MultiSigWallet public wallet;

    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);
    address public stranger = address(0x99);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;
        wallet = new MultiSigWallet(owners, 2);
    }
}
```

File: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 4: Jalankan test untuk verifikasi build terkompilasi**

```bash
cd contracts && forge test -vvv
```

Ekspektasi: compile failure — `Constructor args not found on MultiSigWallet`.

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/multisig/ contracts/test/multisig/
git commit -m "chore: scaffold MultiSigWallet contract and test files"
```

---

### Task 2: Implementasi logika deploy (constructor, owners, required)

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`

- [ ] **Langkah 1: Tulis test untuk deploy sukses**

Tambahkan ke `MultiSigWallet.t.sol`:

```solidity
function test_Deploy_Success() public {
    assertEq(wallet.required(), 2);
    address[] memory owners = wallet.getOwners();
    assertEq(owners.length, 3);
    assertEq(owners[0], owner1);
    assertEq(owners[1], owner2);
    assertEq(owners[2], owner3);
    assertTrue(wallet.isOwner(owner1));
    assertTrue(wallet.isOwner(owner2));
    assertTrue(wallet.isOwner(owner3));
    assertFalse(wallet.isOwner(stranger));
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_Deploy_Success -vvv
```

Ekspektasi: FAIL — `required` dan `getOwners` tidak terdefinisi.

- [ ] **Langkah 3: Implementasi constructor, storage, dan view functions**

Ganti body kontrak kosong dengan:

```solidity
contract MultiSigWallet {
    // ---- Custom Errors ----
    error NotOwner();
    error TxNotExist();
    error TxAlreadyExecuted();
    error TxAlreadyConfirmed();
    error NotEnoughConfirmations();
    error NotConfirmed();
    error ExecutionFailed();
    error InvalidOwner();
    error InvalidRequired();
    error DuplicateOwner();
    error OwnerNotFound();
    error CannotRemoveLastOwner();

    // ---- Storage ----
    address[] public owners;
    uint256 public required;
    mapping(address => bool) public isOwner;

    // ---- Events ----
    event WalletCreated(address[] owners, uint256 required);
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed removedOwner);
    event RequirementChanged(uint256 newRequired);

    // ---- Modifiers ----
    modifier onlyOwner_() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier txExists(uint256 txIndex) {
        if (txIndex >= transactions.length) revert TxNotExist();
        _;
    }

    modifier notExecuted(uint256 txIndex) {
        if (transactions[txIndex].executed) revert TxAlreadyExecuted();
        _;
    }

    modifier notConfirmed(uint256 txIndex) {
        if (isConfirmed[txIndex][msg.sender]) revert TxAlreadyConfirmed();
        _;
    }

    // ---- Constructor ----
    constructor(address[] memory _owners, uint256 _required) {
        if (_owners.length == 0) revert InvalidOwner();
        if (_required == 0 || _required > _owners.length) revert InvalidRequired();

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            if (owner == address(0)) revert InvalidOwner();
            if (isOwner[owner]) revert DuplicateOwner();
            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
        emit WalletCreated(_owners, _required);
    }

    // ---- View Functions ----
    function getOwners() external view returns (address[] memory) {
        return owners;
    }
}
```

File: `contracts/src/multisig/MultiSigWallet.sol`

- [ ] **Langkah 4: Jalankan test — verifikasi lulus**

```bash
cd contracts && forge test --match-test test_Deploy_Success -vvv
```

Ekspektasi: PASS.

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: implement MultiSigWallet constructor with owner validation"
```

---

### Task 3: Validasi deploy — test revert

**File:**
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test revert**

Tambahkan ke file test:

```solidity
function test_Deploy_RevertIf_NoOwners() public {
    address[] memory emptyOwners = new address[](0);
    vm.expectRevert(MultiSigWallet.InvalidOwner.selector);
    new MultiSigWallet(emptyOwners, 1);
}

function test_Deploy_RevertIf_InvalidRequired_Zero() public {
    address[] memory owners = new address[](2);
    owners[0] = owner1;
    owners[1] = owner2;
    vm.expectRevert(MultiSigWallet.InvalidRequired.selector);
    new MultiSigWallet(owners, 0);
}

function test_Deploy_RevertIf_InvalidRequired_TooHigh() public {
    address[] memory owners = new address[](2);
    owners[0] = owner1;
    owners[1] = owner2;
    vm.expectRevert(MultiSigWallet.InvalidRequired.selector);
    new MultiSigWallet(owners, 3);
}

function test_Deploy_RevertIf_ZeroAddressOwner() public {
    address[] memory owners = new address[](2);
    owners[0] = owner1;
    owners[1] = address(0);
    vm.expectRevert(MultiSigWallet.InvalidOwner.selector);
    new MultiSigWallet(owners, 2);
}

function test_Deploy_RevertIf_DuplicateOwner() public {
    address[] memory owners = new address[](3);
    owners[0] = owner1;
    owners[1] = owner2;
    owners[2] = owner1; // duplikat
    vm.expectRevert(MultiSigWallet.DuplicateOwner.selector);
    new MultiSigWallet(owners, 2);
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-contract MultiSigWalletTest -vvv
```

Ekspektasi: 6 test PASS (1 deploy sukses + 5 test revert).

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "test: add deploy validation revert tests for MultiSigWallet"
```

---

### Task 4: Implementasi receive() dan Deposit event

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test deposit**

Tambahkan ke file test:

```solidity
function test_Deposit_EmitsEvent() public {
    vm.deal(stranger, 1 ether);

    vm.prank(stranger);
    (bool ok,) = address(wallet).call{value: 0.5 ether}("");
    assertTrue(ok);
    assertEq(address(wallet).balance, 0.5 ether);
}

function test_Deposit_ReceiveFunction() public {
    vm.deal(stranger, 1 ether);

    vm.prank(stranger);
    (bool ok,) = address(wallet).call{value: 0.3 ether}("");
    assertTrue(ok);
    assertEq(address(wallet).balance, 0.3 ether);
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_Deposit -vvv
```

Ekspektasi: PASS (receive sudah bekerja secara default di Solidity, tapi kami ingin pengecekan event). Sebenarnya ini harus lulus karena `receive()` bersifat implisit. Test berjalan dengan baik.

- [ ] **Langkah 3: Tambah explicit receive() dengan event**

Tambahkan ke body kontrak (setelah constructor):

```solidity
receive() external payable {
    emit Deposit(msg.sender, msg.value, address(this).balance);
}
```

- [ ] **Langkah 4: Update test untuk memeriksa event**

```solidity
function test_Deposit_EmitsEvent() public {
    vm.deal(stranger, 1 ether);

    vm.prank(stranger);
    vm.expectEmit(true, false, false, true);
    emit Deposit(stranger, 0.5 ether, 0.5 ether);
    (bool ok,) = address(wallet).call{value: 0.5 ether}("");
    assertTrue(ok);
    assertEq(address(wallet).balance, 0.5 ether);
}
```

- [ ] **Langkah 5: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-test test_Deposit -vvv
```

Ekspektasi: 2 PASS.

- [ ] **Langkah 6: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add receive() with Deposit event to MultiSigWallet"
```

---

### Task 5: Implementasi submitTransaction

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test submit**

Tambahkan ke file test:

```solidity
function test_Submit_Success() public {
    vm.prank(owner1);
    uint256 txIndex = wallet.submitTransaction(address(0x10), 1 ether, "");
    assertEq(txIndex, 0);
    assertEq(wallet.getTransactionCount(), 1);

    (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations) =
        wallet.getTransaction(0);
    assertEq(to, address(0x10));
    assertEq(value, 1 ether);
    assertEq(data, "");
    assertFalse(executed);
    assertEq(numConfirmations, 1); // submitter auto-approves
}

function test_Submit_AutoConfirmsBySubmitter() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 0, "");
    assertTrue(wallet.isConfirmed(0, owner1));
}

function test_Submit_RevertIf_NotOwner() public {
    vm.prank(stranger);
    vm.expectRevert(MultiSigWallet.NotOwner.selector);
    wallet.submitTransaction(address(0x10), 0, "");
}

function test_Submit_IncrementsTxIndex() public {
    vm.startPrank(owner1);
    wallet.submitTransaction(address(0x10), 0, "");
    wallet.submitTransaction(address(0x11), 0, "");
    wallet.submitTransaction(address(0x12), 0, "");
    vm.stopPrank();
    assertEq(wallet.getTransactionCount(), 3);
}

function test_Submit_WithCalldata() public {
    bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", owner2, 100);
    vm.prank(owner1);
    uint256 txIndex = wallet.submitTransaction(address(0x10), 0, data);
    (,, bytes memory storedData,,) = wallet.getTransaction(txIndex);
    assertEq(storedData, data);
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_Submit -vvv
```

Ekspektasi: FAIL — `submitTransaction` belum diimplementasi.

- [ ] **Langkah 3: Tambah Transaction struct dan submitTransaction**

Tambahkan ke kontrak (setelah storage owner):

```solidity
struct Transaction {
    address to;
    uint96 value;
    bytes data;
    bool executed;
    uint256 numConfirmations;
}

Transaction[] public transactions;
mapping(uint256 => mapping(address => bool)) public isConfirmed;

event SubmitTransaction(
    address indexed owner,
    uint256 indexed txIndex,
    address indexed to,
    uint256 value,
    bytes data
);
```

Tambahkan sebelum `getOwners()`:

```solidity
function submitTransaction(
    address to,
    uint256 value,
    bytes calldata data
) external onlyOwner_ returns (uint256 txIndex) {
    txIndex = transactions.length;
    transactions.push(
        Transaction({
            to: to,
            value: uint96(value),
            data: data,
            executed: false,
            numConfirmations: 1
        })
    );
    isConfirmed[txIndex][msg.sender] = true;

    emit SubmitTransaction(msg.sender, txIndex, to, value, data);
}

function getTransactionCount() external view returns (uint256) {
    return transactions.length;
}

function getTransaction(
    uint256 txIndex
)
    external
    view
    txExists(txIndex)
    returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)
{
    Transaction storage t = transactions[txIndex];
    return (t.to, t.value, t.data, t.executed, t.numConfirmations);
}
```

- [ ] **Langkah 4: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-test test_Submit -vvv
```

Ekspektasi: 5 PASS.

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add submitTransaction with auto-confirm by submitter"
```

---

### Task 6: Implementasi confirmTransaction

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test confirm**

Tambahkan ke file test:

```solidity
function test_Confirm_Success() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 1 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    assertTrue(wallet.isConfirmed(0, owner2));
    (,,, bool executed, uint256 numConfirmations) = wallet.getTransaction(0);
    assertFalse(executed);
    assertEq(numConfirmations, 2);
}

function test_Confirm_RevertIf_NotOwner() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 0, "");

    vm.prank(stranger);
    vm.expectRevert(MultiSigWallet.NotOwner.selector);
    wallet.confirmTransaction(0);
}

function test_Confirm_RevertIf_AlreadyConfirmed() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 0, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner2);
    vm.expectRevert(MultiSigWallet.TxAlreadyConfirmed.selector);
    wallet.confirmTransaction(0);
}

function test_Confirm_RevertIf_TxNotExist() public {
    vm.prank(owner1);
    vm.expectRevert(MultiSigWallet.TxNotExist.selector);
    wallet.confirmTransaction(99);
}

function test_Confirm_RevertIf_AlreadyExecuted() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(owner1), 1 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    // Eksekusi: 2 dari 3 menyetujui
    vm.prank(owner1);
    wallet.executeTransaction(0);

    vm.prank(owner3);
    vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
    wallet.confirmTransaction(0);
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_Confirm -vvv
```

Ekspektasi: FAIL — `confirmTransaction` dan `executeTransaction` belum diimplementasi.

- [ ] **Langkah 3: Tambah confirmTransaction**

Tambahkan sebelum `getOwners()`:

```solidity
event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);

function confirmTransaction(
    uint256 txIndex
) external onlyOwner_ txExists(txIndex) notExecuted(txIndex) notConfirmed(txIndex) {
    isConfirmed[txIndex][msg.sender] = true;
    unchecked {
        transactions[txIndex].numConfirmations++;
    }
    emit ConfirmTransaction(msg.sender, txIndex);
}
```

Juga tambahkan placeholder untuk `executeTransaction` (test membutuhkannya):

```solidity
event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

function executeTransaction(
    uint256 txIndex
) external txExists(txIndex) notExecuted(txIndex) {
    // Stub — akan diimplementasi penuh di Task 7
    if (transactions[txIndex].numConfirmations < required) revert NotEnoughConfirmations();
    transactions[txIndex].executed = true;
    emit ExecuteTransaction(msg.sender, txIndex);
}
```

- [ ] **Langkah 4: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-test test_Confirm -vvv
```

Ekspektasi: 5 PASS.

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add confirmTransaction with access control and state validation"
```

---

### Task 7: Implementasi executeTransaction (transfer ETH)

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test execute**

Tambahkan ke file test:

```solidity
function test_Execute_Success_ETHTransfer() public {
    // Danai wallet
    vm.deal(address(wallet), 2 ether);

    // Owner1 submit transfer ke penerima
    address recipient = address(0x50);
    vm.prank(owner1);
    wallet.submitTransaction(recipient, 1 ether, "");

    // Owner2 konfirmasi
    vm.prank(owner2);
    wallet.confirmTransaction(0);

    uint256 recipientBalBefore = recipient.balance;

    // Siapa saja bisa execute setelah threshold terpenuhi
    vm.prank(stranger);
    wallet.executeTransaction(0);

    assertEq(recipient.balance, recipientBalBefore + 1 ether);
    (,,, bool executed,) = wallet.getTransaction(0);
    assertTrue(executed);
}

function test_Execute_RevertIf_NotEnoughConfirmations() public {
    vm.deal(address(wallet), 1 ether);
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 0.5 ether, "");

    // Hanya 1 dari 2 yang dibutuhkan
    vm.prank(owner1);
    vm.expectRevert(MultiSigWallet.NotEnoughConfirmations.selector);
    wallet.executeTransaction(0);
}

function test_Execute_RevertIf_AlreadyExecuted() public {
    vm.deal(address(wallet), 1 ether);
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 0.5 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    vm.prank(owner1);
    vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
    wallet.executeTransaction(0);
}

function test_Execute_RevertIf_TxNotExist() public {
    vm.prank(owner1);
    vm.expectRevert(MultiSigWallet.TxNotExist.selector);
    wallet.executeTransaction(99);
}

function test_Execute_CanBeCalledByAnyone() public {
    vm.deal(address(wallet), 1 ether);
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 0.5 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    // Orang asing mengeksekusi
    vm.prank(stranger);
    wallet.executeTransaction(0);

    assertTrue(transactions[0].executed);
}

function test_Execute_FailedCall_DoesNotMarkExecuted() public {
    vm.deal(address(wallet), 1 ether);
    // Submit tx ke alamat tanpa kode yang akan revert
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 2 ether, ""); // lebih dari saldo

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    // Harus revert karena saldo tidak mencukupi
    vm.expectRevert(MultiSigWallet.ExecutionFailed.selector);
    wallet.executeTransaction(0);

    (,,, bool executed,) = wallet.getTransaction(0);
    assertFalse(executed);
}

function test_Execute_WithCalldata() public {
    // Deploy kontrak penerima sederhana
    TestReceiver receiver = new TestReceiver();
    vm.deal(address(wallet), 1 ether);

    bytes memory data = abi.encodeWithSignature("receiveData(uint256)", 42);
    vm.prank(owner1);
    wallet.submitTransaction(address(receiver), 0, data);

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    assertEq(receiver.lastValue(), 42);
}
```

- [ ] **Langkah 2: Tambah kontrak helper TestReceiver di bagian bawah file test**

```solidity
contract TestReceiver {
    uint256 public lastValue;

    function receiveData(uint256 value) external {
        lastValue = value;
    }

    receive() external payable {}
}
```

- [ ] **Langkah 3: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_Execute_Success -vvv
```

Ekspektasi: FAIL — executeTransaction masih stub, tidak benar-benar mengirim ETH.

- [ ] **Langkah 4: Implementasi executeTransaction penuh dengan pola CEI**

Ganti stub `executeTransaction`:

```solidity
function executeTransaction(
    uint256 txIndex
) external txExists(txIndex) notExecuted(txIndex) {
    Transaction storage t = transactions[txIndex];

    if (t.numConfirmations < required) revert NotEnoughConfirmations();

    // Checks-Effects-Interactions
    t.executed = true;

    (bool success, ) = t.to.call{value: t.value}(t.data);
    if (!success) revert ExecutionFailed();

    emit ExecuteTransaction(msg.sender, txIndex);
}
```

Catatan: kontrak menggunakan array internal `transactions` langsung di test `test_Execute_CanBeCalledByAnyone`. Itu tidak akan berfungsi — `transactions` tidak terlihat. Perbaiki test:

```solidity
function test_Execute_CanBeCalledByAnyone() public {
    vm.deal(address(wallet), 1 ether);
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 0.5 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    // Orang asing mengeksekusi
    vm.prank(stranger);
    wallet.executeTransaction(0);

    (,,, bool executed,) = wallet.getTransaction(0);
    assertTrue(executed);
}
```

- [ ] **Langkah 5: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-test test_Execute -vvv
```

Ekspektasi: 7 PASS.

- [ ] **Langkah 6: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: implement executeTransaction with CEI pattern for ETH and calldata"
```

---

### Task 8: Implementasi revokeConfirmation

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test revoke**

Tambahkan ke file test:

```solidity
function test_Revoke_Success() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 1 ether, "");

    assertTrue(wallet.isConfirmed(0, owner1));

    vm.prank(owner1);
    wallet.revokeConfirmation(0);

    assertFalse(wallet.isConfirmed(0, owner1));
    (,,, bool executed, uint256 numConfirmations) = wallet.getTransaction(0);
    assertFalse(executed);
    assertEq(numConfirmations, 0);
}

function test_Revoke_RevertIf_NotConfirmed() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 0, "");

    vm.prank(owner2);
    vm.expectRevert(MultiSigWallet.NotConfirmed.selector);
    wallet.revokeConfirmation(0);
}

function test_Revoke_RevertIf_TxNotExist() public {
    vm.prank(owner1);
    vm.expectRevert(MultiSigWallet.TxNotExist.selector);
    wallet.revokeConfirmation(99);
}

function test_Revoke_RevertIf_AlreadyExecuted() public {
    vm.deal(address(wallet), 1 ether);
    vm.prank(owner1);
    wallet.submitTransaction(address(owner1), 1 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    vm.prank(owner2);
    vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
    wallet.revokeConfirmation(0);
}

function test_Revoke_AndReapprove() public {
    vm.prank(owner1);
    wallet.submitTransaction(address(0x10), 1 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    // Owner2 membatalkan
    vm.prank(owner2);
    wallet.revokeConfirmation(0);
    assertEq(getConfirmationCount(0), 1);

    // Owner2 menyetujui lagi
    vm.prank(owner2);
    wallet.confirmTransaction(0);
    assertEq(getConfirmationCount(0), 2);
}
```

Tambahkan helper:

```solidity
function getConfirmationCount(uint256 txIndex) internal view returns (uint256) {
    (,,, bool executed, uint256 count) = wallet.getTransaction(txIndex);
    require(!executed);
    return count;
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_Revoke -vvv
```

Ekspektasi: FAIL — `revokeConfirmation` belum diimplementasi.

- [ ] **Langkah 3: Tambah revokeConfirmation**

Tambahkan setelah `confirmTransaction`:

```solidity
event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);

function revokeConfirmation(
    uint256 txIndex
) external onlyOwner_ txExists(txIndex) notExecuted(txIndex) {
    if (!isConfirmed[txIndex][msg.sender]) revert NotConfirmed();

    isConfirmed[txIndex][msg.sender] = false;
    unchecked {
        transactions[txIndex].numConfirmations--;
    }

    emit RevokeConfirmation(msg.sender, txIndex);
}
```

- [ ] **Langkah 4: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-test test_Revoke -vvv
```

Ekspektasi: 5 PASS.

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add revokeConfirmation with re-approval support"
```

---

### Task 9: Integration test full flow (wallet 2-of-3)

**File:**
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test full flow**

Tambahkan ke file test:

```solidity
function test_FullFlow_2of3_Wallet() public {
    // Setup: wallet 2-of-3, didanai 3 ETH
    vm.deal(address(wallet), 3 ether);
    address alice = owner1;
    address bob = owner2;
    address charlie = owner3;
    address recipient = address(0x50);

    // Alice submit: kirim 1,5 ETH ke penerima
    vm.prank(alice);
    uint256 tx1 = wallet.submitTransaction(recipient, 1.5 ether, "");
    assertEq(tx1, 0);

    // Bob submit: kirim 0,5 ETH ke penerima
    vm.prank(bob);
    uint256 tx2 = wallet.submitTransaction(recipient, 0.5 ether, "");
    assertEq(tx2, 1);

    // Charlie konfirmasi tx1
    vm.prank(charlie);
    wallet.confirmTransaction(0);

    // Eksekusi tx1 (alice + charlie = 2)
    uint256 recipientBalBefore = recipient.balance;
    vm.prank(alice);
    wallet.executeTransaction(0);
    assertEq(recipient.balance, recipientBalBefore + 1.5 ether);

    // Alice konfirmasi tx2
    vm.prank(alice);
    wallet.confirmTransaction(1);

    // Eksekusi tx2 (bob + alice = 2)
    vm.prank(bob);
    wallet.executeTransaction(1);
    assertEq(recipient.balance, recipientBalBefore + 2 ether);

    // Saldo wallet harus 1 ETH
    assertEq(address(wallet).balance, 1 ether);
    assertEq(wallet.getTransactionCount(), 2);
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi lulus**

```bash
cd contracts && forge test --match-test test_FullFlow_2of3_Wallet -vvv
```

Ekspektasi: PASS.

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "test: add full flow 2-of-3 wallet integration test"
```

---

### Task 10: Manajemen pemilik — addOwner + removeOwner via proposal internal

**File:**
- Modifikasi: `contracts/src/multisig/MultiSigWallet.sol`
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test manajemen pemilik**

Tambahkan ke file test:

```solidity
function test_AddOwner_ViaMultiSig() public {
    address newOwner = address(0x99);

    // Submit proposal: addOwner dienkode sebagai calldata ke diri sendiri
    bytes memory data = abi.encodeWithSignature("addOwner(address)", newOwner);
    vm.prank(owner1);
    wallet.submitTransaction(address(wallet), 0, data);

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    assertTrue(wallet.isOwner(newOwner));
    assertEq(wallet.getOwners().length, 4);
}

function test_RemoveOwner_ViaMultiSig() public {
    // Submit proposal: removeOwner
    bytes memory data = abi.encodeWithSignature("removeOwner(address)", owner3);
    vm.prank(owner1);
    wallet.submitTransaction(address(wallet), 0, data);

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    assertFalse(wallet.isOwner(owner3));
    assertEq(wallet.getOwners().length, 2);
}

function test_ChangeThreshold_ViaMultiSig() public {
    bytes memory data = abi.encodeWithSignature("changeRequirement(uint256)", 3);
    vm.prank(owner1);
    wallet.submitTransaction(address(wallet), 0, data);

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner3);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    assertEq(wallet.required(), 3);
}

function test_RemoveOwner_RevertIf_ThresholdWouldBreak() public {
    // Wallet 2-of-3, menghapus satu pemilik akan menjadikannya 2-of-2 (valid)
    // Tapi jika kita mencoba membuat state 3-of-2...
    // Sebenarnya mari test: hapus pemilik dan threshold menjadi tidak valid
    // 2-of-3 → hapus 1 → 2-of-2 OK. Mari test ubah threshold ke > jumlah pemilik

    // Ubah ke 4-of-3 (tidak valid)
    bytes memory data = abi.encodeWithSignature("changeRequirement(uint256)", 4);
    vm.prank(owner1);
    wallet.submitTransaction(address(wallet), 0, data);

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    vm.expectRevert(MultiSigWallet.InvalidRequired.selector);
    wallet.executeTransaction(0);
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi gagal**

```bash
cd contracts && forge test --match-test test_AddOwner -vvv
```

Ekspektasi: FAIL — `addOwner` belum diimplementasi.

- [ ] **Langkah 3: Tambah addOwner, removeOwner, changeRequirement**

Tambahkan ke body kontrak (setelah confirmTransaction):

```solidity
function addOwner(address newOwner) external onlyOwner_ {
    if (newOwner == address(0)) revert InvalidOwner();
    if (isOwner[newOwner]) revert DuplicateOwner();

    isOwner[newOwner] = true;
    owners.push(newOwner);

    emit OwnerAdded(newOwner);
}

function removeOwner(address owner) external onlyOwner_ {
    if (!isOwner[owner]) revert OwnerNotFound();
    if (owners.length == 1) revert CannotRemoveLastOwner();

    isOwner[owner] = false;

    // Hapus dari array (urutan tidak penting — swap and pop)
    for (uint256 i = 0; i < owners.length; i++) {
        if (owners[i] == owner) {
            owners[i] = owners[owners.length - 1];
            owners.pop();
            break;
        }
    }

    if (required > owners.length) revert InvalidRequired();

    emit OwnerRemoved(owner);
}

function changeRequirement(uint256 newRequired) external onlyOwner_ {
    if (newRequired == 0 || newRequired > owners.length) revert InvalidRequired();
    required = newRequired;
    emit RequirementChanged(newRequired);
}
```

- [ ] **Langkah 4: Jalankan test — verifikasi semua lulus**

```bash
cd contracts && forge test --match-test "test_AddOwner|test_RemoveOwner|test_ChangeThreshold" -vvv
```

Ekspektasi: 4 PASS.

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add owner management (add/remove/changeThreshold) via internal proposals"
```

---

### Task 11: Test dukungan ERC-20

**File:**
- Modifikasi: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Langkah 1: Tulis test transfer ERC-20 menggunakan mock token**

Tambahkan ke file test:

```solidity
function test_ERC20_Transfer() public {
    // Deploy mock ERC-20 dan mint ke wallet
    MockERC20 token = new MockERC20("Test", "TST");
    token.mint(address(wallet), 1000 ether);

    address recipient = address(0x60);
    bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", recipient, 300 ether);

    vm.prank(owner1);
    wallet.submitTransaction(address(token), 0, data);

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    wallet.executeTransaction(0);

    assertEq(token.balanceOf(recipient), 300 ether);
    assertEq(token.balanceOf(address(wallet)), 700 ether);
}
```

Tambahkan MockERC20 di bagian bawah file test:

```solidity
contract MockERC20 {
    string public name;
    string public symbol;
    mapping(address => uint256) public balanceOf;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi lulus**

```bash
cd contracts && forge test --match-test test_ERC20_Transfer -vvv
```

Ekspektasi: PASS.

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "test: add ERC-20 transfer via multi-sig test with mock token"
```

---

### Task 12: Fuzz testing

**File:**
- Buat: `contracts/test/multisig/MultiSigWallet.fuzz.t.sol`

- [ ] **Langkah 1: Tulis file fuzz test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";

contract MultiSigWalletFuzzTest is Test {
    MultiSigWallet public wallet;
    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;
        wallet = new MultiSigWallet(owners, 2);
        vm.deal(address(wallet), 100 ether);
    }

    /// forge-config: default.fuzz.runs = 500
    function testFuzz_Submit_AnyCalldata(address to, uint96 value) public {
        vm.assume(to != address(0));

        bytes memory data = abi.encode(value);
        vm.prank(owner1);
        uint256 idx = wallet.submitTransaction(to, value, data);

        (address storedTo, uint256 storedValue, bytes memory storedData,,) =
            wallet.getTransaction(idx);
        assertEq(storedTo, to);
        assertEq(storedValue, value);
        assertEq(storedData, data);
    }

    /// forge-config: default.fuzz.runs = 200
    function testFuzz_Required_ValidRange(uint8 required, uint8 ownerCount) public {
        vm.assume(ownerCount >= 1 && ownerCount <= 10);
        vm.assume(required >= 1 && required <= ownerCount);

        address[] memory owners = new address[](ownerCount);
        for (uint8 i = 0; i < ownerCount; i++) {
            owners[i] = address(uint160(uint256(keccak256(abi.encode(i)))));
        }

        MultiSigWallet w = new MultiSigWallet(owners, required);
        assertEq(w.required(), required);
        assertEq(w.getOwners().length, ownerCount);
    }

    /// forge-config: default.fuzz.runs = 200
    function testFuzz_Execute_ETHTransfer(uint96 value) public {
        vm.assume(value > 0 && value <= 100 ether);

        vm.prank(owner1);
        wallet.submitTransaction(owner2, value, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        uint256 balBefore = owner2.balance;
        wallet.executeTransaction(0);
        assertEq(owner2.balance, balBefore + value);
    }

    /// forge-config: default.fuzz.runs = 200
    function testFuzz_RevokeAndReconfirm(uint96 value) public {
        vm.assume(value <= 100 ether);

        vm.prank(owner1);
        wallet.submitTransaction(owner2, value, "");

        // Owner1 membatalkan auto-confirmation-nya
        vm.prank(owner1);
        wallet.revokeConfirmation(0);
        (,,, bool executed, uint256 count) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(count, 0);

        // Owner1 konfirmasi ulang, owner2 konfirmasi
        vm.prank(owner1);
        wallet.confirmTransaction(0);
        vm.prank(owner2);
        wallet.confirmTransaction(0);

        // Eksekusi
        wallet.executeTransaction(0);
        (,,, bool execed,) = wallet.getTransaction(0);
        assertTrue(execed);
    }
}
```

File: `contracts/test/multisig/MultiSigWallet.fuzz.t.sol`

- [ ] **Langkah 2: Jalankan fuzz test**

```bash
cd contracts && forge test --match-contract MultiSigWalletFuzzTest -vvv
```

Ekspektasi: 4 PASS (masing-masing menjalankan 200-500 fuzz runs).

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.fuzz.t.sol
git commit -m "test: add fuzz tests for submit, deploy, execute, revoke"
```

---

### Task 13: Jalankan seluruh test suite dan cek coverage

**File:**
- Tidak ada (hanya verifikasi)

- [ ] **Langkah 1: Jalankan semua test MultiSigWallet**

```bash
cd contracts && forge test --match-path test/multisig/* -vvv
```

Ekspektasi: semua test PASS (unit + integration + fuzz, ~30 test).

- [ ] **Langkah 2: Jalankan forge coverage**

```bash
cd contracts && forge coverage --report lcov --report-file lcov.info
```

- [ ] **Langkah 3: Cek ringkasan coverage**

```bash
cd contracts && forge coverage --report summary
```

Ekspektasi: MultiSigWallet.sol cakupan baris ≥ 95%.

- [ ] **Langkah 4: Jalankan test existing untuk konfirmasi tidak ada regresi**

```bash
cd contracts && forge test -vvv
```

Ekspektasi: semua test existing (AnalysisRegistry, ReportSBT) masih PASS.

- [ ] **Langkah 5: Commit**

```bash
git add .
git commit -m "chore: verify full test suite passes with 95%+ coverage"
```

---

### Task 14: Buat MultiSigGovernor — scaffolding dan file test

**File:**
- Buat: `contracts/src/governance/MultiSigGovernor.sol`
- Buat: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Langkah 1: Buat direktori**

```bash
mkdir -p contracts/src/governance contracts/test/governance
```

- [ ] **Langkah 2: Tulis kontrak MultiSigGovernor**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MultiSigWallet} from "../multisig/MultiSigWallet.sol";
import {AnalysisRegistry} from "../AnalysisRegistry.sol";
import {ReportSBT} from "../ReportSBT.sol";

/**
 * @title MultiSigGovernor
 * @notice Adaptor tata kelola yang merutekan proposal multi-sig ke kontrak ChainNusa.
 *         Hanya pemilik dari MultiSigWallet yang terhubung dapat submit proposal tata kelola.
 *         Proposal dieksekusi melalui alur approve-execute MultiSigWallet.
 */
contract MultiSigGovernor {
    MultiSigWallet public immutable wallet;
    AnalysisRegistry public immutable registry;
    ReportSBT public immutable sbt;

    error NotWalletOwner();
    error ZeroAddress();

    modifier onlyWalletOwner() {
        if (!wallet.isOwner(msg.sender)) revert NotWalletOwner();
        _;
    }

    constructor(address _wallet, address _registry, address _sbt) {
        if (_wallet == address(0) || _registry == address(0) || _sbt == address(0)) {
            revert ZeroAddress();
        }
        wallet = MultiSigWallet(_wallet);
        registry = AnalysisRegistry(_registry);
        sbt = ReportSBT(_sbt);
    }

    /**
     * @notice Submit proposal untuk merekam analisis on-chain.
     * @return txIndex Index proposal di MultiSigWallet.
     */
    function proposeRecordAnalysis(
        bytes32 cidBytes,
        uint256 chainId,
        address indexedWallet
    ) external onlyWalletOwner returns (uint256 txIndex) {
        bytes memory data = abi.encodeWithSelector(
            AnalysisRegistry.recordAnalysis.selector,
            cidBytes,
            chainId,
            indexedWallet
        );
        txIndex = wallet.submitTransaction(address(registry), 0, data);
    }

    /**
     * @notice Submit proposal untuk mint ReportSBT.
     * @return txIndex Index proposal di MultiSigWallet.
     */
    function proposeMintSBT(
        address to,
        bytes32 analysisId,
        bytes32 cidBytes
    ) external onlyWalletOwner returns (uint256 txIndex) {
        bytes memory data = abi.encodeWithSelector(
            ReportSBT.mint.selector,
            to,
            analysisId,
            cidBytes
        );
        txIndex = wallet.submitTransaction(address(sbt), 0, data);
    }
}
```

File: `contracts/src/governance/MultiSigGovernor.sol`

- [ ] **Langkah 3: Tulis scaffolding test MultiSigGovernor**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";
import {MultiSigGovernor} from "../../src/governance/MultiSigGovernor.sol";
import {AnalysisRegistry} from "../../src/AnalysisRegistry.sol";
import {ReportSBT} from "../../src/ReportSBT.sol";

contract MultiSigGovernorTest is Test {
    MultiSigWallet public wallet;
    MultiSigGovernor public governor;
    AnalysisRegistry public registry;
    ReportSBT public sbt;

    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);
    address public stranger = address(0x99);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        wallet = new MultiSigWallet(owners, 2);

        registry = new AnalysisRegistry();
        sbt = new ReportSBT();

        governor = new MultiSigGovernor(address(wallet), address(registry), address(sbt));

        // Transfer kepemilikan ReportSBT ke governor agar bisa mint
        sbt.transferOwnership(address(governor));
    }
}
```

File: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Langkah 4: Jalankan test untuk verifikasi build terkompilasi**

```bash
cd contracts && forge test --match-contract MultiSigGovernorTest -vvv
```

Ekspektasi: compile success, 0 test dijalankan (belum ada fungsi test).

- [ ] **Langkah 5: Commit**

```bash
git add contracts/src/governance/ contracts/test/governance/
git commit -m "feat: scaffold MultiSigGovernor — governance adapter for AnalysisRegistry & ReportSBT"
```

---

### Task 15: MultiSigGovernor — test proposeRecordAnalysis

**File:**
- Modifikasi: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Langkah 1: Tulis test proposeRecordAnalysis**

Tambahkan ke file test:

```solidity
function test_ProposeRecordAnalysis() public {
    bytes32 cid = bytes32(uint256(0x1234));
    address analyzedWallet = address(0x50);

    vm.prank(owner1);
    uint256 txIndex = governor.proposeRecordAnalysis(cid, 1, analyzedWallet);

    // Proposal dibuat di MultiSigWallet
    assertEq(wallet.getTransactionCount(), 1);
    (address to, uint256 value,, bool executed,) = wallet.getTransaction(txIndex);
    assertEq(to, address(registry));
    assertEq(value, 0);
    assertFalse(executed);
}

function test_ProposeRecordAnalysis_RevertIf_NotOwner() public {
    bytes32 cid = bytes32(uint256(0x1234));
    vm.prank(stranger);
    vm.expectRevert(MultiSigGovernor.NotWalletOwner.selector);
    governor.proposeRecordAnalysis(cid, 1, address(0x50));
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi lulus**

```bash
cd contracts && forge test --match-test test_ProposeRecordAnalysis -vvv
```

Ekspektasi: 2 PASS.

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/governance/MultiSigGovernor.t.sol
git commit -m "test: add proposeRecordAnalysis tests for MultiSigGovernor"
```

---

### Task 16: MultiSigGovernor — test proposeMintSBT

**File:**
- Modifikasi: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Langkah 1: Tulis test proposeMintSBT**

Tambahkan ke file test:

```solidity
function test_ProposeMintSBT() public {
    bytes32 analysisId = keccak256("analysis-1");
    bytes32 cid = bytes32(uint256(0xabcd));
    address recipient = address(0x50);

    vm.prank(owner1);
    uint256 txIndex = governor.proposeMintSBT(recipient, analysisId, cid);

    assertEq(wallet.getTransactionCount(), 1);
    (address to,,, bool executed,) = wallet.getTransaction(txIndex);
    assertEq(to, address(sbt));
    assertFalse(executed);
}

function test_ProposeMintSBT_RevertIf_NotOwner() public {
    vm.prank(stranger);
    vm.expectRevert(MultiSigGovernor.NotWalletOwner.selector);
    governor.proposeMintSBT(address(0x50), bytes32(0), bytes32(0));
}
```

- [ ] **Langkah 2: Jalankan test — verifikasi lulus**

```bash
cd contracts && forge test --match-test test_ProposeMintSBT -vvv
```

Ekspektasi: 2 PASS.

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/governance/MultiSigGovernor.t.sol
git commit -m "test: add proposeMintSBT tests for MultiSigGovernor"
```

---

### Task 17: MultiSigGovernor — integration: execute recordAnalysis melalui multi-sig

**File:**
- Buat: `contracts/test/governance/MultiSigGovernor.integration.t.sol`

- [ ] **Langkah 1: Tulis integration test penuh**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";
import {MultiSigGovernor} from "../../src/governance/MultiSigGovernor.sol";
import {AnalysisRegistry} from "../../src/AnalysisRegistry.sol";
import {ReportSBT} from "../../src/ReportSBT.sol";

contract MultiSigGovernorIntegrationTest is Test {
    MultiSigWallet public wallet;
    MultiSigGovernor public governor;
    AnalysisRegistry public registry;
    ReportSBT public sbt;

    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        wallet = new MultiSigWallet(owners, 2);
        registry = new AnalysisRegistry();
        sbt = new ReportSBT();
        governor = new MultiSigGovernor(address(wallet), address(registry), address(sbt));
        sbt.transferOwnership(address(governor));
    }

    function test_FullFlow_Governance_RecordAnalysis() public {
        bytes32 cid = bytes32(uint256(0xdead));
        uint256 chainId = 1;
        address analyzedWallet = address(0x50);

        // 1. Owner1 mengusulkan recordAnalysis via governor
        vm.prank(owner1);
        uint256 txIndex = governor.proposeRecordAnalysis(cid, chainId, analyzedWallet);

        // 2. Hanya 1 dari 2 yang konfirmasi → tidak bisa execute
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.NotEnoughConfirmations.selector);
        wallet.executeTransaction(txIndex);

        // 3. Owner2 konfirmasi
        vm.prank(owner2);
        wallet.confirmTransaction(txIndex);

        // 4. Execute → recordAnalysis dipanggil di registry
        vm.prank(owner1);
        wallet.executeTransaction(txIndex);

        // 5. Verifikasi: analisis tercatat
        assertEq(registry.analysisCount(analyzedWallet), 1);
        assertEq(registry.totalAnalyses(), 1);

        bytes32[] memory analyses = registry.getAnalysesForWallet(analyzedWallet);
        assertEq(analyses.length, 1);
    }

    function test_FullFlow_Governance_MintSBT() public {
        bytes32 analysisId = bytes32(uint256(0xabcd));
        bytes32 cid = bytes32(uint256(0x7890));
        address recipient = address(0x60);

        // 1. Owner1 mengusulkan mint SBT
        vm.prank(owner1);
        uint256 txIndex = governor.proposeMintSBT(recipient, analysisId, cid);

        // 2. Owner2 konfirmasi
        vm.prank(owner2);
        wallet.confirmTransaction(txIndex);

        // 3. Execute
        vm.prank(owner3);
        wallet.executeTransaction(txIndex);

        // 4. Verifikasi: SBT di-mint ke penerima
        assertEq(sbt.balanceOf(recipient), 1);
        assertEq(sbt.tokenAnalysis(1), analysisId);
        assertEq(sbt.tokenCid(1), cid);
    }

    function test_FullFlow_Governance_CannotMintTwice() public {
        bytes32 analysisId = bytes32(uint256(0x1111));
        bytes32 cid = bytes32(uint256(0x2222));
        address recipient = address(0x70);

        // Mint pertama
        vm.prank(owner1);
        uint256 tx1 = governor.proposeMintSBT(recipient, analysisId, cid);
        vm.prank(owner2);
        wallet.confirmTransaction(tx1);
        vm.prank(owner1);
        wallet.executeTransaction(tx1);

        // Coba mint lagi sama (harus revert)
        vm.prank(owner1);
        uint256 tx2 = governor.proposeMintSBT(recipient, analysisId, cid);
        vm.prank(owner2);
        wallet.confirmTransaction(tx2);

        vm.prank(owner1);
        vm.expectRevert(); // AlreadyMinted
        wallet.executeTransaction(tx2);
    }
}
```

File: `contracts/test/governance/MultiSigGovernor.integration.t.sol`

- [ ] **Langkah 2: Jalankan integration test**

```bash
cd contracts && forge test --match-contract MultiSigGovernorIntegrationTest -vvv
```

Ekspektasi: 3 PASS.

- [ ] **Langkah 3: Commit**

```bash
git add contracts/test/governance/MultiSigGovernor.integration.t.sol
git commit -m "test: add full governance flow integration tests (recordAnalysis + mintSBT)"
```

---

### Task 18: Jalankan seluruh test suite + cek coverage akhir

**File:**
- Tidak ada (hanya verifikasi)

- [ ] **Langkah 1: Jalankan semua test**

```bash
cd contracts && forge test -vvv
```

Ekspektasi: semua test PASS (~40 test di seluruh kontrak).

- [ ] **Langkah 2: Jalankan coverage**

```bash
cd contracts && forge coverage --report summary
```

- [ ] **Langkah 3: Verifikasi tidak ada regresi pada kontrak existing**

```bash
cd contracts && forge test --match-contract AnalysisRegistryTest -vvv
cd contracts && forge test --match-contract ReportSBTTest -vvv
```

Ekspektasi: semua test existing PASS.

- [ ] **Langkah 4: Commit**

```bash
git add .
git commit -m "chore: verify complete test suite — all contracts passing with coverage"
```

---

### Task 19: Buat deploy script untuk MultiSigWallet + MultiSigGovernor

**File:**
- Buat: `contracts/script/DeployMultiSig.s.sol`

- [ ] **Langkah 1: Tulis deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MultiSigWallet} from "../src/multisig/MultiSigWallet.sol";
import {MultiSigGovernor} from "../src/governance/MultiSigGovernor.sol";
import {AnalysisRegistry} from "../src/AnalysisRegistry.sol";
import {ReportSBT} from "../src/ReportSBT.sol";

/**
 * @title DeployMultiSig
 * @notice Deploy MultiSigWallet + MultiSigGovernor, hubungkan dengan AnalysisRegistry & ReportSBT yang sudah ada.
 *
 * Penggunaan:
 *   # 1. Set env vars
 *   export DEPLOYER_PRIVATE_KEY=<key>
 *   export MULTISIG_OWNERS="0xOwner1,0xOwner2,0xOwner3"
 *   export MULTISIG_THRESHOLD=2
 *   export ANALYSIS_REGISTRY=<alamat-deployed-existing>
 *   export REPORT_SBT=<alamat-deployed-existing>
 *
 *   # 2. Deploy
 *   forge script script/DeployMultiSig.s.sol:DeployMultiSig \
 *     --rpc-url arbitrum_sepolia \
 *     --broadcast \
 *     --verify
 */
contract DeployMultiSig is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Parse pemilik yang dipisah koma dari env
        string memory ownersRaw = vm.envString("MULTISIG_OWNERS");
        address[] memory owners = parseAddresses(ownersRaw);

        uint256 threshold = vm.envUint("MULTISIG_THRESHOLD");

        address existingRegistry = vm.envAddress("ANALYSIS_REGISTRY");
        address existingSBT = vm.envAddress("REPORT_SBT");

        vm.startBroadcast(deployerKey);

        // 1. Deploy MultiSigWallet
        MultiSigWallet wallet = new MultiSigWallet(owners, threshold);
        console2.log("MultiSigWallet deployed at:", address(wallet));

        // 2. Deploy MultiSigGovernor
        MultiSigGovernor governor = new MultiSigGovernor(
            address(wallet),
            existingRegistry,
            existingSBT
        );
        console2.log("MultiSigGovernor deployed at:", address(governor));

        console2.log("---");
        console2.log("Langkah selanjutnya:");
        console2.log("1. Transfer kepemilikan AnalysisRegistry ke governor:");
        console2.log("   cast send %s 'transferOwnership(address)' %s", existingRegistry, address(governor));
        console2.log("2. Transfer kepemilikan ReportSBT ke governor:");
        console2.log("   cast send %s 'transferOwnership(address)' %s", existingSBT, address(governor));

        vm.stopBroadcast();
    }

    function parseAddresses(string memory csv) internal pure returns (address[] memory) {
        bytes memory csvBytes = bytes(csv);
        uint256 count = 1;
        for (uint256 i = 0; i < csvBytes.length; i++) {
            if (csvBytes[i] == ',') count++;
        }

        address[] memory addrs = new address[](count);
        uint256 last = 0;
        uint256 idx = 0;
        for (uint256 i = 0; i <= csvBytes.length; i++) {
            if (i == csvBytes.length || csvBytes[i] == ',') {
                bytes memory segment = new bytes(i - last);
                for (uint256 j = last; j < i; j++) {
                    segment[j - last] = csvBytes[j];
                }
                addrs[idx] = address(uint160(vm.parseUint(string(segment))));
                idx++;
                last = i + 1;
            }
        }
        return addrs;
    }
}
```

File: `contracts/script/DeployMultiSig.s.sol`

- [ ] **Langkah 2: Verifikasi kompilasi**

```bash
cd contracts && forge build
```

Ekspektasi: compile success.

- [ ] **Langkah 3: Commit**

```bash
git add contracts/script/DeployMultiSig.s.sol
git commit -m "feat: add deploy script for MultiSigWallet + MultiSigGovernor"
```

---

### Task 20: Dry-run deploy di anvil lokal

**File:**
- Tidak ada (hanya eksekusi)

- [ ] **Langkah 1: Jalankan anvil di background dan deploy lokal**

```bash
# Terminal 1
anvil &

# Terminal 2 — deploy kontrak existing dulu
cd contracts

# Deploy AnalysisRegistry + ReportSBT
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Dapatkan alamat deployed dari output, lalu deploy MultiSig
MULTISIG_OWNERS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" \
MULTISIG_THRESHOLD=2 \
ANALYSIS_REGISTRY=<addr-dari-atas> \
REPORT_SBT=<addr-dari-atas> \
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/DeployMultiSig.s.sol:DeployMultiSig \
  --rpc-url http://localhost:8545 \
  --broadcast
```

- [ ] **Langkah 2: Verifikasi deployment via cast**

```bash
# Cek state kontrak
cast call <MULTISIG_ADDRESS> "getOwners()" --rpc-url http://localhost:8545
cast call <MULTISIG_ADDRESS> "required()" --rpc-url http://localhost:8545
```

Ekspektasi: mengembalikan array owners dan threshold.

- [ ] **Langkah 3: Matikan anvil**

```bash
kill %1
```

- [ ] **Langkah 4: Commit** (jika ada perubahan .env)

Tidak ada perubahan kode yang diperlukan.

---

## Checklist Verifikasi

Sebelum menyatakan implementasi selesai, pastikan:

- [ ] `forge test -vvv` — semua test PASS
- [ ] `forge coverage --report summary` — cakupan baris ≥ 95%
- [ ] Test existing (AnalysisRegistry, ReportSBT) tidak ada regresi
- [ ] Deploy script terkompilasi (`forge build`)
- [ ] Semua custom errors digunakan (cek `grep "revert " src/multisig/MultiSigWallet.sol` — tidak ada string revert)

---

## Rencana Lanjutan

Setelah M1-M4 selesai:
- **M5** (Next.js frontend) — halaman `/wallet`, integrasi WAGMI, connect wallet, UI submit/approve/execute
- **M8** (Solana) — implementasi Rust/Anchor
