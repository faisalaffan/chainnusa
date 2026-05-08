# Audit Coverage 3 Roadmap vs [chainnusa](cci:9://file:///Users/faisalaffan/Downloads/chainnusa:0:0-0:0)

Ringkas dulu apa yang **sudah** vs **belum** ter-cover. Persentase = estimasi node roadmap yang tersentuh proyek saat ini.

| Roadmap                 | Coverage Sekarang | Catatan                                                                                                                                        |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blockchain**          | ~30%              | Konsumsi data on-chain (EVM, Etherscan, ERC-20 parsing, dApp UI) **ada**. Smart contract, security, deployment, oracles, L2/scaling **belum**. |
| **Machine Learning**    | ~5%               | Hanya **memanggil LLM API** (Claude/Ollama). Tidak ada math foundation, tidak ada training, tidak ada evaluasi model.                          |
| **AI & Data Scientist** | ~10%              | Pipeline data ada, tapi tidak ada EDA, statistik inferensial, econometrics, MLOps.                                                             |

**Kesimpulan:** belum coverage semua. Kalau target = **cover ketiga roadmap**, proyek perlu di-extend menjadi _full-stack on-chain intelligence platform_ (data + ML + smart contract).

Berikut spesifikasi lengkapnya.

---

# 📐 SPEC v2 — [chainnusa](cci:9://file:///Users/faisalaffan/Downloads/chainnusa:0:0-0:0) Full Coverage Edition

## 1. Visi & Positioning

> **ChainNusa** = on-chain wallet intelligence platform — gabungan **dApp** (Web3 layer), **ML pipeline** (data science layer), dan **AI summary** (LLM layer). Satu proyek, tiga sisi keilmuan.

Output utama bagi user: skor risiko wallet, klasifikasi tipe wallet, deteksi anomali, prediksi aktivitas, summary natural language, **bukti on-chain (proof of analysis)**.

---

## 2. Arsitektur Target (Multi-Service)

```
┌───────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                     │
│   Tailwind · Recharts · wagmi/viem · sign-in with wallet      │
└───────────────────────────┬───────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ Next API     │   │ ML Service       │   │ Smart Contract  │
│ (Node/TS)    │◀─▶│ (Python/FastAPI) │   │ (Solidity)      │
│              │   │                  │   │                 │
│ - Etherscan  │   │ - sklearn        │   │ - AnalysisProof │
│ - LangChain  │   │ - PyTorch        │   │ - SBT Reports   │
│ - SQLite/PG  │   │ - statsmodels    │   │ - AccessControl │
│ - Cache      │   │ - MLflow         │   │ + Foundry tests │
└──────┬───────┘   └────────┬─────────┘   └────────┬────────┘
       │                    │                      │
       └─── PostgreSQL ─────┴── MinIO/S3 (artifacts)┘
                            │
                  ┌─────────┴──────────┐
                  │  MLOps             │
                  │  (Docker, GH Actions, MLflow Registry, Prometheus) │
                  └────────────────────┘
```

---

## 3. Modul Lengkap per Roadmap

### 3.1 🔗 Blockchain Roadmap — target coverage 90%

