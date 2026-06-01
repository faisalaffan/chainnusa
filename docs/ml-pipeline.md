# ML Pipeline — ChainNusa

## Purpose

From wallet address → feature vector → prediction (wallet type classification, anomaly, sequence anomaly) + explainability (SHAP).

## Pipeline

```
[ Etherscan / RPC ] ──▶ etl/extract.py ──▶ raw_tx (Postgres)
                                              │
                                              ▼
                                  features/extractor.py (30+ features)
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
              Next.js apps/web → displayed in UI with SHAP plots
```

## Feature engineering — 30+ features

See `ml-service/app/features/extractor.py`. Categories:

- **Activity** (6): tx_count, active_days, avg_tx_per_day, days_since_first_tx, days_since_last_tx, dormant_ratio
- **Volume** (7): native_in, native_out, net_flow, gas_spent, avg_tx_value, std_tx_value, max_tx_value
- **Counterparty** (4): unique_counterparties, top1_share, contract_interaction_ratio, eoa_interaction_ratio
- **Token** (4): unique_tokens, erc20_tx_ratio, stablecoin_ratio, nft_tx_count
- **Behavior** (5): dex_swap_ratio, failed_tx_ratio, self_tx_ratio, weekend_activity_ratio, night_activity_ratio
- **Risk Signals** (3): interactions_with_known_mixer, interactions_with_phishing_list, new_token_creation_count
- **Sequence (for LSTM)** (3 series): tx_value_series[T], gas_series[T], time_delta_series[T]

## Label sources

Multi-source, priority order:
1. **Etherscan tag API** (centralized exchange, MEV bot, mixer, etc.).
2. **Forta** detection bots — malicious/phishing addresses.
3. **Chainabuse** public dataset.
4. **Dune Analytics** community-curated lists.
5. **Heuristic rules** (fallback): wallet with >1000 tx/day → bot, >50 unique tokens → trader, etc.

Labels stored in `labels` table (Postgres) with columns `source`, `confidence`, `created_at`.

## Models

### 1. Wallet Classifier (supervised, multi-class)

- **Classes**: `exchange`, `dex_trader`, `dex_lp`, `nft_collector`, `bot`, `phishing`, `normal`.
- **Algorithms**: LogReg → KNN → SVM → Random Forest → **XGBoost** (champion).
- **sklearn pipeline**: `StandardScaler` → optional `PCA(n=15)` → classifier.
- **Eval**: stratified 5-fold CV; primary metric F1-macro due to imbalance.
- **Quality gate**: F1 ≥ 0.75 on test set before deploying to "production" registry.

### 2. Anomaly Detection (unsupervised)

- **Isolation Forest** + **One-Class SVM** ensemble.
- Score = mean rank from both models. 95th percentile threshold = anomaly.
- Use case: flag new wallets with outlier behavior.

### 3. LSTM Tx Sequence Anomaly (deep learning)

- Input: per-wallet sequence `[(value, gas, time_delta), ...]` length T=64.
- Architecture: 2x LSTM(hidden=64) → linear head → reconstruction loss.
- Anomaly score = reconstruction error.
- **RESOURCE WARNING**: training on laptop CPU = ~30 minutes for 10k wallets. GPU = ~3 minutes. See `ml-service/notebooks/04_lstm_tx_sequence.ipynb`.

### 4. NLP Token Risk Classifier

- Input: token symbol + name strings.
- Model: DistilBERT fine-tuned (binary: scam / clean).
- Labels: scam token list (CryptoScamDB, etc.).
- **RESOURCE WARNING**: fine-tuning requires GPU (or patient CPU + small batch). Inference is fast on CPU.

## Explainable AI

- **SHAP TreeExplainer** for RF/XGBoost classifier.
- Per-prediction output: top-N feature contributions with sign + magnitude.
- Displayed in UI as a bar chart: "why this wallet is classified `dex_trader`".
- Compatible with Postgres logging for audit trail.

## MLOps

| Aspect | Tool | Notes |
|---|---|---|
| Experiment tracking | MLflow | server in `infra/docker-compose.yml` |
| Model registry | MLflow | tag `staging` / `production` |
| Data versioning | DVC | tracked in `data/` (gitignored), remote = MinIO |
| Containerization | Docker | per service |
| CI | GH Actions | `ml.yml` runs pytest + lint + smoke train |
| Monitoring | Prometheus + Grafana | latency, error rate, drift (PSI vs reference) |
| Drift detection | simple (PSI per feature) | threshold 0.2 = warn, 0.3 = alert |

## Reproducibility checklist

- [x] Seed fixed (`numpy`, `torch`, `random`, `sklearn` random_state)
- [x] Dataset hash recorded in MLflow run params
- [x] `requirements.txt` / `pyproject.toml` pin major versions
- [x] Dockerfile per service (training image vs serving image split optional)
- [x] Notebooks use `papermill`-friendly parameters cell
