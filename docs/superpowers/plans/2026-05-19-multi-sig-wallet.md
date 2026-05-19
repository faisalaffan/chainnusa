# Multi-Sig Wallet — Implementation Plan (M1–M4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement modular multi-sig wallet contracts (MultiSigWallet + MultiSigGovernor) with full test coverage, deploy to Arbitrum Sepolia testnet.

**Architecture:** Modular Approach B — `MultiSigWallet.sol` (standalone N-of-M wallet: submit/approve/revoke/execute ETH + ERC-20 + generic calls) ditambah `MultiSigGovernor.sol` (adapter yang menghubungkan multi-sig ke existing `AnalysisRegistry.sol` dan `ReportSBT.sol`). Keduanya menggunakan OpenZeppelin Contracts (Ownable2Step, ReentrancyGuard).

**Tech Stack:** Solidity ^0.8.24, Foundry, OpenZeppelin Contracts, forge-std

**Prerequisites:** `contracts/` sudah ter-setup dengan Foundry + OpenZeppelin via remappings. Existing `AnalysisRegistry.sol` dan `ReportSBT.sol` sudah ada dan berfungsi.

**Scope:** Task 1–13 = M1 (MultiSigWallet + unit tests), Task 14–20 = M2 (integration + fuzz), Task 21–28 = M3 (MultiSigGovernor + tests), Task 29–33 = M4 (deploy script + testnet). Frontend (M5) dan Solana (M8) adalah follow-up plan terpisah.

---

## File Structure

```
contracts/
├── src/
│   ├── multisig/
│   │   └── MultiSigWallet.sol     # CREATE — core N-of-M wallet
│   ├── governance/
│   │   └── MultiSigGovernor.sol   # CREATE — adapter to existing contracts
│   ├── AnalysisRegistry.sol       # EXISTING — no changes
│   └── ReportSBT.sol              # EXISTING — no changes
├── test/
│   ├── multisig/
│   │   ├── MultiSigWallet.t.sol       # CREATE — unit tests
│   │   └── MultiSigWallet.fuzz.t.sol  # CREATE — fuzz tests
│   ├── governance/
│   │   ├── MultiSigGovernor.t.sol     # CREATE — unit tests
│   │   └── MultiSigGovernor.integration.t.sol  # CREATE — integration tests
│   ├── AnalysisRegistry.t.sol     # EXISTING — no changes
│   └── ReportSBT.t.sol            # EXISTING — no changes
└── script/
    └── DeployMultiSig.s.sol       # CREATE — deploy script
```

---

### Task 1: Create multi-sig directory and test scaffolding

**Files:**
- Create: `contracts/src/multisig/MultiSigWallet.sol` (empty scaffolding)
- Create: `contracts/test/multisig/MultiSigWallet.t.sol` (test scaffolding)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p contracts/src/multisig contracts/test/multisig
```

- [ ] **Step 2: Write empty contract with NatSpec and errors (no logic yet)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigWallet
 * @notice N-of-M multi-signature wallet. Requires `required` out of `owners` approvals
 *         before a transaction can be executed.
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

- [ ] **Step 3: Write test file with setUp and first failing test**

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

- [ ] **Step 4: Run test to verify build compiles**

```bash
cd contracts && forge test -vvv
```

Expected: compile failure — `Constructor args not found on MultiSigWallet`.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/multisig/ contracts/test/multisig/
git commit -m "chore: scaffold MultiSigWallet contract and test files"
```

---

### Task 2: Implement deploy logic (constructor, owners, required)

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`

- [ ] **Step 1: Write the test for successful deploy**

Add to `MultiSigWallet.t.sol`:

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

- [ ] **Step 2: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_Deploy_Success -vvv
```

Expected: FAIL — `required` and `getOwners` not defined.

- [ ] **Step 3: Implement constructor, storage, and view functions**

Replace the empty contract body with:

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

- [ ] **Step 4: Run test — verify it passes**

```bash
cd contracts && forge test --match-test test_Deploy_Success -vvv
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: implement MultiSigWallet constructor with owner validation"
```

---

### Task 3: Deploy validation — revert tests

**Files:**
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write revert tests**