| Node Roadmap                          | Modul Proyek                                                                                                             | Status   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| Basic / General Blockchain            | Bagian "Education" di UI + dokumentasi `/docs/blockchain-101.md`                                                         | New      |
| EVM Chains (ETH/BSC/Polygon/Arbitrum) | [src/lib/chains.ts](cci:7://file:///Users/faisalaffan/Downloads/chainnusa/src/lib/chains.ts:0:0-0:0) (extend ke 6 chain) | Extend   |
| Cryptography (hashing, signing)       | Wallet sign-in (SIWE) + verify signature server-side                                                                     | New      |
| Cryptowallets                         | Connect via WalletConnect/MetaMask (`wagmi`)                                                                             | New      |
| Smart Contracts (Solidity)            | `contracts/AnalysisRegistry.sol`, `contracts/ReportSBT.sol` (Soulbound Token analisis)                                   | New      |
| Smart Contract Frameworks             | **Foundry** (test + deploy)                                                                                              | New      |
| Smart Contract Testing                | `forge test` (unit + invariant + fuzz)                                                                                   | New      |
| Smart Contract Security               | Audit checklist + run **Slither** + **Mythril** di CI                                                                    | New      |
| Oracles                               | Chainlink Price Feed untuk konversi USD di analisis                                                                      | New      |
| L2 / Scaling                          | Deploy contract ke **Arbitrum Sepolia** + **Base Sepolia** testnet                                                       | New      |
| Decentralized Storage                 | Simpan AI summary JSON di **IPFS** (via Pinata/web3.storage), CID di-emit on-chain                                       | New      |
| Node-as-a-Service                     | Pakai **Alchemy** / **Infura** RPC (env-configurable)                                                                    | Extend   |
| dApps Frontend                        | React + Vue (opsional) — saat ini React saja                                                                             | Existing |
| Client Library                        | Sudah pakai `viem`; tambah `ethers` untuk contract write demo                                                            | Extend   |
| Applicability (DeFi/NFT)              | Soulbound NFT report = NFT use-case nyata                                                                                | New      |
| Version Control                       | Git + GitHub + Conventional Commits                                                                                      | Existing |

### 3.2 🤖 Machine Learning Roadmap — target coverage 80%

ML pindah ke **service Python terpisah** (`/ml-service`). Wajib karena ekosistem ML = Python.

#### 3.2.1 Mathematical Foundations

- Notebook `01_math_foundations.ipynb`: contoh linear algebra (SVD pada feature matrix wallet), kalkulus (gradient descent dari nol untuk logistic regression), probability (Bayes untuk klasifikasi naive).

#### 3.2.2 Programming & Libraries

- `numpy`, `pandas`, `matplotlib`, `seaborn` di EDA.
- OOP: kelas `WalletFeatureExtractor`, `ModelRegistry`, `ChainDataLoader`.

#### 3.2.3 Data Collection & Cleaning

- `etl/extract.py` — fetch dari Etherscan/RPC ke Postgres.
- `etl/transform.py` — feature engineering: 30+ fitur (lihat §4).
- `etl/load.py` — versioned dataset → `data/processed/v{n}/`.
- Preprocessing: scaling (`StandardScaler`), encoding, imputation, **dimensionality reduction** (PCA, t-SNE untuk visualisasi).

#### 3.2.4 Supervised Learning

- **Wallet Classifier** (multi-class: `exchange`, `dex_trader`, `dex_lp`, `nft_collector`, `bot/mev`, `phishing`, `normal`).
- Algoritma: Logistic Regression, KNN, SVM, **Random Forest**, **XGBoost**, **Gradient Boosting**.
- Label dari Etherscan tags + dataset publik (Forta, Chainabuse).
- Notebook `02_supervised_classification.ipynb`.

#### 3.2.5 Unsupervised Learning

- **Wallet Clustering** (KMeans, DBSCAN, Hierarchical) → segmentasi wallet → tampil di UI sebagai "wallet persona".
- **Anomaly Detection** (Isolation Forest, One-Class SVM) → flag wallet outlier.
- Dimensionality reduction: PCA + Autoencoder (PyTorch) untuk visualisasi 2D.

#### 3.2.6 Reinforcement Learning (opsional, advanced)

- Toy env: gas-price bidding agent (Q-Learning) — notebook only, bukan production.

#### 3.2.7 Model Evaluation

- Metrics: accuracy, precision, recall, F1, ROC-AUC, log-loss, confusion matrix.
- Validation: stratified K-Fold CV, train/val/test split temporal.
- Reproducibility: fixed seeds + dataset hash.

#### 3.2.8 Deep Learning

- **LSTM** untuk _transaction sequence anomaly_ (input: urutan tx wallet → output: anomaly score). PyTorch.
- **GNN** (opsional, GraphSAGE via PyG) untuk wallet-graph classification → _advanced topic_.
- Notebook `03_lstm_tx_sequence.ipynb` + `04_gnn_wallet_graph.ipynb`.

#### 3.2.9 NLP

- Klasifikasi _risky token name_ (BERT-tiny / DistilBERT) → flag scam-token berdasarkan nama symbol.
- Tokenization, embeddings, fine-tuning kecil.

#### 3.2.10 Explainable AI

- **SHAP** values untuk wallet classifier, ditampilkan di UI per prediksi.

### 3.3 📊 AI & Data Scientist Roadmap — target coverage 85%

| Bab                       | Modul Proyek                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mathematics               | Notebook §3.2.1                                                                                         |
| Statistics                | Notebook `05_statistics.ipynb`: hypothesis testing (apakah avg gas wallet bot > human?), CLT, sampling. |
| Econometrics              | Notebook `06_timeseries.ipynb`: ARIMA + Prophet untuk forecast aktivitas wallet (daily tx count).       |
| Coding                    | Python + SQL (analytics queries di Postgres). DSA leetcode log opsional.                                |
| Exploratory Data Analysis | Notebook `00_eda.ipynb`: distribusi fitur, korelasi, missing, outlier, visualisasi.                     |
| Classic & Advanced ML     | Lihat §3.2.4–3.2.5.                                                                                     |
| Deep Learning             | §3.2.8                                                                                                  |
| **MLOps**                 | §3.4 (di bawah)                                                                                         |

### 3.4 🚀 MLOps Layer (cross-cutting)

- **Containerization**: [Dockerfile](cci:7://file:///Users/faisalaffan/Downloads/chainnusa/Dockerfile:0:0-0:0) per service + `docker-compose.yml` (web, ml-service, postgres, minio, mlflow).
- **CI/CD**: GitHub Actions
  - Web: typecheck + lint + e2e (Playwright).
  - ML: pytest + lint + train-on-PR (smoke).
  - Contracts: `forge test` + Slither.
- **Experiment Tracking**: **MLflow** server, logging metric & artifact tiap run.
- **Model Registry**: MLflow Registry, tag `staging` / `production`.
- **Model Serving**: FastAPI endpoint `/predict`, load model dari registry, return prediksi + SHAP.
- **Monitoring**: Prometheus + Grafana (latency, error rate, drift detection sederhana).
- **Data Versioning**: **DVC** untuk dataset di [data/](cci:9://file:///Users/faisalaffan/Downloads/chainnusa/data:0:0-0:0).

---

## 4. Feature Engineering Spec (Wallet → Vektor)

Output `WalletFeatureExtractor.extract(address, chain) → dict[str, float]`:

```
Activity:        tx_count, active_days, avg_tx_per_day, days_since_first_tx,
                 days_since_last_tx, dormant_ratio
Volume:          native_in, native_out, net_flow, gas_spent, avg_tx_value,
                 std_tx_value, max_tx_value
Counterparty:    unique_counterparties, top1_share, contract_interaction_ratio,
                 eoa_interaction_ratio
Token:           unique_tokens, erc20_tx_ratio, stablecoin_ratio, nft_tx_count
Behavior:        dex_swap_ratio, failed_tx_ratio, self_tx_ratio,
                 weekend_activity_ratio, night_activity_ratio
Risk Signals:    interactions_with_known_mixer, interactions_with_phishing_list,
                 new_token_creation_count
Sequence (DL):   tx_value_series[T], gas_series[T], time_delta_series[T]
```

---

## 5. Struktur Folder Final

```
chainnusa/
├── apps/
│   └── web/                          # Next.js 14 (existing src/)
│       ├── app/
│       ├── components/
│       └── lib/
│           ├── chains.ts
│           ├── etherscan.ts
│           ├── ml-client.ts          # NEW: panggil ml-service
│           └── contracts/            # NEW: ABI + write helpers
├── ml-service/                       # NEW: Python FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/{predict,explain,cluster}.py
│   │   ├── models/{wallet_clf,anomaly,lstm}.py
│   │   ├── features/extractor.py
│   │   └── etl/{extract,transform,load}.py
│   ├── notebooks/
│   │   ├── 00_eda.ipynb
│   │   ├── 01_math_foundations.ipynb
│   │   ├── 02_supervised_classification.ipynb
│   │   ├── 03_unsupervised_clustering.ipynb
│   │   ├── 04_lstm_tx_sequence.ipynb
│   │   ├── 05_statistics.ipynb
│   │   ├── 06_timeseries_arima.ipynb
│   │   ├── 07_nlp_token_name.ipynb
│   │   └── 08_explainable_ai_shap.ipynb
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── contracts/                        # NEW: Foundry project
│   ├── src/
│   │   ├── AnalysisRegistry.sol      # store CID hasil analisis
│   │   └── ReportSBT.sol             # soulbound NFT laporan
│   ├── test/
│   ├── script/Deploy.s.sol
│   └── foundry.toml
├── infra/
│   ├── docker-compose.yml
│   ├── prometheus.yml
│   └── grafana/
├── data/                             # DVC tracked
│   ├── raw/
│   ├── processed/
│   └── labels/
├── .github/workflows/
│   ├── web.yml
│   ├── ml.yml
│   └── contracts.yml
├── docs/
│   ├── architecture.md
│   ├── blockchain-101.md
│   ├── ml-pipeline.md
│   └── threat-model.md
├── package.json                      # workspace root (pnpm)
├── pnpm-workspace.yaml
└── README.md
```

---

## 6. Tech Stack Final

| Layer          | Tech                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 14, Tailwind, Recharts, wagmi, viem, RainbowKit                                        |
| Backend (web)  | Next API Routes, LangChain, Anthropic SDK, Ollama provider                                     |
| ML Service     | Python 3.11, FastAPI, scikit-learn, XGBoost, PyTorch, statsmodels, prophet, transformers, SHAP |
| Smart Contract | Solidity 0.8.x, **Foundry**, OpenZeppelin, Slither, Mythril                                    |
| Database       | PostgreSQL 16 (analytics), SQLite (dev cache)                                                  |
| Storage        | MinIO/S3 (artifact), IPFS (Pinata)                                                             |
| MLOps          | MLflow, DVC, Docker, GitHub Actions, Prometheus, Grafana                                       |
| Testing        | Vitest (web), Pytest (ml), Forge (contracts), Playwright (e2e)                                 |

---

## 7. Roadmap Implementasi (Milestone)

| #   | Milestone                                                                                     | Output                                   | Estimasi |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------- | -------- |
| M1  | Restructure → pnpm monorepo (`apps/web` saja dulu)                                            | Build hijau                              | 0.5 hari |
| M2  | Postgres + ETL pipeline (Etherscan → fitur wallet)                                            | Tabel `wallet_features` terisi 1k wallet | 2 hari   |
| M3  | EDA notebook (`00_eda.ipynb`)                                                                 | Insight + plot                           | 1 hari   |
| M4  | ML service skeleton + `WalletFeatureExtractor` + endpoint `/predict` (dummy)                  | Service jalan di Docker                  | 1 hari   |
| M5  | Supervised classifier (RF + XGBoost) + MLflow tracking + SHAP                                 | Model artifact + API live                | 3 hari   |
| M6  | Unsupervised (KMeans + Isolation Forest)                                                      | Endpoint `/cluster`, `/anomaly`          | 2 hari   |
| M7  | Statistics & Econometrics notebooks                                                           | 2 notebook + report                      | 2 hari   |
| M8  | LSTM tx-sequence anomaly                                                                      | Notebook + endpoint                      | 3 hari   |
| M9  | NLP token-name classifier                                                                     | Notebook + endpoint                      | 2 hari   |
| M10 | Smart contract `AnalysisRegistry` + `ReportSBT` (Foundry, deploy ke Sepolia/Arbitrum Sepolia) | Verified contract + tests                | 3 hari   |
| M11 | Wallet sign-in (SIWE) + Chainlink price feed integration                                      | Frontend + backend wired                 | 1.5 hari |
| M12 | IPFS pin + CID emit on-chain dari hasil analisis                                              | E2E flow                                 | 1 hari   |
| M13 | CI/CD (3 workflow) + Slither di pipeline                                                      | All green                                | 1 hari   |
| M14 | Monitoring (Prometheus + Grafana) + drift check                                               | Dashboard live                           | 1.5 hari |
| M15 | Docs + threat model + architecture diagram                                                    | `/docs` lengkap                          | 1 hari   |

**Total realistis: ~25 hari kerja** (1 orang full-time).

---

## 8. Quality Gates

- **Web**: typecheck strict, lint clean, Playwright e2e (3 happy path).
- **ML**: pytest coverage ≥80% pada `features/` dan `models/`, model F1 ≥ 0.75 pada test set, drift threshold defined.
- **Contracts**: `forge test` 100% pass, Slither no high-severity, ≥90% line coverage, gas snapshot tracked.
- **Security**: tidak ada secret di repo (gitleaks di CI), dependency audit (npm audit + pip-audit) di CI.

---

## 9. Mapping Akhir ke 3 Roadmap (target setelah implementasi)

| Roadmap             | Coverage Target | Bukti                                                                                  |
| ------------------- | --------------- | -------------------------------------------------------------------------------------- |
| Blockchain          | **90%**         | Foundry contract + tests + Slither + Chainlink + IPFS + L2 deploy + dApp               |
| Machine Learning    | **80%**         | Math notebook, sklearn, XGBoost, PyTorch LSTM, SHAP, NLP, eval metrics                 |
| AI & Data Scientist | **85%**         | EDA, statistics, econometrics, MLOps full chain (MLflow + Docker + CI/CD + monitoring) |

Sisa 10–20% (mis. RL deep, GAN, Substrate non-EVM, advanced econometrics CUPED) sengaja **out-of-scope** karena tidak relevan dengan domain wallet analysis — bisa dicantumkan di `docs/out-of-scope.md` sebagai justifikasi akademis.

---

## 10. Langkah Berikutnya

Karena saya sekarang di **Ask mode**, saya tidak bisa langsung menulis spec ini ke file atau scaffolding kode. Tolong konfirmasi dulu **3 hal**:

- **Penempatan spec**: simpan dokumen ini sebagai `@/Users/faisalaffan/Downloads/chainnusa/docs/SPEC.md`? Atau pecah jadi beberapa file (`architecture.md`, `roadmap.md`, dll)?
- **Branch strategy**: kerja di `feature/v2-full-coverage` dari `master`? Atau langsung di `master`?
- **Scope eksekusi sekarang**: setelah Anda _Code mode_, saya kerjakan **M1–M5** dulu (foundation: monorepo + Postgres + ETL + EDA + 1 model supervised), atau full M1–M15?

Setelah konfirmasi + switch ke **Code mode**, saya mulai milestone-nya satu per satu sesuai protokol (clarify → plan → execute → verify).
