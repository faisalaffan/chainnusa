# TODO — ChainNusa Gap Implementation

Status terakhir: 2026-05-09. Scaffolding 90% selesai, **belum ada training model nyata** dan **belum deploy contract**.

---

## Prioritas (urutan eksekusi)

### Step 1 — Dapatkan Dataset Wallet Nyata

Butuh Etherscan API key (gratis). Tanpa ini tidak bisa lanjut training.

```bash
# 1. Daftar di https://etherscan.io/myapikey (gratis)
# 2. Set di .env:
ETHERSCAN_API_KEY=your_key_here
DATA_PROVIDER=etherscan

# 3. Ambil data wallet
cd ml-service
pip install -e ".[dev]"
python -c "
import asyncio
from app.etl.extract import ChainDataExtractor

extractor = ChainDataExtractor(api_key='your_key')
async def main():
    # ambil data 50 wallet (label dari Etherscan tags)
    data = await extractor.extract(1, '0x...', max_txs=500)
    print(f'Txs: {len(data.normal_txs)}, Token txs: {len(data.token_txs)}')
asyncio.run(main())
"
```

Target: kumpulkan data **minimal 500 wallet** (exchange, trader, bot, normal).

### Step 2 — Train di vast.ai GPU

Pilih instance dengan **RTX 3090/4090**, RAM 16GB+, storage 50GB+.

```bash
# SSH ke vast.ai instance
ssh -p <port> root@<ip>

# Setup environment
apt update && apt install -y python3.11 python3-pip git curl
pip install uv

# Clone repo
git clone https://github.com/faisalaffan/chainnusa.git
cd chainnusa/ml-service

# Install deps
pip install -e ".[dev,nlp,viz]"

# Upload dataset kamu (scp atau rsync dari laptop)
# scp -P <port> dataset/*.parquet root@<ip>:~/chainnusa/ml-service/data/

# Jalankan training satu per satu:
```

#### 2a. Wallet Classifier (RF + XGBoost) — 5 menit

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

#### 2b. Anomaly Detector — 2 menit

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

#### 2c. LSTM Sequence Anomaly — ~30 menit CPU, ~3 menit GPU

```bash
python -c "
import pandas as pd
from app.models.lstm import LstmAnomalyDetector

# Butuh sequence data — dari ETL pipeline yang sudah jalan
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

#### 2d. Configuring Checkpoint

```bash
# Setelah semua model di-save ke models/:
# Salin ke MinIO (via infra MLflow):
# Atau simpan lokal dulu untuk development:
mkdir -p ~/chainnusa/ml-service/models/
# Download dari vast.ai dengan scp
```

### Step 3 — Setup MLflow + MinIO (lokal)

```bash
# Dari laptop:
cd infra
docker compose up -d postgres minio mlflow

# Akses:
# MLflow UI: http://localhost:5000
# MinIO Console: http://localhost:9001 (minioadmin / minioadmin)

# Registrasi model ke MLflow registry dari script training
```

### Step 4 — Jalankan Notebook untuk EDA + Documentation

```bash
cd ml-service
jupyter notebook notebooks/
# Buka 00_eda.ipynb → sesuaikan path dataset → run semua cell
# Ulangi untuk 02_supervised, 03_unsupervised, 05_statistics, 06_timeseries
```

### Step 5 — Deploy Smart Contract ke Testnet

```bash
cd contracts

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install deps
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit

# Test
forge test -vv

# Deploy ke Sepolia
export DEPLOYER_PRIVATE_KEY=your_key
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export ETHERSCAN_API_KEY=your_key
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
```

### Step 6 — Integrasi wagmi + RainbowKit ke UI

```bash
cd apps/web
pnpm add wagmi @wagmi/core @wagmi/connectors @rainbow-me/rainbowkit viem
```

Bikin component `WalletProvider` yang wrap RainbowKit, dan tombol "Connect" + "Mint Proof" di `Analyzer.tsx`.

### Step 7 — IPFS Pin

```bash
cd apps/web
pnpm add @pinata/sdk
```

Flow: POST `/api/analyze` → pilih "Mint proof" → pin JSON hasil analisis ke Pinata → dapat CID → call `AnalysisRegistry.recordAnalysis()` via wagmi.

### Step 8 — Chainlink Price Feed

```bash
cd apps/web
pnpm add @chainlink/contracts
```

Konversi `gasSpent` ke USD pakai `AggregatorV3Interface(priceFeedAddress).latestRoundData()`.

---

## Checklist Ringkas

| # | Task | Lokasi | Estimasi |
|---|---|---|---|
| 1 | Kumpulkan dataset 500+ wallet | Laptop + Etherscan | 2-3 jam |
| 2 | Train classifier (RF+XGBoost) | vast.ai GPU | 5 menit |
| 3 | Train anomaly detector | vast.ai GPU | 2 menit |
| 4 | Train LSTM model | vast.ai GPU | 3 menit |
| 5 | Run semua notebook | vast.ai / laptop | 2 jam |
| 6 | Setup MLflow + registrasi model | Laptop | 30 menit |
| 7 | Deploy contract ke Sepolia | Laptop | 15 menit |
| 8 | wagmi + RainbowKit UI | apps/web | 2 jam |
| 9 | IPFS pin flow | apps/web | 1 jam |
| 10 | Chainlink price feed | apps/web + contracts | 1 jam |
| 11 | E2E Playwright tests | apps/web | 1.5 jam |
| 12 | Gitleaks + dependency audit CI | .github/workflows | 30 menit |

---

## Catatan

- **vast.ai instance**: pilih `RTX 3090` / `RTX 4090` dengan `cuda:12.x`, bid rendah (~$0.20-0.40/jam), storage 50GB+, image `pytorch/pytorch:latest`
- Model artifact (.pkl, .pt) harus di-upload kembali ke repo atau MinIO
- Jangan commit `.pkl`, `.pt`, atau `.db` ke git — sudah ada di `.gitignore`
- Semua training script bisa dijalankan via `python -c "..."` atau sebagai standalone script