Add to test file:

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
    owners[2] = owner1; // duplicate
    vm.expectRevert(MultiSigWallet.DuplicateOwner.selector);
    new MultiSigWallet(owners, 2);
}
```

- [ ] **Step 2: Run tests — verify all pass**

```bash
cd contracts && forge test --match-contract MultiSigWalletTest -vvv
```

Expected: 6 tests PASS (1 deploy success + 5 revert tests).

- [ ] **Step 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "test: add deploy validation revert tests for MultiSigWallet"
```

---

### Task 4: Implement receive() and Deposit event

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write deposit test**

Add to test file:

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

- [ ] **Step 2: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_Deposit -vvv
```

Expected: PASS (receive already works by default in Solidity, but we want the event check). Actually this should pass because `receive()` is implicit. The test runs fine.

- [ ] **Step 3: Add explicit receive() with event**

Add to contract body (after constructor):

```solidity
receive() external payable {
    emit Deposit(msg.sender, msg.value, address(this).balance);
}
```

- [ ] **Step 4: Update test to check event**

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

- [ ] **Step 5: Run tests — verify all pass**

```bash
cd contracts && forge test --match-test test_Deposit -vvv
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add receive() with Deposit event to MultiSigWallet"
```

---

### Task 5: Implement submitTransaction

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write submit tests**

Add to test file:

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

- [ ] **Step 2: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_Submit -vvv
```

Expected: FAIL — `submitTransaction` not implemented.

- [ ] **Step 3: Add Transaction struct and submitTransaction**

Add to contract (after owner storage):

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

Add before `getOwners()`:

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

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd contracts && forge test --match-test test_Submit -vvv
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add submitTransaction with auto-confirm by submitter"
```

---

### Task 6: Implement confirmTransaction

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write confirm tests**

Add to test file:

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

    // Execute: 2 of 3 approved
    vm.prank(owner1);
    wallet.executeTransaction(0);

    vm.prank(owner3);
    vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
    wallet.confirmTransaction(0);
}
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_Confirm -vvv
```

Expected: FAIL — `confirmTransaction` and `executeTransaction` not implemented.

- [ ] **Step 3: Add confirmTransaction**

Add before `getOwners()`:

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

Also add a placeholder for `executeTransaction` (test expects it):

```solidity
event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

function executeTransaction(
    uint256 txIndex
) external txExists(txIndex) notExecuted(txIndex) {
    // Stub — will be fully implemented in Task 7
    if (transactions[txIndex].numConfirmations < required) revert NotEnoughConfirmations();
    transactions[txIndex].executed = true;
    emit ExecuteTransaction(msg.sender, txIndex);
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd contracts && forge test --match-test test_Confirm -vvv
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add confirmTransaction with access control and state validation"
```

---

### Task 7: Implement executeTransaction (ETH transfer)

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write execute tests**

Add to test file:

```solidity
function test_Execute_Success_ETHTransfer() public {
    // Fund the wallet
    vm.deal(address(wallet), 2 ether);

    // Owner1 submits a transfer to recipient
    address recipient = address(0x50);
    vm.prank(owner1);
    wallet.submitTransaction(recipient, 1 ether, "");

    // Owner2 confirms
    vm.prank(owner2);
    wallet.confirmTransaction(0);

    uint256 recipientBalBefore = recipient.balance;

    // Anyone can execute once threshold met
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

    // Only 1 of 2 required
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

    // Stranger executes
    vm.prank(stranger);
    wallet.executeTransaction(0);

    assertTrue(transactions[0].executed);
}

function test_Execute_FailedCall_DoesNotMarkExecuted() public {
    vm.deal(address(wallet), 1 ether);
    // Submit tx to address with no code that will revert
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 2 ether, ""); // more than balance

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    vm.prank(owner1);
    // Should revert due to insufficient balance
    vm.expectRevert(MultiSigWallet.ExecutionFailed.selector);
    wallet.executeTransaction(0);

    (,,, bool executed,) = wallet.getTransaction(0);
    assertFalse(executed);
}

function test_Execute_WithCalldata() public {
    // Deploy a simple receiver contract
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

- [ ] **Step 2: Add TestReceiver helper contract at bottom of test file**

```solidity
contract TestReceiver {
    uint256 public lastValue;

    function receiveData(uint256 value) external {
        lastValue = value;
    }

    receive() external payable {}
}
```

- [ ] **Step 3: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_Execute_Success -vvv
```

Expected: FAIL — executeTransaction is a stub, doesn't actually send ETH.

- [ ] **Step 4: Implement full executeTransaction with CEI pattern**

Replace the stub `executeTransaction`:

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

