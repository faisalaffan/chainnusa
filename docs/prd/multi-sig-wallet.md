# Product Requirements Document
# Multi-Signature Wallet — Cross-Chain (EVM + Solana)

**Version:** 1.0.0
**Status:** Draft
**Author:** Faisal Affan
**Last Updated:** 2026-05-19

---

## 1. Overview

### 1.1 Product Summary

A multi-signature wallet smart contract that requires approval from a minimum of N out of M owners before a transaction can be executed. Built with a **modular** architecture (Approach B) — standalone MultiSigWallet contract + MultiSigGovernor adapter to existing ChainNusa contracts (AnalysisRegistry, ReportSBT). Built as a portfolio project with production-grade quality: full test coverage, security audit, and a directly usable frontend.

### 1.2 Goals

- Demonstrate Solidity and Rust smart contract development skills
- Production-ready codebase presentable to recruiters or clients
- Modular architecture: MultiSigWallet (standalone) + MultiSigGovernor (governance for AnalysisRegistry & ReportSBT)
- Minimum 95% test coverage with forge test (EVM) and solana-test-validator (Solana)
- Full integration with the existing ChainNusa analytics platform

### 1.3 Non-Goals

- No ERC-1155 token support in the first version
- No dispute or arbitration mechanism
- No mobile app (web only)
- No multi-chain support in a single deployment

---

## 2. Architecture — Approach B (Modular)

### 2.1 Why Modular?

The ChainNusa project already has smart contracts (`AnalysisRegistry.sol` + `ReportSBT.sol`) in `contracts/`. A modular architecture enables:

- **MultiSigWallet** — standalone contract, not coupled to anything, reusable in other projects
- **MultiSigGovernor** — adapter pattern, connecting MultiSigWallet with existing ChainNusa contracts
- Incremental build: MultiSigWallet first (test + deploy), Governance follows
- Each component is independently testable

### 2.2 Components

```
contracts/src/
├── multisig/
│   ├── MultiSigWallet.sol         # Standalone multi-sig contract
│   └── IMultiSigWallet.sol        # Interface + events
├── governance/
│   ├── MultiSigGovernor.sol       # Adapter: multi-sig → existing contracts
│   └── IMultiSigGovernor.sol      # Governance interface
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
│   └── MultiSigGovernor.integration.t.sol  # Integration with existing contracts
└── helpers/
    └── TestHelpers.sol            # Shared test utilities
```

### 2.3 Component Interactions

```
MultiSigWallet (standalone)
    │
    │  submit proposal → approve → execute
    │
    ├── Direct use: ETH/ERC-20 transfer, generic contract call
    │
    └── Governance via MultiSigGovernor:
         │
         ├── AnalysisRegistry: recordAnalysis() only via multi-sig
         ├── ReportSBT: mint() only via multi-sig
         └── (extensible) new contracts can plug into the governor
```

---

## 3. User Stories

### 3.1 MultiSigWallet (Standalone)

| ID | As a | I want to | So that |
|----|------|-----------|---------|
| US-01 | Owner | Deploy wallet with owner list and threshold | Wallet is ready to use |
| US-02 | Owner | Submit a new transaction | Other owners can approve |
| US-03 | Owner | Approve a transaction submitted by another owner | Transaction can be executed |
| US-04 | Owner | Revoke my approval before execution | I can change my mind |
| US-05 | Anyone | Execute a transaction with sufficient approvals | Funds are sent to the recipient |
| US-06 | Owner | View all pending transactions | I know what needs approval |
| US-07 | Anyone | View executed transaction history | There is an audit trail |
| US-08 | Anyone | Deposit ETH to the wallet | Wallet has a balance |
| US-09 | Owner | Submit a proposal to add/remove owner (requires threshold) | Access management |
| US-10 | Owner | Submit a proposal to change threshold (requires threshold) | Governance flexibility |
| US-11 | Owner | Send ERC-20 from multi-sig wallet | Multi-token support |

### 3.2 MultiSigGovernor (ChainNusa Integration)

| ID | As a | I want to | So that |
|----|------|-----------|---------|
| US-12 | Team lead | Record analysis on-chain only via multi-sig approval | No single point of authority |
| US-13 | Team lead | Mint ReportSBT only via multi-sig approval | SBT truly represents the team, not an individual |
| US-14 | Team lead | Upgrade AnalysisRegistry to a new version via multi-sig | Coordinated deployment |

