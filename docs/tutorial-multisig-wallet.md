# Tutorial: MultiSigWallet

Wallet multi-signature N-of-M. Butuh M konfirmasi dari N owner sebelum transaksi bisa dieksekusi.

## Source Code (`src/multisig/MultiSigWallet.sol`)

### Full Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MultiSigWallet {
    // -- Custom Errors --
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

    // -- Storage --
    address[] public owners;
    uint256 public required;
    mapping(address => bool) public isOwner;

    event WalletCreated(address[] owners, uint256 required);
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed removedOwner);
    event RequirementChanged(uint256 newRequired);

    // -- Transaction Storage --
    struct Transaction {
        address to;
        uint96 value;      // uint96 cukup untuk 79 billion ETH dalam wei
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    event SubmitTransaction(
        address indexed owner, uint256 indexed txIndex,
        address indexed to, uint256 value, bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

    modifier onlyOwner_() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

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

    // =============================================
    // View Functions
    // =============================================

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 txIndex) external view
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)
    {
        if (txIndex >= transactions.length) revert TxNotExist();
        Transaction storage t = transactions[txIndex];
        return (t.to, t.value, t.data, t.executed, t.numConfirmations);
    }

    // =============================================
    // Transaction Flow
    // =============================================

    function submitTransaction(
        address to, uint256 value, bytes calldata data
    ) external onlyOwner_ returns (uint256 txIndex) {
        txIndex = transactions.length;
        transactions.push(Transaction({
            to: to, value: uint96(value), data: data,
            executed: false, numConfirmations: 1
        }));
        isConfirmed[txIndex][msg.sender] = true;
        emit SubmitTransaction(msg.sender, txIndex, to, value, data);
    }

    function confirmTransaction(uint256 txIndex) external onlyOwner_ {
        if (txIndex >= transactions.length) revert TxNotExist();
        if (transactions[txIndex].executed) revert TxAlreadyExecuted();
        if (isConfirmed[txIndex][msg.sender]) revert TxAlreadyConfirmed();

        isConfirmed[txIndex][msg.sender] = true;
        unchecked { transactions[txIndex].numConfirmations++; }
        emit ConfirmTransaction(msg.sender, txIndex);
    }

    function revokeConfirmation(uint256 txIndex) external onlyOwner_ {
        if (txIndex >= transactions.length) revert TxNotExist();
        if (transactions[txIndex].executed) revert TxAlreadyExecuted();
        if (!isConfirmed[txIndex][msg.sender]) revert NotConfirmed();

        isConfirmed[txIndex][msg.sender] = false;
        unchecked { transactions[txIndex].numConfirmations--; }
        emit RevokeConfirmation(msg.sender, txIndex);
    }

    function executeTransaction(uint256 txIndex) external {
        if (txIndex >= transactions.length) revert TxNotExist();
        Transaction storage t = transactions[txIndex];

        if (t.executed) revert TxAlreadyExecuted();
        if (t.numConfirmations < required) revert NotEnoughConfirmations();

        t.executed = true; // Checks-Effects-Interactions

        (bool success, bytes memory returnData) = t.to.call{value: t.value}(t.data);
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            } else {
                revert ExecutionFailed();
            }
        }
        emit ExecuteTransaction(msg.sender, txIndex);
    }

    // =============================================
    // Owner Management (⚠️ NO access control — anyone can call)
    // =============================================

    function addOwner(address newOwner) external {
        if (newOwner == address(0)) revert InvalidOwner();
        if (isOwner[newOwner]) revert DuplicateOwner();
        isOwner[newOwner] = true;
        owners.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    function removeOwner(address owner) external {
        if (!isOwner[owner]) revert OwnerNotFound();
        if (owners.length == 1) revert CannotRemoveLastOwner();
        isOwner[owner] = false;

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

    function changeRequirement(uint256 newRequired) external {
        if (newRequired == 0 || newRequired > owners.length) revert InvalidRequired();
        required = newRequired;
        emit RequirementChanged(newRequired);
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }
}
```

## Step-by-Step Penjelasan

### Step 1 — Constructor & Owner Setup

```solidity
constructor(address[] memory _owners, uint256 _required) {
    require(_required > 0 && _required <= _owners.length);
    // Loop _owners, cek valid + no duplicate, push ke array
}
```

Contoh: 3 owners (`0xA`, `0xB`, `0xC`) dengan threshold 2 → butuh 2 dari 3 tanda tangan.

### Step 2 — Transaction Struct (Gas Optimization)

```solidity
struct Transaction {
    address to;       // 20 bytes
    uint96 value;     // 12 bytes — cukup buat semua ETH supply
    bytes data;       // dynamic
    bool executed;    // 1 byte
    uint256 numConfirmations;
}
```

Kenapa `uint96` bukan `uint256` untuk value? Solidity packing: `address` (20B) + `uint96` (12B) = 32B → 1 slot storage. Hemat gas dibanding uint256 + address = 2 slot.

### Step 3 — Submit → Confirm → Execute Flow

```
submitTransaction(to, value, data)
    │
    │  caller = owner A
    │  auto-confirm by submitter (numConfirmations = 1)
    ▼
confirmTransaction(txIndex)
    │
    │  caller = owner B
    │  numConfirmations → 2
    ▼
executeTransaction(txIndex)
    │
    │  numConfirmations (2) >= required (2)
    │  Checks-Effects-Interactions: t.executed = true dulu
    ▼
t.to.call{value: t.value}(t.data)
    │
    └── Success → Emit ExecuteTransaction
    └── Failure → Revert with original error
```

### Step 4 — Checks-Effects-Interactions Pattern

```solidity
// ✓ CHECK
if (t.executed) revert TxAlreadyExecuted();
if (t.numConfirmations < required) revert NotEnoughConfirmations();

// ✓ EFFECT (state change before external call)
t.executed = true;

// ✓ INTERACTION (external call terakhir)
(bool success, bytes memory returnData) = t.to.call{value: t.value}(t.data);
```

Ini kritis untuk keamanan: state di-set sebelum external call. Mencegah reentrancy attack.

### Step 5 — Execute Error Propagation

```solidity
if (!success) {
    if (returnData.length > 0) {
        assembly {
            revert(add(returnData, 32), mload(returnData))
        }
    } else {
        revert ExecutionFailed();
    }
}
```

Kalau target contract revert, kita propagate reason aslinya via assembly. Frontend bisa lihat error spesifik, bukan cuma "ExecutionFailed".

### Step 6 — Owner Management (⚠️ Tanpa Access Control)

`addOwner()`, `removeOwner()`, `changeRequirement()` — **siapa pun bisa panggil**. Ini by design: pemilik wallet ini dalam production adalah MultiSigGovernor contract. Untuk development/Anvil, fungsi ini berguna untuk setup manual.

Untuk production: setelah deploy, transfer ownership AnalysisRegistry + ReportSBT ke MultiSigWallet, lalu gunakan hanya melalui MultiSigGovernor.

### Step 7 — Receive Function

```solidity
receive() external payable {
    emit Deposit(msg.sender, msg.value, address(this).balance);
}
```

MultiSigWallet bisa terima ETH langsung. Emit event dengan balance after deposit.

## Cara Pakai

### Deploy

```bash
# 3 owners, butuh 2 konfirmasi
cast send --create 0x$(cat contracts/out/MultiSigWallet.sol/MultiSigWallet.json | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['bytecode']['object'])") \
  $(cast abi-encode "constructor(address[],uint256)" \
    "[0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC]" 2) \
  --rpc-url http://vps:8545 --private-key 0xac09...
```

### Submit + Confirm + Execute

```bash
WALLET=0x...  # deployed address
TARGET=0x5FbDB2315678afecb367f032d93F642f64180aa3  # AnalysisRegistry
DATA=$(cast calldata "recordAnalysis(bytes32,uint256,address)" \
  0xaaaa... 1 0xf39F...)

# 1. Owner A submits
cast send $WALLET "submitTransaction(address,uint256,bytes)" \
  $TARGET 0 $DATA --rpc-url http://vps:8545 --private-key $KEY_A

# 2. Owner B confirms (txIndex 0)
cast send $WALLET "confirmTransaction(uint256)" 0 \
  --rpc-url http://vps:8545 --private-key $KEY_B

# 3. Anyone executes
cast send $WALLET "executeTransaction(uint256)" 0 \
  --rpc-url http://vps:8545 --private-key $KEY_A
```
