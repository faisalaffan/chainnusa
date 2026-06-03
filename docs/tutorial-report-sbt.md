# Tutorial: ReportSBT

Soulbound Token (SBT) — NFT non-transferable yang menjadi bukti kepemilikan analisis wallet. Terikat permanen ke address pemilik.

## Source Code (`src/ReportSBT.sol`)

### Full Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ReportSBT is ERC721, Ownable, ERC721Burnable {
    uint256 private _nextTokenId;

    // -- STEP 1: Mappings --
    mapping(uint256 => bytes32) public tokenAnalysis;   // tokenId → analysisId
    mapping(uint256 => bytes32) public tokenCid;        // tokenId → IPFS CID
    mapping(address => mapping(bytes32 => bool)) public hasMinted; // Anti-duplicate

    // -- STEP 2: Custom Errors --
    error SoulboundTokenCannotTransfer();
    error AlreadyMinted(address wallet, bytes32 analysisId);

    // -- STEP 3: Event --
    event ReportMinted(
        uint256 indexed tokenId,
        address indexed to,
        bytes32 indexed analysisId,
        bytes32 cidBytes,
        uint256 timestamp
    );

    constructor()
        ERC721("ChainNusa Report SBT", "cREPORT")
        Ownable(msg.sender)
    {}

    // -- STEP 4: Mint Function --
    function mint(
        address to,
        bytes32 analysisId,
        bytes32 cidBytes
    ) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "Zero address");
        require(analysisId != bytes32(0), "Empty analysisId");
        if (hasMinted[to][analysisId]) revert AlreadyMinted(to, analysisId);

        tokenId = ++_nextTokenId;
        _mint(to, tokenId);

        tokenAnalysis[tokenId] = analysisId;
        tokenCid[tokenId] = cidBytes;
        hasMinted[to][analysisId] = true;

        emit ReportMinted(tokenId, to, analysisId, cidBytes, block.timestamp);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // -- STEP 5: Soulbound Enforcement --
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow mint (from=0x0) and burn (to=0x0), block everything else
        if (from != address(0) && to != address(0)) {
            revert SoulboundTokenCannotTransfer();
        }
        return super._update(to, tokenId, auth);
    }

    function transferFrom(address, address, uint256) public pure override {
        revert SoulboundTokenCannotTransfer();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert SoulboundTokenCannotTransfer();
    }

    // -- STEP 6: Token URI --
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        bytes32 cid = tokenCid[tokenId];
        return string(abi.encodePacked("ipfs://", _cidToString(cid)));
    }

    function _cidToString(bytes32 cid) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = hexChars[uint8(cid[i] >> 4)];
            str[i * 2 + 1] = hexChars[uint8(cid[i] & 0x0f)];
        }
        return string(str);
    }
}
```

## Step-by-Step Penjelasan

### Step 1 — Mappings

| Mapping | Purpose |
|---|---|
| `tokenAnalysis` | tokenId → analysisId (reference ke AnalysisRegistry) |
| `tokenCid` | tokenId → bytes32 IPFS CID |
| `hasMinted` | wallet × analysisId → bool (cegah duplicate mint) |

Anti-duplicate: satu kombinasi (wallet, analysisId) hanya bisa mint 1 SBT.

### Step 2 — Custom Errors

```solidity
error SoulboundTokenCannotTransfer();
error AlreadyMinted(address wallet, bytes32 analysisId);
```

Custom errors lebih hemat gas daripada string revert reason. `AlreadyMinted` include address + analysisId untuk debugging frontend.

### Step 3 — Event `ReportMinted`

3 indexed params: `tokenId`, `to`, `analysisId`. Frontend bisa filter:
- `to` = wallet tertentu (history SBT)
- `analysisId` = cek apakah analysisId sudah di-mint

### Step 4 — `mint()` Function

```
1. Validasi input (to ≠ 0, analysisId ≠ 0)
2. Cek duplicate (hasMinted[to][analysisId] == false)
3. ++_nextTokenId → tokenId (mulai dari 1)
4. _mint(to, tokenId) — OpenZeppelin ERC721 internal mint
5. Simpan mapping tokenAnalysis, tokenCid, hasMinted
6. Emit ReportMinted event
```

Hanya `onlyOwner` — dalam production, owner adalah MultiSigWallet, bukan EOA individual.

### Step 5 — Soulbound Enforcement

SBT tidak bisa ditransfer. 3 layer proteksi:

**Layer 1: `_update()` override**
```solidity
if (from != address(0) && to != address(0)) {
    revert SoulboundTokenCannotTransfer();
}
```
Logic: hanya allow mint (from=0) dan burn (to=0). Semua transfer (from≠0 AND to≠0) direject.

**Layer 2: `transferFrom()` override**
```solidity
function transferFrom(address, address, uint256) public pure override {
    revert SoulboundTokenCannotTransfer();
}
```
Pure function — selalu revert. Abaikan parameter.

**Layer 3: `safeTransferFrom()` override**
```solidity
function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
    revert SoulboundTokenCannotTransfer();
}
```
Sama — semua safe transfer direject.

### Step 6 — Token URI `ipfs://` format

```solidity
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    _requireOwned(tokenId);
    bytes32 cid = tokenCid[tokenId];
    return string(abi.encodePacked("ipfs://", _cidToString(cid)));
}
```

Return `ipfs://<hex-cid>` — kompatibel dengan IPFS gateway. Marketplaces/wallets bisa render IPFS content.

`_cidToString()` — konversi bytes32 ke 64-char hex string. Contoh:
```
bytes32: 0xabcdef...
string:  "abcdef..."
```

## Cara Pakai

### Dari Foundry cast (CLI)

```bash
cast send 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "mint(address,bytes32,bytes32)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  0x0f5b1c4f4c96c28fa197f1fc07b0c64b909b3dfdb4e2bd6ba9c43eb2530b65eb \
  0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --rpc-url http://vps:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Cek token info

```bash
# Token URI
cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "tokenURI(uint256)" 1 --rpc-url http://vps:8545

# Analysis ID dari token
cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "tokenAnalysis(uint256)" 1 --rpc-url http://vps:8545

# Apakah wallet+analysisId sudah di-mint?
cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "hasMinted(address,bytes32)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  0x0f5b1c4f4c96c28fa197f1fc07b0c64b909b3dfdb4e2bd6ba9c43eb2530b65eb \
  --rpc-url http://vps:8545
```

## Inheritance Chain

```
ERC721 (OpenZeppelin)
  ├── token ownership & metadata
  └── _update(), _mint(), _burn()

ERC721Burnable (OpenZeppelin)
  └── burn() — hanya token owner

Ownable (OpenZeppelin)
  └── onlyOwner modifier untuk mint()

ReportSBT
  └── Soulbound logic + SBT-specific mappings
```