---

## 4. Functional Requirements

### 4.1 MultiSigWallet — Core Features

#### FR-01: Deployment & Initialization

- Contract receives `owners` array and `required` value (threshold) at deploy
- Validation: `owners` must not be empty, no duplicates, no zero address
- Validation: `required` must be between 1 and the length of `owners` array
- Event `WalletCreated(address[] owners, uint required)` emitted at deploy
- Use OpenZeppelin Ownable2Step for contract owner management (if upgrade path needed)

#### FR-02: Submit Transaction

- Owner can submit a transaction with parameters: `to`, `value`, `data`
- Each transaction receives a unique auto-increment `txIndex`
- Submitter automatically becomes the first approver
- Event `SubmitTransaction(address indexed owner, uint indexed txIndex, address indexed to, uint value, bytes data)`

#### FR-03: Approve Transaction

- Owner can approve a transaction by `txIndex`
- One owner can only approve once per transaction
- Cannot approve an already executed transaction
- Event `ApproveTransaction(address indexed owner, uint indexed txIndex)`

#### FR-04: Revoke Approval

- Owner can revoke approval as long as the transaction has not been executed
- Event `RevokeConfirmation(address indexed owner, uint indexed txIndex)`

#### FR-05: Execute Transaction

- Anyone (not just an owner) can trigger execution if approval count >= required
- Execution uses low-level call to support arbitrary calldata
- If execution fails (reverts), the transaction remains marked as not executed (no atomic revert)
- Event `ExecuteTransaction(address indexed owner, uint indexed txIndex)`

#### FR-06: Deposit

- Contract accepts ETH via receive() function
- Event `Deposit(address indexed sender, uint amount, uint balance)`

#### FR-07: ERC-20 Transfer

- MultiSigWallet can hold and send ERC-20 tokens
- Execution via `IERC20.transfer()` with encoded calldata

#### FR-08: Owner Management (via internal proposals)

- Add owner: requires threshold approval, encoded as a proposal to the contract's own address
- Remove owner: same, with validation that threshold doesn't exceed owner count after removal
- Change threshold: same, with validation `newThreshold >= 1` and `newThreshold <= ownerCount`

### 4.2 MultiSigGovernor — Features

#### FR-09: Governance Wrapper for AnalysisRegistry

- `MultiSigGovernor` becomes the callee for `AnalysisRegistry.recordAnalysis()`
- Function `proposeRecordAnalysis(cidBytes, chainId, indexedWallet)` → submits proposal to MultiSigWallet
- Can only be executed after sufficient approvals

#### FR-10: Governance Wrapper for ReportSBT

- `MultiSigGovernor` becomes the callee for `ReportSBT.mint()`
- Function `proposeMintSBT(to, analysisId, cidBytes)` → submits proposal to MultiSigWallet
- Can only be executed after sufficient approvals

### 4.3 View Functions (Read-Only, Gas-Free)

- `getOwners()` → array of all active owners
- `getTransactionCount()` → total number of transactions
- `getTransaction(txIndex)` → details of one transaction
- `isOwner(address)` → boolean
- `isConfirmed(txIndex, address)` → boolean
- `getConfirmationCount(txIndex)` → uint
- `getBalance()` → contract ETH balance

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
    uint96 value;     // 12 bytes — packed with 'to' in 1 slot
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

- All state-changing functions must check `isOwner[msg.sender]`
- No admin key or upgradeability — immutable by design
- Owner cannot approve their own transaction twice
- MultiSigGovernor: only MultiSigWallet owners can submit proposals

### 6.2 Reentrancy Protection

- Execute function uses Checks-Effects-Interactions pattern
- Set `transaction.executed = true` BEFORE making external call
- Use `ReentrancyGuard` from OpenZeppelin as defense in depth

### 6.3 Integer Safety

- Use Solidity ^0.8.24 — overflow protection built-in
- Validate `value` does not exceed `address(this).balance` before execution

### 6.4 Audit Checklist

- [ ] Slither static analysis — zero high/medium findings
- [ ] Manual review: reentrancy, access control, integer overflow
- [ ] Fuzz testing with forge test --fuzz-runs 10000
- [ ] Invariant testing: `numConfirmations` never exceeds owner count
- [ ] Invariant: after removing owner, threshold remains valid

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

