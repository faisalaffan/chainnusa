# TODO — ChainNusa Gap Implementation

Last updated: 2026-05-09. Scaffolding ~90% complete, **no real model training yet** and **no contract deployment**.

---

## Priorities (execution order)

### Step 1 — Get Real Wallet Dataset

Need an Etherscan API key (free). Without this, training cannot proceed.

```bash
# 1. Sign up at https://etherscan.io/myapikey (free)
# 2. Set in .env:
ETHERSCAN_API_KEY=your_key_here
DATA_PROVIDER=etherscan

# 3. Fetch wallet data
cd ml-service
pip install -e ".[dev]"
python -c "
import asyncio
from app.etl.extract import ChainDataExtractor

extractor = ChainDataExtractor(api_key='your_key')
async def main():
    # fetch data for 50 wallets (labels from Etherscan tags)
    data = await extractor.extract(1, '0x...', max_txs=500)
    print(f'Txs: {len(data.normal_txs)}, Token txs: {len(data.token_txs)}')
asyncio.run(main())
"
```

Target: collect data for **at least 500 wallets** (exchange, trader, bot, normal).

### Step 2 — Train on vast.ai GPU

Choose an instance with **RTX 3090/4090**, 16GB+ RAM, 50GB+ storage.

```bash
# SSH to vast.ai instance
ssh -p <port> root@<ip>

# Setup environment
apt update && apt install -y python3.11 python3-pip git curl
pip install uv

# Clone repo
git clone https://github.com/faisalaffan/chainnusa.git
cd chainnusa/ml-service

# Install deps
pip install -e ".[dev,nlp,viz]"

# Upload your dataset (scp or rsync from laptop)
# scp -P <port> dataset/*.parquet root@<ip>:~/chainnusa/ml-service/data/

# Run training one by one:
```

#### 2a. Wallet Classifier (RF + XGBoost) — 5 minutes

```bash
cd ml-service
python -c "
import pandas as pd
from app.models.wallet_clf import WalletClassifier
from app.features.extractor import WalletFeatureExtractor

# Load dataset
df = pd.read_parquet('data/processed/v1/wallet_features.parquet')
labels = pd.read_csv('data/labels/wallet_labels.csv')

extractor = WalletFeatureExtractor()
X = extractor.features_dataframe_from_table(df)
y = labels['label']

clf = WalletClassifier(model_type='xgb')
metrics = clf.train(X.select_dtypes(include='number'), y)
print(f'F1 macro: {metrics[\"f1_macro\"]:.3f}')
print(f'CV 5-fold: {metrics[\"cv_f1_macro_mean\"]:.3f} +/- {metrics[\"cv_f1_macro_std\"]:.3f}')

clf.save('models/wallet_clf.pkl')
print('Saved to models/wallet_clf.pkl')
"
```

#### 2b. Anomaly Detector — 2 minutes

```bash
python -c "
import pandas as pd
from app.models.anomaly import AnomalyDetector

df = pd.read_parquet('data/processed/v1/wallet_features.parquet')
det = AnomalyDetector(contamination=0.05)
metrics = det.train(df.select_dtypes(include='number'))
print(f'Threshold: {metrics[\"threshold_95\"]:.4f}')
det.save('models/anomaly_detector.pkl')
"
```

#### 2c. LSTM Sequence Anomaly — ~30 min CPU, ~3 min GPU

```bash
python -c "
import pandas as pd
from app.models.lstm import LstmAnomalyDetector

# Requires sequence data — from ETL pipeline that has already run
df = pd.read_parquet('data/processed/v1/wallet_features_with_seq.parquet')

lstm = LstmAnomalyDetector(seq_len=64, input_dim=3, hidden_dim=64)
metrics = lstm.train(
    value_series=df['tx_value_series'].tolist(),
    gas_series=df['gas_series'].tolist(),
    time_delta_series=df['time_delta_series'].tolist(),
    epochs=100,
    batch_size=64,
    lr=1e-3,
)
print(f'Final loss: {metrics[\"final_loss\"]:.4f}')
lstm.save('models/lstm_anomaly')
"
```

#### 2d. Checkpoint Configuration

```bash
# After all models are saved to models/:
# Copy to MinIO (via infra MLflow):
# Or save locally first for development:
mkdir -p ~/chainnusa/ml-service/models/
# Download from vast.ai with scp
```

### Step 3 — Setup MLflow + MinIO (local)

```bash
# From laptop:
cd infra
docker compose up -d postgres minio mlflow

# Access:
# MLflow UI: http://localhost:5000
# MinIO Console: http://localhost:9001 (minioadmin / minioadmin)

# Register models to MLflow registry from training scripts
```

### Step 4 — Run Notebooks for EDA + Documentation

```bash
cd ml-service
jupyter notebook notebooks/
# Open 00_eda.ipynb → adjust dataset path → run all cells
# Repeat for 02_supervised, 03_unsupervised, 05_statistics, 06_timeseries
```

### Step 5 — Deploy Smart Contract to Testnet

```bash
cd contracts

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install deps
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit

# Test
forge test -vv

# Deploy to Sepolia
export DEPLOYER_PRIVATE_KEY=your_key
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export ETHERSCAN_API_KEY=your_key
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
```

### Step 6 — Integrate wagmi + RainbowKit into UI

```bash
cd apps/web
pnpm add wagmi @wagmi/core @wagmi/connectors @rainbow-me/rainbowkit viem
```

Create a `WalletProvider` component wrapping RainbowKit, and "Connect" + "Mint Proof" buttons in `Analyzer.tsx`.

### Step 7 — IPFS Pin

```bash
cd apps/web
pnpm add @pinata/sdk
```

Flow: POST `/api/analyze` → choose "Mint proof" → pin analysis result JSON to Pinata → get CID → call `AnalysisRegistry.recordAnalysis()` via wagmi.

### Step 8 — Chainlink Price Feed

```bash
cd apps/web
pnpm add @chainlink/contracts
```

Convert `gasSpent` to USD using `AggregatorV3Interface(priceFeedAddress).latestRoundData()`.

---

## Quick Checklist

| # | Task | Location | Estimate |
|---|---|---|---|
| 1 | Collect 500+ wallet dataset | Laptop + Etherscan | 2-3 hours |
| 2 | Train classifier (RF+XGBoost) | vast.ai GPU | 5 min |
| 3 | Train anomaly detector | vast.ai GPU | 2 min |
| 4 | Train LSTM model | vast.ai GPU | 3 min |
| 5 | Run all notebooks | vast.ai / laptop | 2 hours |
| 6 | Setup MLflow + register models | Laptop | 30 min |
| 7 | Deploy contract to Sepolia | Laptop | 15 min |
| 8 | wagmi + RainbowKit UI | apps/web | 2 hours |
| 9 | IPFS pin flow | apps/web | 1 hour |
| 10 | Chainlink price feed | apps/web + contracts | 1 hour |
| 11 | E2E Playwright tests | apps/web | 1.5 hours |
| 12 | Gitleaks + dependency audit CI | .github/workflows | 30 min |

---

## Notes

- **vast.ai instance**: choose `RTX 3090` / `RTX 4090` with `cuda:12.x`, low bid (~$0.20-0.40/hour), 50GB+ storage, image `pytorch/pytorch:latest`
- Model artifacts (.pkl, .pt) must be uploaded back to repo or MinIO
- Do not commit `.pkl`, `.pt`, or `.db` to git — already in `.gitignore`
- All training scripts can be run via `python -c "..."` or as standalone scripts
