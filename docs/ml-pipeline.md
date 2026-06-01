# ML Pipeline — ChainNusa

## Tujuan

Dari alamat wallet → feature vector → prediksi (klasifikasi tipe wallet, anomaly, sequence anomaly) + explainability (SHAP).

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
              Next.js apps/web → ditampilkan di UI dengan plot SHAP
```

## Rekayasa fitur — 30+ fitur

Lihat `ml-service/app/features/extractor.py`. Kategori:

- **Aktivitas** (6): tx_count, active_days, avg_tx_per_day, days_since_first_tx, days_since_last_tx, dormant_ratio
- **Volume** (7): native_in, native_out, net_flow, gas_spent, avg_tx_value, std_tx_value, max_tx_value
- **Counterparty** (4): unique_counterparties, top1_share, contract_interaction_ratio, eoa_interaction_ratio
- **Token** (4): unique_tokens, erc20_tx_ratio, stablecoin_ratio, nft_tx_count
- **Perilaku** (5): dex_swap_ratio, failed_tx_ratio, self_tx_ratio, weekend_activity_ratio, night_activity_ratio
- **Sinyal Risiko** (3): interactions_with_known_mixer, interactions_with_phishing_list, new_token_creation_count
- **Sequence (untuk LSTM)** (3 seri): tx_value_series[T], gas_series[T], time_delta_series[T]

## Sumber label

Multi-sumber, urutan prioritas:
1. **Etherscan tag API** (exchange terpusat, MEV bot, mixer, dll.).
2. **Forta** detection bots — alamat berbahaya/phishing.
3. **Chainabuse** dataset publik.
4. **Dune Analytics** daftar kurasi komunitas.
5. **Aturan heuristik** (fallback): wallet dengan >1000 tx/hari → bot, >50 token unik → trader, dll.

Label disimpan di tabel `labels` (Postgres) dengan kolom `source`, `confidence`, `created_at`.

## Model

### 1. Wallet Classifier (supervised, multi-class)

- **Kelas**: `exchange`, `dex_trader`, `dex_lp`, `nft_collector`, `bot`, `phishing`, `normal`.
- **Algoritma**: LogReg → KNN → SVM → Random Forest → **XGBoost** (champion).
- **sklearn pipeline**: `StandardScaler` → opsional `PCA(n=15)` → classifier.
- **Eval**: stratified 5-fold CV; metrik utama F1-macro karena ketidakseimbangan.
- **Quality gate**: F1 ≥ 0,75 pada test set sebelum deploy ke registry "production".

### 2. Anomaly Detection (unsupervised)

- **Isolation Forest** + **One-Class SVM** ensemble.
- Skor = peringkat rata-rata dari kedua model. Persentil ke-95 = threshold anomaly.
- Use case: menandai wallet baru dengan perilaku outlier.

### 3. LSTM Tx Sequence Anomaly (deep learning)

- Input: sequence per-wallet `[(value, gas, time_delta), ...]` panjang T=64.
- Arsitektur: 2x LSTM(hidden=64) → linear head → reconstruction loss.
- Anomaly score = reconstruction error.
- **PERINGATAN SUMBER DAYA**: training di CPU laptop = ~30 menit untuk 10k wallet. GPU = ~3 menit. Lihat `ml-service/notebooks/04_lstm_tx_sequence.ipynb`.

### 4. NLP Token Risk Classifier

- Input: string simbol + nama token.
- Model: DistilBERT fine-tuned (biner: scam / clean).
- Label: daftar token scam (CryptoScamDB, dll.).
- **PERINGATAN SUMBER DAYA**: fine-tuning memerlukan GPU (atau CPU sabar + batch kecil). Inference cepat di CPU.

## AI yang dapat dijelaskan

- **SHAP TreeExplainer** untuk RF/XGBoost classifier.
- Output per-prediksi: kontribusi fitur top-N dengan tanda + magnitudo.
- Ditampilkan di UI sebagai bar chart: "mengapa wallet ini diklasifikasikan sebagai `dex_trader`".
- Kompatibel dengan logging Postgres untuk audit trail.

## MLOps

| Aspek | Tools | Catatan |
|---|---|---|
| Experiment tracking | MLflow | server di `infra/docker-compose.yml` |
| Model registry | MLflow | tag `staging` / `production` |
| Data versioning | DVC | dilacak di `data/` (gitignored), remote = MinIO |
| Containerization | Docker | per service |
| CI | GH Actions | `ml.yml` menjalankan pytest + lint + smoke train |
| Monitoring | Prometheus + Grafana | latency, error rate, drift (PSI vs reference) |
| Deteksi drift | sederhana (PSI per fitur) | threshold 0.2 = warning, 0.3 = alert |

## Checklist reprodusibilitas

- [x] Seed tetap (`numpy`, `torch`, `random`, `sklearn` random_state)
- [x] Hash dataset tercatat di parameter run MLflow
- [x] `requirements.txt` / `pyproject.toml` mengunci major version
- [x] Dockerfile per service (training image vs serving image split opsional)
- [x] Notebook menggunakan parameter cell yang kompatibel dengan `papermill`