| Technique | Implementation |
|-----------|---------------|
| Custom errors | Replace `require(cond, "string")` with `if (!cond) revert CustomError()` |
| Immutable variables | `required` if unchanged → `immutable` |
| Struct packing | Pack `address` (20 bytes) with `uint96` (12 bytes) in 1 slot |
| Mapping vs array | Use mapping for O(1) owner lookup |
| Calldata vs memory | External function parameters use `calldata` not `memory` |
| Short-circuit | Check cheap operation (owner check) before expensive one |

**Gas benchmark targets:**

| Function | Target max gas |
|----------|---------------|
| Deploy | 800,000 |
| Submit | 80,000 |
| Confirm | 50,000 |
| Execute (simple ETH) | 60,000 |
| Revoke | 35,000 |

---

## 9. Frontend Requirements

### 9.1 Pages (inside `apps/web/`)

**Dashboard (`/wallet`)**
- Display: wallet address, ETH balance, owner list, threshold
- Buttons: Connect Wallet, Deposit, Submit New Transaction
- Integration with existing `Analyzer` component in `page.tsx`

**Transactions (`/wallet/transactions`)**
- List all transactions (pending and executed) with pagination
- Filter: All / Pending / Executed
- Each card: to, value, approval progress bar, approve/revoke/execute buttons

**Transaction Detail (`/wallet/transactions/[txIndex]`)**
- Full details including calldata
- List of who has approved
- Execution timeline

### 9.2 Wallet Connection

- Support MetaMask and WalletConnect via RainbowKit
- WAGMI hooks: `useReadContract`, `useWriteContract`, `useWatchContractEvent`
- Auto-detect chain — warn if not Arbitrum/Base
- Handle wrong network with switch prompt

### 9.3 Real-time Updates

- Watch `ConfirmTransaction` and `ExecuteTransaction` events
- Update approval count and status without manual refresh

---

## 10. Deployment Plan

### 10.1 EVM Deployment Steps

```bash
# 1. Local test
forge test -vvv

# 2. Coverage check
forge coverage --report lcov

# 3. Deploy to testnet
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

# 5. Transfer ownership of existing contracts to MultiSigGovernor
#   AnalysisRegistry.transferOwnership(governorAddress)
#   ReportSBT.transferOwnership(governorAddress)

# 6. Deploy to mainnet (after audit)
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
# Existing Next.js app — add wallet pages
pnpm web:dev
pnpm web:build
vercel deploy --prod
```

---

## 11. Milestones & Timeline

| Milestone | Deliverable | Estimate |
|-----------|-------------|----------|
| M1 | MultiSigWallet.sol + unit tests (forge) | Week 1 |
| M2 | Integration tests + fuzz tests | Week 1-2 |
| M3 | MultiSigGovernor.sol + tests | Week 2 |
| M4 | Deploy to Arbitrum Sepolia + verified | Week 2 |
| M5 | Next.js UI (read + write + events) | Week 2-3 |
| M6 | Frontend deploy to Vercel | Week 3 |
| M7 | Slither audit + gas optimization | Week 3-4 |
| M8 | Rust/Anchor implementation (Solana) | Week 5-6 |
| M9 | Deploy mainnet (EVM) + final docs | After M7 |

---

## 12. Definition of Done

Contract is considered production-ready if:

- [ ] All unit and integration tests pass
- [ ] forge coverage ≥ 95%
- [ ] Slither — zero high severity findings
- [ ] Contract verified on Arbiscan/Basescan
- [ ] Gas usage within benchmark targets
- [ ] Frontend live on Vercel with custom domain
- [ ] MultiSigGovernor integrated with AnalysisRegistry & ReportSBT
- [ ] Complete README: modular architecture, how to deploy, how to test, how to upgrade
- [ ] NatSpec documentation on all public functions

---

## 13. References

- [Solidity docs](https://docs.soliditylang.org)
- [Foundry Book](https://book.getfoundry.sh)
- [Anchor Book](https://www.anchor-lang.com)
- [wagmi docs](https://wagmi.sh)
- [RainbowKit](https://www.rainbowkit.com)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Gnosis Safe](https://github.com/safe-global/safe-contracts) — production implementation reference
- [Slither](https://github.com/crytic/slither) — static analyzer