Note: contract uses internal `transactions` array directly in the test `test_Execute_CanBeCalledByAnyone`. That won't work — `transactions` is not visible. Fix the test:

```solidity
function test_Execute_CanBeCalledByAnyone() public {
    vm.deal(address(wallet), 1 ether);
    vm.prank(owner1);
    wallet.submitTransaction(address(0x50), 0.5 ether, "");

    vm.prank(owner2);
    wallet.confirmTransaction(0);

    // Stranger executes
    vm.prank(stranger);
    wallet.executeTransaction(0);

    (,,, bool executed,) = wallet.getTransaction(0);
    assertTrue(executed);
}
```

- [ ] **Step 5: Run tests — verify all pass**

```bash
cd contracts && forge test --match-test test_Execute -vvv
```

Expected: 7 PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: implement executeTransaction with CEI pattern for ETH and calldata"
```

---

### Task 8: Implement revokeConfirmation

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write revoke tests**

Add to test file:

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

    // Owner2 revokes
    vm.prank(owner2);
    wallet.revokeConfirmation(0);
    assertEq(getConfirmationCount(0), 1);

    // Owner2 re-approves
    vm.prank(owner2);
    wallet.confirmTransaction(0);
    assertEq(getConfirmationCount(0), 2);
}
```

Add a helper:

```solidity
function getConfirmationCount(uint256 txIndex) internal view returns (uint256) {
    (,,, bool executed, uint256 count) = wallet.getTransaction(txIndex);
    require(!executed);
    return count;
}
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_Revoke -vvv
```

Expected: FAIL — `revokeConfirmation` not implemented.

- [ ] **Step 3: Add revokeConfirmation**

