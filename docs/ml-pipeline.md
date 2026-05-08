# ML Pipeline — ChainNusa

## Tujuan

Dari address wallet → vektor fitur → prediksi (klasifikasi tipe wallet, anomali, sequence anomaly) + explainability (SHAP).

## Pipeline

```
[ Etherscan / RPC ] ──▶ etl/extract.py ──▶ raw_tx (Postgres)
                                              │
                                              ▼
                                  features/extractor.py (30+ fitur)
                                              │
                                              ▼
                                wallet_features (Postgres) ── DVC versioned
                                              │
        ┌─────────────────────┬───────────────┴────────────────┐
        ▼                     ▼                                ▼
 train_clf.py            train_anomaly.py                 train_lstm.py
   (RF + XGB)         (Isolation Forest)                 (PyTorch)
        │                     │                                │
        ▼                     ▼                                ▼
              MLflow tracking + artifact registry
                              │
                              ▼
                  FastAPI /predict /explain /cluster
                              │
                              ▼
              Next.js apps/web → tampil di UI dengan SHAP plot
```

## Feature engineering — 30+ fitur

Lihat `ml-service/app/features/extractor.py`. Kategori:

- **Activity** (6): tx_count, active_days, avg_tx_per_day, days_since_first_tx, days_since_last_tx, dormant_ratio
- **Volume** (7): native_in, native_out, net_flow, gas_spent, avg_tx_value, std_tx_value, max_tx_value
- **Counterparty** (4): unique_counterparties, top1_share, contract_interaction_ratio, eoa_interaction_ratio
- **Token** (4): unique_tokens, erc20_tx_ratio, stablecoin_ratio, nft_tx_count
- **Behavior** (5): dex_swap_ratio, failed_tx_ratio, self_tx_ratio, weekend_activity_ratio, night_activity_ratio
- **Risk Signals** (3): interactions_with_known_mixer, interactions_with_phishing_list, new_token_creation_count
- **Sequence (untuk LSTM)** (3 series): tx_value_series[T], gas_series[T], time_delta_series[T]

## Label sources

Multi-source, prioritas berurut:
1. **Etherscan tag API** (centralized exchange, MEV bot, mixer, dll).
2. **Forta** detection bots — alamat malicious/phishing.
3. **Chainabuse** public dataset.
4. **Dune Analytics** community-curated lists.
5. **Heuristic rules** (fallback): wallet dengan >1000 tx/hari → bot, >50 unique tokens → trader, dll.

Label disimpan di `labels` table (Postgres) dengan kolom `source`, `confidence`, `created_at`.

## Models

### 1. Wallet Classifier (supervised, multi-class)

- **Classes**: `exchange`, `dex_trader`, `dex_lp`, `nft_collector`, `bot`, `phishing`, `normal`.
- **Algoritma**: LogReg → KNN → SVM → Random Forest → **XGBoost** (champion).
- **Pipeline sklearn**: `StandardScaler` → optional `PCA(n=15)` → classifier.
- **Eval**: stratified 5-fold CV; metric utama F1-macro karena imbalanced.
- **Quality gate**: F1 ≥ 0.75 di test set sebelum deploy ke registry "production".

### 2. Anomaly Detection (unsupervised)

- **Isolation Forest** + **One-Class SVM** ensemble.
- Score = mean rank dari kedua model. Threshold 95th percentile = anomaly.
- Use case: flag wallet baru yang behavior-nya outlier.

### 3. LSTM Tx Sequence Anomaly (deep learning)

- Input: sequence per wallet `[(value, gas, time_delta), ...]` panjang T=64.
- Arsitektur: 2x LSTM(hidden=64) → linear head → reconstruction loss.
- Anomaly score = reconstruction error.
- **RESOURCE WARNING**: training di laptop CPU = ~30 menit untuk 10k wallet. GPU = ~3 menit. Lihat `ml-service/notebooks/04_lstm_tx_sequence.ipynb`.

### 4. NLP Token Risk Classifier

- Input: token symbol + name strings.
- Model: DistilBERT fine-tuned (binary: scam / clean).
- Labels: scam token list (CryptoScamDB, dll).
- **RESOURCE WARNING**: fine-tune membutuhkan GPU (atau patient CPU + small batch). Inference cepat di CPU.

## Explainable AI

- **SHAP TreeExplainer** untuk RF/XGBoost classifier.
- Output per prediksi: top-N feature contribution dengan sign + magnitude.
- Ditampilkan di UI sebagai bar chart "kenapa wallet ini diklasifikasi `dex_trader`".
- Kompatibel dengan Postgres logging untuk audit trail.

## MLOps

| Aspek | Tool | Catatan |
|---|---|---|
| Experiment tracking | MLflow | server di `infra/docker-compose.yml` |
| Model registry | MLflow | tag `staging` / `production` |
| Data versioning | DVC | tracked di `data/` (gitignored), remote = MinIO |
| Containerization | Docker | per service |
| CI | GH Actions | `ml.yml` jalankan pytest + lint + smoke train |
| Monitoring | Prometheus + Grafana | latency, error rate, drift (PSI vs reference) |
| Drift detection | sederhana (PSI per fitur) | threshold 0.2 = warn, 0.3 = alert |

## Reproducibility checklist

- [x] Seed fixed (`numpy`, `torch`, `random`, `sklearn` random_state)
- [x] Dataset hash dicantumkan di MLflow run params
- [x] `requirements.txt` / `pyproject.toml` pin major versions
- [x] Dockerfile per service (training image vs serving image dipisah opsional)
- [x] Notebook menggunakan `papermill`-friendly parameters cell
