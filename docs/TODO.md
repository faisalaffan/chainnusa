# TODO — Implementasi Kesenjangan ChainNusa

Terakhir diperbarui: 2026-05-09. Scaffolding ~90% selesai, **belum ada training model sungguhan** dan **belum ada deploy kontrak**.

---

## Prioritas (urutan eksekusi)

### Langkah 1 — Dapatkan Dataset Wallet Nyata

Butuh Etherscan API key (gratis). Tanpa ini, training tidak bisa dilanjutkan.

```bash
# 1. Daftar di https://etherscan.io/myapikey (gratis)
# 2. Atur di .env:
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
    # ambil data untuk 50 wallet (label dari tag Etherscan)
    data = await extractor.extract(1, '0x...', max_txs=500)
    print(f'Txs: {len(data.normal_txs)}, Token txs: {len(data.token_txs)}')
asyncio.run(main())
"
```

Target: kumpulkan data untuk **setidaknya 500 wallet** (exchange, trader, bot, normal).

### Langkah 2 — Training di GPU vast.ai

Pilih instance dengan **RTX 3090/4090**, RAM 16GB+, storage 50GB+.

```bash
# SSH ke instance vast.ai
ssh -p <port> root@<ip>

# Setup environment
apt update && apt install -y python3.11 python3-pip git curl
pip install uv

# Clone repo
git clone https://github.com/faisalaffan/chainnusa.git
cd chainnusa/ml-service

# Install dependensi
pip install -e ".[dev,nlp,viz]"

# Upload dataset Anda (scp atau rsync dari laptop)
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
print('Tersimpan ke models/wallet_clf.pkl')
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

# Membutuhkan data sekuens — dari pipeline ETL yang sudah dijalankan
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

#### 2d. Konfigurasi Checkpoint

```bash
# Setelah semua model tersimpan ke models/:
# Salin ke MinIO (via infra MLflow):
# Atau simpan lokal dulu untuk development:
mkdir -p ~/chainnusa/ml-service/models/
# Download dari vast.ai dengan scp
```

### Langkah 3 — Setup MLflow + MinIO (lokal)

```bash
# Dari laptop:
cd infra
docker compose up -d postgres minio mlflow

# Akses:
# MLflow UI: http://localhost:5000
# MinIO Console: http://localhost:9001 (minioadmin / minioadmin)

# Daftarkan model ke MLflow registry dari script training
```

### Langkah 4 — Jalankan Notebook untuk EDA + Dokumentasi

```bash
cd ml-service
jupyter notebook notebooks/
# Buka 00_eda.ipynb → sesuaikan path dataset → jalankan semua sel
# Ulangi untuk 02_supervised, 03_unsupervised, 05_statistics, 06_timeseries
```

### Langkah 5 — Deploy Smart Contract ke Testnet

```bash
cd contracts

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependensi
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit

# Test
forge test -vv

# Deploy ke Sepolia
export DEPLOYER_PRIVATE_KEY=0xda63e647db6bb2b0da52909e82d7eac5138e717ab9d2204f9469d65f2383a68d
export SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/aP8_ob8lpsMG7ywnuAwvC
export ETHERSCAN_API_KEY=your_key
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
```

### Langkah 6 — Integrasi wagmi + RainbowKit ke UI

```bash
cd apps/web
pnpm add wagmi @wagmi/core @wagmi/connectors @rainbow-me/rainbowkit viem
```

Buat komponen `WalletProvider` yang membungkus RainbowKit, dan tombol "Connect" + "Mint Proof" di `Analyzer.tsx`.

### Langkah 7 — IPFS Pin

```bash
cd apps/web
pnpm add @pinata/sdk
```

Alur: POST `/api/analyze` → pilih "Mint proof" → pin hasil analisis JSON ke Pinata → dapatkan CID → panggil `AnalysisRegistry.recordAnalysis()` via wagmi.

### Langkah 8 — Chainlink Price Feed

```bash
cd apps/web
pnpm add @chainlink/contracts
```

Konversi `gasSpent` ke USD menggunakan `AggregatorV3Interface(priceFeedAddress).latestRoundData()`.

---

## Checklist Cepat

| #   | Tugas                          | Lokasi              | Estimasi  |
| --- | ------------------------------ | ------------------- | --------- |
| 1   | Kumpulkan 500+ dataset wallet  | Laptop + Etherscan  | 2-3 jam   |
| 2   | Training classifier (RF+XGBoost) | vast.ai GPU        | 5 menit   |
| 3   | Training anomaly detector      | vast.ai GPU         | 2 menit   |
| 4   | Training model LSTM            | vast.ai GPU         | 3 menit   |
| 5   | Jalankan semua notebook        | vast.ai / laptop    | 2 jam     |
| 6   | Setup MLflow + daftarkan model | Laptop              | 30 menit  |
| 7   | Deploy kontrak ke Sepolia      | Laptop              | 15 menit  |
| 8   | UI wagmi + RainbowKit          | apps/web            | 2 jam     |
| 9   | Alur IPFS pin                  | apps/web            | 1 jam     |
| 10  | Chainlink price feed           | apps/web + contracts| 1 jam     |
| 11  | Test E2E Playwright            | apps/web            | 1,5 jam   |
| 12  | Gitleaks + audit dependensi CI | .github/workflows   | 30 menit  |

---

## Catatan

- **Instance vast.ai**: pilih `RTX 3090` / `RTX 4090` dengan `cuda:12.x`, bid rendah (~$0.20-0.40/jam), storage 50GB+, image `pytorch/pytorch:latest`
- Artifact model (.pkl, .pt) harus diunggah kembali ke repo atau MinIO
- Jangan commit `.pkl`, `.pt`, atau `.db` ke git — sudah di `.gitignore`
- Semua script training dapat dijalankan via `python -c "..."` atau sebagai script mandiri