Add after `confirmTransaction`:

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

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd contracts && forge test --match-test test_Revoke -vvv
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add revokeConfirmation with re-approval support"
```

---

### Task 9: Full flow integration test (2-of-3 wallet)

**Files:**
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write full flow test**

Add to test file:

```solidity
function test_FullFlow_2of3_Wallet() public {
    // Setup: 2-of-3 wallet, funded with 3 ETH
    vm.deal(address(wallet), 3 ether);
    address alice = owner1;
    address bob = owner2;
    address charlie = owner3;
    address recipient = address(0x50);

    // Alice submits: send 1.5 ETH to recipient
    vm.prank(alice);
    uint256 tx1 = wallet.submitTransaction(recipient, 1.5 ether, "");
    assertEq(tx1, 0);

    // Bob submits: send 0.5 ETH to recipient
    vm.prank(bob);
    uint256 tx2 = wallet.submitTransaction(recipient, 0.5 ether, "");
    assertEq(tx2, 1);

    // Charlie confirms tx1
    vm.prank(charlie);
    wallet.confirmTransaction(0);

    // Execute tx1 (alice + charlie = 2)
    uint256 recipientBalBefore = recipient.balance;
    vm.prank(alice);
    wallet.executeTransaction(0);
    assertEq(recipient.balance, recipientBalBefore + 1.5 ether);

    // Alice confirms tx2
    vm.prank(alice);
    wallet.confirmTransaction(1);

    // Execute tx2 (bob + alice = 2)
    vm.prank(bob);
    wallet.executeTransaction(1);
    assertEq(recipient.balance, recipientBalBefore + 2 ether);

    // Wallet balance should be 1 ETH
    assertEq(address(wallet).balance, 1 ether);
    assertEq(wallet.getTransactionCount(), 2);
}
```

- [ ] **Step 2: Run test — verify it passes**

```bash
cd contracts && forge test --match-test test_FullFlow_2of3_Wallet -vvv
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "test: add full flow 2-of-3 wallet integration test"
```

---

### Task 10: Owner management — addOwner + removeOwner via internal proposals

**Files:**
- Modify: `contracts/src/multisig/MultiSigWallet.sol`
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write owner management tests**

Add to test file:

```solidity
function test_AddOwner_ViaMultiSig() public {
    address newOwner = address(0x99);

    // Submit proposal: addOwner encoded as calldata to self
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
    // 2-of-3 wallet, removing one owner would make it 2-of-2 (valid)
    // But if we try to make a 3-of-2 state...
    // Actually let's test: remove owner and threshold becomes invalid
    // 2-of-3 → remove 1 → 2-of-2 is OK. Let's test change threshold to > owners

    // Change to 4-of-3 (invalid)
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

- [ ] **Step 2: Run test — verify it fails**

```bash
cd contracts && forge test --match-test test_AddOwner -vvv
```

Expected: FAIL — `addOwner` not implemented.

- [ ] **Step 3: Add addOwner, removeOwner, changeRequirement**

Add to contract body (after confirmTransaction):

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

    // Remove from array (order doesn't matter — swap and pop)
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

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd contracts && forge test --match-test "test_AddOwner|test_RemoveOwner|test_ChangeThreshold" -vvv
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/multisig/MultiSigWallet.sol contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "feat: add owner management (add/remove/changeThreshold) via internal proposals"
```

---

### Task 11: ERC-20 support test

**Files:**
- Modify: `contracts/test/multisig/MultiSigWallet.t.sol`

- [ ] **Step 1: Write ERC-20 transfer test using mock token**

Add to test file:

```solidity
function test_ERC20_Transfer() public {
    // Deploy mock ERC-20 and mint to wallet
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

Add MockERC20 at bottom of test file:

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

- [ ] **Step 2: Run test — verify it passes**

```bash
cd contracts && forge test --match-test test_ERC20_Transfer -vvv
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.t.sol
git commit -m "test: add ERC-20 transfer via multi-sig test with mock token"
```

---

### Task 12: Fuzz testing

**Files:**
- Create: `contracts/test/multisig/MultiSigWallet.fuzz.t.sol`

- [ ] **Step 1: Write fuzz test file**

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

        // Owner1 revokes his auto-confirmation
        vm.prank(owner1);
        wallet.revokeConfirmation(0);
        (,,, bool executed, uint256 count) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(count, 0);

        // Owner1 re-confirms, owner2 confirms
        vm.prank(owner1);
        wallet.confirmTransaction(0);
        vm.prank(owner2);
        wallet.confirmTransaction(0);

        // Execute
        wallet.executeTransaction(0);
        (,,, bool execed,) = wallet.getTransaction(0);
        assertTrue(execed);
    }
}
```

File: `contracts/test/multisig/MultiSigWallet.fuzz.t.sol`

- [ ] **Step 2: Run fuzz tests**

```bash
cd contracts && forge test --match-contract MultiSigWalletFuzzTest -vvv
```

Expected: 4 PASS (each running 200-500 fuzz runs).

- [ ] **Step 3: Commit**

```bash
git add contracts/test/multisig/MultiSigWallet.fuzz.t.sol
git commit -m "test: add fuzz tests for submit, deploy, execute, revoke"
```

---

### Task 13: Run full test suite and check coverage

**Files:**
- None (verification only)

- [ ] **Step 1: Run all MultiSigWallet tests**

```bash
cd contracts && forge test --match-path test/multisig/* -vvv
```

Expected: all tests PASS (unit + integration + fuzz, ~30 tests).

- [ ] **Step 2: Run forge coverage**

```bash
cd contracts && forge coverage --report lcov --report-file lcov.info
```

- [ ] **Step 3: Check coverage summary**

```bash
cd contracts && forge coverage --report summary
```

Expected: MultiSigWallet.sol ≥ 95% line coverage.

- [ ] **Step 4: Run existing tests to confirm no regression**

```bash
cd contracts && forge test -vvv
```

Expected: all existing tests (AnalysisRegistry, ReportSBT) still PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: verify full test suite passes with 95%+ coverage"
```

---

### Task 14: Create MultiSigGovernor — scaffolding and test file

**Files:**
- Create: `contracts/src/governance/MultiSigGovernor.sol`
- Create: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Step 1: Create directory**

```bash
mkdir -p contracts/src/governance contracts/test/governance
```

- [ ] **Step 2: Write MultiSigGovernor contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MultiSigWallet} from "../multisig/MultiSigWallet.sol";
import {AnalysisRegistry} from "../AnalysisRegistry.sol";
import {ReportSBT} from "../ReportSBT.sol";

/**
 * @title MultiSigGovernor
 * @notice Governance adapter that routes multi-sig proposals to ChainNusa contracts.
 *         Only owners of the linked MultiSigWallet can submit governance proposals.
 *         Proposals are executed through the MultiSigWallet's approve-execute flow.
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
     * @notice Submit a proposal to record an analysis on-chain.
     * @return txIndex Index of the proposal in the MultiSigWallet.
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
     * @notice Submit a proposal to mint a ReportSBT.
     * @return txIndex Index of the proposal in the MultiSigWallet.
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

- [ ] **Step 3: Write MultiSigGovernor test scaffolding**

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

        // Transfer ownership of ReportSBT to governor so it can mint
        sbt.transferOwnership(address(governor));
    }
}
```

File: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Step 4: Run tests to verify build compiles**

```bash
cd contracts && forge test --match-contract MultiSigGovernorTest -vvv
```

Expected: compile success, 0 tests run (no test functions yet).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/governance/ contracts/test/governance/
git commit -m "feat: scaffold MultiSigGovernor — governance adapter for AnalysisRegistry & ReportSBT"
```

---

### Task 15: MultiSigGovernor — proposeRecordAnalysis tests

**Files:**
- Modify: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Step 1: Write proposeRecordAnalysis tests**

Add to test file:

```solidity
function test_ProposeRecordAnalysis() public {
    bytes32 cid = bytes32(uint256(0x1234));
    address analyzedWallet = address(0x50);

    vm.prank(owner1);
    uint256 txIndex = governor.proposeRecordAnalysis(cid, 1, analyzedWallet);

    // Proposal created in MultiSigWallet
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

- [ ] **Step 2: Run tests — verify pass**

```bash
cd contracts && forge test --match-test test_ProposeRecordAnalysis -vvv
```

Expected: 2 PASS.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/governance/MultiSigGovernor.t.sol
git commit -m "test: add proposeRecordAnalysis tests for MultiSigGovernor"
```

---

### Task 16: MultiSigGovernor — proposeMintSBT tests

**Files:**
- Modify: `contracts/test/governance/MultiSigGovernor.t.sol`

- [ ] **Step 1: Write proposeMintSBT tests**

Add to test file:

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

- [ ] **Step 2: Run tests — verify pass**

```bash
cd contracts && forge test --match-test test_ProposeMintSBT -vvv
```

Expected: 2 PASS.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/governance/MultiSigGovernor.t.sol
git commit -m "test: add proposeMintSBT tests for MultiSigGovernor"
```

---

### Task 17: MultiSigGovernor — integration: execute recordAnalysis through multi-sig

**Files:**
- Create: `contracts/test/governance/MultiSigGovernor.integration.t.sol`

- [ ] **Step 1: Write full integration test**

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

        // 1. Owner1 proposes recordAnalysis via governor
        vm.prank(owner1);
        uint256 txIndex = governor.proposeRecordAnalysis(cid, chainId, analyzedWallet);

        // 2. Only 1 of 2 confirmed → cannot execute
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.NotEnoughConfirmations.selector);
        wallet.executeTransaction(txIndex);

        // 3. Owner2 confirms
        vm.prank(owner2);
        wallet.confirmTransaction(txIndex);

        // 4. Execute → recordAnalysis is called on registry
        vm.prank(owner1);
        wallet.executeTransaction(txIndex);

        // 5. Verify: analysis was recorded
        assertEq(registry.analysisCount(analyzedWallet), 1);
        assertEq(registry.totalAnalyses(), 1);

        bytes32[] memory analyses = registry.getAnalysesForWallet(analyzedWallet);
        assertEq(analyses.length, 1);
    }

    function test_FullFlow_Governance_MintSBT() public {
        bytes32 analysisId = bytes32(uint256(0xabcd));
        bytes32 cid = bytes32(uint256(0x7890));
        address recipient = address(0x60);

        // 1. Owner1 proposes mint SBT
        vm.prank(owner1);
        uint256 txIndex = governor.proposeMintSBT(recipient, analysisId, cid);

        // 2. Owner2 confirms
        vm.prank(owner2);
        wallet.confirmTransaction(txIndex);

        // 3. Execute
        vm.prank(owner3);
        wallet.executeTransaction(txIndex);

        // 4. Verify: SBT minted to recipient
        assertEq(sbt.balanceOf(recipient), 1);
        assertEq(sbt.tokenAnalysis(1), analysisId);
        assertEq(sbt.tokenCid(1), cid);
    }

    function test_FullFlow_Governance_CannotMintTwice() public {
        bytes32 analysisId = bytes32(uint256(0x1111));
        bytes32 cid = bytes32(uint256(0x2222));
        address recipient = address(0x70);

        // Mint first
        vm.prank(owner1);
        uint256 tx1 = governor.proposeMintSBT(recipient, analysisId, cid);
        vm.prank(owner2);
        wallet.confirmTransaction(tx1);
        vm.prank(owner1);
        wallet.executeTransaction(tx1);

        // Try mint again same (should revert)
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

- [ ] **Step 2: Run integration tests**

```bash
cd contracts && forge test --match-contract MultiSigGovernorIntegrationTest -vvv
```

Expected: 3 PASS.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/governance/MultiSigGovernor.integration.t.sol
git commit -m "test: add full governance flow integration tests (recordAnalysis + mintSBT)"
```

---

### Task 18: Run complete test suite + final coverage check

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd contracts && forge test -vvv
```

Expected: all tests PASS (~40 tests across all contracts).

- [ ] **Step 2: Run coverage**

```bash
cd contracts && forge coverage --report summary
```

- [ ] **Step 3: Verify no regression on existing contracts**

```bash
cd contracts && forge test --match-contract AnalysisRegistryTest -vvv
cd contracts && forge test --match-contract ReportSBTTest -vvv
```

Expected: all existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: verify complete test suite — all contracts passing with coverage"
```

---

### Task 19: Create deploy script for MultiSigWallet + MultiSigGovernor

**Files:**
- Create: `contracts/script/DeployMultiSig.s.sol`

- [ ] **Step 1: Write deploy script**

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
 * @notice Deploy MultiSigWallet + MultiSigGovernor, wire up with existing AnalysisRegistry & ReportSBT.
 *
 * Usage:
 *   # 1. Set env vars
 *   export DEPLOYER_PRIVATE_KEY=<key>
 *   export MULTISIG_OWNERS="0xOwner1,0xOwner2,0xOwner3"
 *   export MULTISIG_THRESHOLD=2
 *   export ANALYSIS_REGISTRY=<existing-deployed-address>
 *   export REPORT_SBT=<existing-deployed-address>
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

        // Parse comma-separated owners from env
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
        console2.log("Next steps:");
        console2.log("1. Transfer AnalysisRegistry ownership to governor:");
        console2.log("   cast send %s 'transferOwnership(address)' %s", existingRegistry, address(governor));
        console2.log("2. Transfer ReportSBT ownership to governor:");
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

- [ ] **Step 2: Verify it compiles**

```bash
cd contracts && forge build
```

Expected: compile success.

- [ ] **Step 3: Commit**

```bash
git add contracts/script/DeployMultiSig.s.sol
git commit -m "feat: add deploy script for MultiSigWallet + MultiSigGovernor"
```

---

### Task 20: Dry-run deploy on local anvil

**Files:**
- None (execution only)

- [ ] **Step 1: Start anvil in background and deploy locally**

```bash
# Terminal 1
anvil &

# Terminal 2 — deploy existing contracts first
cd contracts

# Deploy AnalysisRegistry + ReportSBT
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Get deployed addresses from output, then deploy MultiSig
MULTISIG_OWNERS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" \
MULTISIG_THRESHOLD=2 \
ANALYSIS_REGISTRY=<addr-from-above> \
REPORT_SBT=<addr-from-above> \
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/DeployMultiSig.s.sol:DeployMultiSig \
  --rpc-url http://localhost:8545 \
  --broadcast
```

- [ ] **Step 2: Verify deployment via cast**

```bash
# Check contract state
cast call <MULTISIG_ADDRESS> "getOwners()" --rpc-url http://localhost:8545
cast call <MULTISIG_ADDRESS> "required()" --rpc-url http://localhost:8545
```

Expected: returns owners array and threshold.

- [ ] **Step 3: Kill anvil**

```bash
kill %1
```

- [ ] **Step 4: Commit** (if any .env changes made)

No code changes needed.

---

## Verification Checklist

Sebelum menyatakan implementation selesai, pastikan:

- [ ] `forge test -vvv` — all tests PASS
- [ ] `forge coverage --report summary` — ≥ 95% line coverage
- [ ] Existing tests (AnalysisRegistry, ReportSBT) no regression
- [ ] Deploy script compiles (`forge build`)
- [ ] Semua custom errors digunakan (cek `grep "revert " src/multisig/MultiSigWallet.sol` — tidak ada string revert)

---

## Follow-up Plans

Setelah M1-M4 selesai:
- **M5** (Next.js frontend) — halaman `/wallet`, WAGMI integration, connect wallet, submit/approve/execute UI
- **M8** (Solana) — Rust/Anchor implementation
