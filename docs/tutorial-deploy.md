# Tutorial: Deploy Smart Contracts

Panduan deploy semua contract ChainNusa menggunakan Foundry `forge script`.

## Prasyarat

```bash
# Pastikan Foundry terinstall
forge --version  # >= 1.0.0

# Pastikan dependencies terinstall
cd contracts
forge install

# Build contracts
forge build
```

## Environment Variables

Buat file `.env` di folder `contracts/` (atau export manual):

```bash
# Deployer account
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Multi-sig (untuk DeployMultiSig)
export MULTISIG_OWNERS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
export MULTISIG_THRESHOLD=2
export ANALYSIS_REGISTRY=0x5FbDB2315678afecb367f032d93F642f64180aa3
export REPORT_SBT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# RPC endpoints (defined in foundry.toml rpc_endpoints)
export SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
export ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
export BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Etherscan verification
export ETHERSCAN_API_KEY=YOUR_KEY
export ARBISCAN_API_KEY=YOUR_KEY
export BASESCAN_API_KEY=YOUR_KEY
```

## Deploy ke Anvil (Local Devnet)

### Step 1 — Start Anvil

Di VPS:
```bash
anvil --host 0.0.0.0 --chain-id 31337
```

Output 10 account dengan 10000 ETH + private keys.

### Step 2 — Deploy Data Layer

Dari laptop:
```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/Deploy.s.sol \
  --rpc-url http://vps:8545 \
  --broadcast
```

Output:
```
AnalysisRegistry deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
ReportSBT deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### Step 3 — Deploy Governance Layer (Opsional)

```bash
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
MULTISIG_OWNERS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8" \
MULTISIG_THRESHOLD=2 \
ANALYSIS_REGISTRY=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
REPORT_SBT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
forge script script/DeployMultiSig.s.sol \
  --rpc-url http://vps:8545 \
  --broadcast
```

### Step 4 — Setup Ownership (Production Mode)

```bash
# Transfer AnalysisRegistry ownership ke MultiSigWallet
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "transferOwnership(address)" 0xMULTISIG_WALLET_ADDRESS \
  --rpc-url http://vps:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Transfer ReportSBT ownership ke MultiSigWallet
cast send 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "transferOwnership(address)" 0xMULTISIG_WALLET_ADDRESS \
  --rpc-url http://vps:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Deploy ke Sepolia Testnet

### Step 1 — Setup Sepolia RPC + Fund Wallet

Dapatkan Sepolia ETH dari faucet (alchemy, infura, quicknode):
```bash
cast balance 0xYOUR_DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL
```

### Step 2 — Deploy dengan Verification

```bash
DEPLOYER_PRIVATE_KEY=0x... \
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

Foundry auto-verify via Etherscan API → ABI muncul di Sepolia Etherscan.

### Step 3 — Deploy Governance

```bash
DEPLOYER_PRIVATE_KEY=0x... \
MULTISIG_OWNERS="0xOwner1,0xOwner2,0xOwner3" \
MULTISIG_THRESHOLD=2 \
ANALYSIS_REGISTRY=0x... \
REPORT_SBT=0x... \
forge script script/DeployMultiSig.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

## Deploy ke Mainnet (Production)

Sama seperti Sepolia, tapi:
- Pastikan `DEPLOYER_PRIVATE_KEY` aman (hardware wallet atau key management)
- Gunakan threshold yang sesuai (misal 3 of 5 untuk tim)
- Owner address adalah EOA tim (bukan dev accounts)
- Test dulu 100% di Sepolia sebelum mainnet

```bash
DEPLOYER_PRIVATE_KEY=0x... \
forge script script/Deploy.s.sol \
  --rpc-url $MAINNET_RPC_URL \
  --broadcast \
  --verify \
  --slow  # Tambah delay antar tx untuk menghindari nonce issues
```

## Verifikasi Setelah Deploy

### Cek Semua Contract

```bash
# AnalysisRegistry
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "totalAnalyses()" --rpc-url http://vps:8545

# ReportSBT
cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "nextTokenId()" --rpc-url http://vps:8545

# MultiSigWallet — list owners
cast call 0xMULTISIG_WALLET \
  "getOwners()" --rpc-url http://vps:8545

# MultiSigGovernor — check wallet link
cast call 0xMULTISIG_GOVERNOR \
  "wallet()" --rpc-url http://vps:8545
```

### Test Flow (Anvil Dev Mode)

```bash
# 1. Record analysis
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "recordAnalysis(bytes32,uint256,address)" \
  0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  31337 \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://vps:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 2. Mint SBT (pakai analysisId yg didapat dari event AnalysisRecorded)
cast send 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "mint(address,bytes32,bytes32)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  ANALYSIS_ID \
  0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --rpc-url http://vps:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 3. Cek token
cast call 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  "tokenURI(uint256)" 1 --rpc-url http://vps:8545
# Output: ipfs://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

## Troubleshooting

| Error | Penyebab | Solusi |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY not found` | Env var tidak di-export | `export` atau inline sebelum command |
| `connection refused` | Anvil tidak bisa diakses | Cek `--host 0.0.0.0`, cek Tailscale IP |
| `replacement fee too low` | Nonce conflict | Tambah `--slow` atau reset nonce |
| `already known` | Transaksi duplikat | Tunggu tx sebelumnya confirmed |
| `insufficient funds` | Deployer tidak punya ETH | Faucet untuk testnet, fund untuk mainnet |

## Deployment Addresses

| Network | AnalysisRegistry | ReportSBT | MultiSigWallet | MultiSigGovernor |
|---|---|---|---|---|
| **Anvil (local)** | `0x5FbDB...0aa3` | `0xe7f17...0512` | _belum deploy_ | _belum deploy_ |
| **Sepolia** | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| **Ethereum** | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
