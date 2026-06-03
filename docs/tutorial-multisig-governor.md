# Tutorial: MultiSigGovernor

Adapter governance — menjembatani MultiSigWallet dengan ChainNusa contracts (AnalysisRegistry + ReportSBT). Hanya MultiSigWallet owners yang bisa submit proposal.

## Source Code (`src/governance/MultiSigGovernor.sol`)

### Full Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MultiSigWallet} from "../multisig/MultiSigWallet.sol";
import {AnalysisRegistry} from "../AnalysisRegistry.sol";
import {ReportSBT} from "../ReportSBT.sol";

contract MultiSigGovernor {
    // -- Immutable references --
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
        wallet = MultiSigWallet(payable(_wallet));
        registry = AnalysisRegistry(_registry);
        sbt = ReportSBT(_sbt);
    }

    /// Submit proposal: record analysis
    function proposeRecordAnalysis(
        bytes32 cidBytes,
        uint256 chainId,
        address indexedWallet
    ) external onlyWalletOwner returns (uint256 txIndex) {
        bytes memory data = abi.encodeWithSelector(
            AnalysisRegistry.recordAnalysis.selector,
            cidBytes, chainId, indexedWallet
        );
        txIndex = wallet.submitTransaction(address(registry), 0, data);
    }

    /// Submit proposal: mint SBT
    function proposeMintSBT(
        address to,
        bytes32 analysisId,
        bytes32 cidBytes
    ) external onlyWalletOwner returns (uint256 txIndex) {
        bytes memory data = abi.encodeWithSelector(
            ReportSBT.mint.selector,
            to, analysisId, cidBytes
        );
        txIndex = wallet.submitTransaction(address(sbt), 0, data);
    }
}
```

## Step-by-Step Penjelasan

### Step 1 — Immutable References

```solidity
MultiSigWallet public immutable wallet;
AnalysisRegistry public immutable registry;
ReportSBT public immutable sbt;
```

`immutable` vs `constant`:
- `immutable` — diset di constructor, disimpan di contract code (bukan storage). Lebih murah gas dari storage read.
- Setiap reference hanya 1x SLOAD setelah constructor (di-read dari code).

### Step 2 — Access Control via `onlyWalletOwner`

```solidity
modifier onlyWalletOwner() {
    if (!wallet.isOwner(msg.sender)) revert NotWalletOwner();
    _;
}
```

Tidak pakai mapping internal. Governor tanya langsung ke MultiSigWallet: "apakah msg.sender adalah owner?" Ini berarti owner management cukup di MultiSigWallet — Governor otomatis ikut update.

### Step 3 — `proposeRecordAnalysis()`

```solidity
function proposeRecordAnalysis(
    bytes32 cidBytes,
    uint256 chainId,
    address indexedWallet
) external onlyWalletOwner returns (uint256 txIndex) {
    bytes memory data = abi.encodeWithSelector(
        AnalysisRegistry.recordAnalysis.selector,
        cidBytes, chainId, indexedWallet
    );
    txIndex = wallet.submitTransaction(address(registry), 0, data);
}
```

Flow:
1. Cek `onlyWalletOwner` — hanya MultiSig owner yang bisa
2. Encode calldata: `recordAnalysis(bytes32,uint256,address)` selector + params
3. Submit ke MultiSigWallet dengan target = AnalysisRegistry address, value = 0 ETH
4. Return `txIndex` — posisi proposal di MultiSigWallet transaction array

MultiSigWallet auto-confirm dari submitter. Owner lain bisa `confirmTransaction(txIndex)` lalu siapa pun `executeTransaction(txIndex)`.

### Step 4 — `proposeMintSBT()`

```solidity
function proposeMintSBT(
    address to,
    bytes32 analysisId,
    bytes32 cidBytes
) external onlyWalletOwner returns (uint256 txIndex) {
    bytes memory data = abi.encodeWithSelector(
        ReportSBT.mint.selector,
        to, analysisId, cidBytes
    );
    txIndex = wallet.submitTransaction(address(sbt), 0, data);
}
```

Flow sama seperti `proposeRecordAnalysis`, tapi target = ReportSBT dengan fungsi `mint(address,bytes32,bytes32)`.

### Step 5 — `abi.encodeWithSelector` vs `abi.encodeWithSignature`

```solidity
// Yang dipakai: selector-based (lebih aman)
abi.encodeWithSelector(AnalysisRegistry.recordAnalysis.selector, ...)

// Alternatif: string-based (rawan typo)
abi.encodeWithSignature("recordAnalysis(bytes32,uint256,address)", ...)
```

Selector-based reference langsung ke interface function → compile-time check. Kalau function signature berubah, compiler error.

## Production Setup Flow

```
1. Deploy AnalysisRegistry
2. Deploy ReportSBT
3. Deploy MultiSigWallet(owners, threshold)
4. Deploy MultiSigGovernor(wallet, registry, sbt)
5. MultiSigWallet.addOwner(governor)          ← governor bisa submit
6. AnalysisRegistry.transferOwnership(wallet) ← wallet jadi owner
7. ReportSBT.transferOwnership(wallet)        ← wallet jadi owner
```

Setelah step 5-7:
- `AnalysisRegistry.owner()` → MultiSigWallet
- `ReportSBT.owner()` → MultiSigWallet
- Mint dan recordAnalysis hanya bisa via MultiSigWallet → MultiSigGovernor → owner proposal flow

## Cara Pakai

### Submit Record Analysis Proposal

```bash
GOVERNOR=0x...   # MultiSigGovernor address
CID=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

cast send $GOVERNOR \
  "proposeRecordAnalysis(bytes32,uint256,address)" \
  $CID 1 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://vps:8545 \
  --private-key $OWNER_A_KEY
```

Output: txIndex di MultiSigWallet. Owner lain harus confirm.

### Submit Mint SBT Proposal

```bash
ANALYSIS_ID=0x0f5b1c4f4c96c28fa197f1fc07b0c64b909b3dfdb4e2bd6ba9c43eb2530b65eb

cast send $GOVERNOR \
  "proposeMintSBT(address,bytes32,bytes32)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 $ANALYSIS_ID $CID \
  --rpc-url http://vps:8545 \
  --private-key $OWNER_A_KEY
```

### Confirm + Execute (via MultiSigWallet langsung)

```bash
WALLET=0x...  # MultiSigWallet address
TX_INDEX=0

# Owner B confirms
cast send $WALLET "confirmTransaction(uint256)" $TX_INDEX \
  --rpc-url http://vps:8545 --private-key $OWNER_B_KEY

# Anyone executes
cast send $WALLET "executeTransaction(uint256)" $TX_INDEX \
  --rpc-url http://vps:8545 --private-key $ANY_KEY
```

## Development Mode vs Production Mode

| Mode | Owner of Registry/SBT | Submit Flow |
|---|---|---|
| **Development** (Anvil) | EOA (deployer) | EOA langsung panggil `recordAnalysis()` / `mint()` |
| **Production** | MultiSigWallet | MultiSigGovernor → MultiSigWallet → execute |

Development mode skip governance flow — lebih cepat untuk testing dan iterasi. Frontend ChainNusa (`lib/contracts.ts`) pakai development mode: deployer EOA langsung submit via `recordAndMint()`.
