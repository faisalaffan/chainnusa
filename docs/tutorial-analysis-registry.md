# Tutorial: AnalysisRegistry

Registry on-chain untuk menyimpan bukti analisis wallet. Setiap analisis disimpan sebagai record dengan IPFS CID, timestamp, dan chain info.

## Source Code (`src/AnalysisRegistry.sol`)

### Full Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AnalysisRegistry is Ownable {
    // -- STEP 1: Data Structure --
    struct AnalysisRecord {
        bytes32 cidBytes;       // IPFS CID (32-byte hash dari CIDv1)
        uint256 timestamp;      // Unix timestamp saat record dibuat
        uint256 chainId;        // Chain ID wallet yang dianalisis
        address indexedWallet;  // Alamat wallet yang dianalisis
        address analyst;        // Siapa yang submit (bisa wallet sendiri atau relayer)
    }

    // -- STEP 2: Storage --
    mapping(bytes32 => AnalysisRecord) public records;    // analysisId → record
    mapping(address => uint256) public analysisCount;     // wallet → jumlah analisis
    mapping(address => bytes32[]) public analysesByWallet; // wallet → daftar analysisId
    uint256 public totalAnalyses;                         // Total record tersimpan

    // -- STEP 3: Event --
    event AnalysisRecorded(
        bytes32 indexed analysisId,
        address indexed indexedWallet,
        bytes32 cidBytes,
        uint256 chainId,
        address analyst,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    // -- STEP 4: Core Function --
    function recordAnalysis(
        bytes32 cidBytes,
        uint256 chainId,
        address indexedWallet
    ) external returns (bytes32 analysisId) {
        require(cidBytes != bytes32(0), "Empty CID");
        require(indexedWallet != address(0), "Zero address");

        // Generate unique ID dari kombinasi data
        analysisId = keccak256(
            abi.encodePacked(block.chainid, indexedWallet, cidBytes, block.timestamp, msg.sender)
        );

        // Simpan record
        records[analysisId] = AnalysisRecord({
            cidBytes: cidBytes,
            timestamp: block.timestamp,
            chainId: chainId,
            indexedWallet: indexedWallet,
            analyst: msg.sender
        });

        // Update index
        analysesByWallet[indexedWallet].push(analysisId);
        unchecked {
            analysisCount[indexedWallet]++;
            totalAnalyses++;
        }

        emit AnalysisRecorded(
            analysisId, indexedWallet, cidBytes, chainId, msg.sender, block.timestamp
        );
    }

    // -- STEP 5: View Functions --
    function getAnalysesForWallet(address wallet) external view returns (bytes32[] memory) {
        return analysesByWallet[wallet];
    }

    function getAnalysisCount(address wallet) external view returns (uint256) {
        return analysisCount[wallet];
    }
}
```

## Step-by-Step Penjelasan

### Step 1 — Data Structure (`AnalysisRecord`)

```solidity
struct AnalysisRecord {
    bytes32 cidBytes;       // 32-byte pertama dari IPFS CIDv1
    uint256 timestamp;      // block.timestamp saat record
    uint256 chainId;        // 1=Ethereum, 56=BSC, 137=Polygon, 31337=Anvil
    address indexedWallet;  // Wallet yang dianalisis
    address analyst;        // msg.sender yang submit
}
```

Mengapa `bytes32` bukan `string` untuk CID? Gas lebih murah. IPFS CIDv1 32-byte hash dikonversi ke `bytes32`. Frontend rekonstruksi full CID saat perlu.

### Step 2 — Storage Mappings

| Mapping | Key → Value | Purpose |
|---|---|---|
| `records` | `analysisId` → `AnalysisRecord` | Primary storage |
| `analysisCount` | `wallet address` → `uint256` | Quick count lookup |
| `analysesByWallet` | `wallet address` → `bytes32[]` | List semua analysisId per wallet |
| `totalAnalyses` | — | Total record di registry |

Pattern: double-indexed — bisa query by `analysisId` (direct) atau by `wallet` (list).

### Step 3 — Event `AnalysisRecorded`

3 indexed params (`analysisId`, `indexedWallet`) + 3 non-indexed (`cidBytes`, `chainId`, `analyst`, `timestamp`).

Indexed params bisa difilter di `eth_getLogs` — frontend bisa subscribe ke event dengan filter wallet tertentu.

### Step 4 — `recordAnalysis()` Core Logic

```
1. Validasi input (cidBytes ≠ 0, indexedWallet ≠ address(0))
2. Generate analysisId via keccak256(chainid + wallet + cid + timestamp + submitter)
3. Simpan ke records[]
4. Push ke analysesByWallet[wallet]
5. Increment counters (unchecked — overflow tidak mungkin dalam praktik)
6. Emit event
```

Keunikan `analysisId`: Karena input termasuk `block.timestamp` dan `msg.sender`, meskipun data sama, 2 submitter berbeda atau 2 waktu berbeda menghasilkan ID berbeda.

### Step 5 — View Functions

`getAnalysesForWallet(wallet)` — return semua analysisId untuk wallet. Bisa digunakan frontend untuk menampilkan history analisis.

`getAnalysisCount(wallet)` — return jumlah. Alternatif lebih murah (1 SLOAD vs array length).

## Cara Pakai

### Dari Frontend (viem)

```typescript
import { createWalletClient, http } from "viem";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const client = createWalletClient({
  chain: anvil,
  transport: http("http://vps:8545"),
  account: privateKeyToAccount("0xac09..."),
});

const cidBytes = "0x" + "a".repeat(64); // 32-byte hex
const tx = await client.writeContract({
  address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  abi: [...], // ABI dari contracts/out/
  functionName: "recordAnalysis",
  args: [cidBytes, 1n, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
});
```

### Dari Foundry cast (CLI)

```bash
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "recordAnalysis(bytes32,uint256,address)" \
  0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  1 \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://vps:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Inheritance & Dependencies

- `Ownable` (OpenZeppelin) — hanya owner yang bisa transfer ownership. `recordAnalysis()` sendiri **public** — siapa pun bisa submit.
