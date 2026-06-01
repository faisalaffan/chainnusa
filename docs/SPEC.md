# Cakupan Audit — 3 Roadmaps vs ChainNusa

Pertama, rangkuman apa yang **sudah** vs **belum** tercakup. Persentase = estimasi node roadmap yang tersentuh oleh proyek saat ini.

| Roadmap                 | Cakupan Saat Ini | Catatan                                                                                                                                        |
| ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blockchain**          | ~30%             | Konsumsi data on-chain (EVM, Etherscan, parsing ERC-20, dApp UI) **sudah ada**. Smart contract, keamanan, deployment, oracle, L2/scaling **belum**. |
| **Machine Learning**    | ~5%              | Hanya **memanggil LLM API** (Claude/Ollama). Belum ada fondasi matematika, belum ada training, belum ada evaluasi model.                         |
| **AI & Data Scientist** | ~10%             | Pipeline data sudah ada, tapi belum ada EDA, statistik inferensial, ekonometrik, MLOps.                                                         |

**Kesimpulan:** belum mencakup semuanya. Jika tujuannya = **mencakup ketiga roadmap**, proyek ini perlu diperluas menjadi _platform intelijen on-chain full-stack_ (data + ML + smart contract).

Di bawah ini adalah spesifikasi lengkap.

---

# 📐 SPEC v2 — Edisi Cakupan Penuh ChainNusa

## 1. Visi & Positioning

> **ChainNusa** = platform intelijen wallet on-chain — menggabungkan **dApp** (lapisan Web3), **ML pipeline** (lapisan data science), dan **AI summary** (lapisan LLM). Satu proyek, tiga disiplin ilmu.

Output utama bagi pengguna: skor risiko wallet, klasifikasi tipe wallet, deteksi anomali, prediksi aktivitas, ringkasan bahasa alami, **bukti analisis on-chain**.

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

### 3.1 🔗 Roadmap Blockchain — target cakupan 90%

| Node Roadmap                          | Modul Proyek                                                                                                            | Status   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Basic / General Blockchain            | Bagian "Education" di UI + dokumentasi `/docs/blockchain-101.md`                                                        | Baru     |
| EVM Chains (ETH/BSC/Polygon/Arbitrum) | `src/lib/chains.ts` (perluas ke 6 chain)                                                                                | Perluas  |
| Cryptography (hashing, signing)       | Sign-in wallet (SIWE) + verifikasi signature di server                                                                  | Baru     |
| Cryptowallets                         | Konek via WalletConnect/MetaMask (`wagmi`)                                                                              | Baru     |
| Smart Contracts (Solidity)            | `contracts/AnalysisRegistry.sol`, `contracts/ReportSBT.sol` (Soulbound Token untuk analisis)                             | Baru     |
| Smart Contract Frameworks             | **Foundry** (test + deploy)                                                                                             | Baru     |
| Smart Contract Testing                | `forge test` (unit + invariant + fuzz)                                                                                  | Baru     |
| Smart Contract Security               | Checklist audit + jalankan **Slither** + **Mythril** di CI                                                              | Baru     |
| Oracles                               | Chainlink Price Feed untuk konversi USD dalam analisis                                                                  | Baru     |
| L2 / Scaling                          | Deploy kontrak ke **Arbitrum Sepolia** + **Base Sepolia** testnet                                                       | Baru     |
| Decentralized Storage                 | Simpan ringkasan JSON AI ke **IPFS** (via Pinata/web3.storage), CID dipancarkan on-chain                                | Baru     |
| Node-as-a-Service                     | Gunakan **Alchemy** / **Infura** RPC (dapat dikonfigurasi via env)                                                      | Perluas  |
| dApps Frontend                        | React + Vue (opsional) — saat ini hanya React                                                                           | Existing |
| Client Library                        | Sudah menggunakan `viem`; tambah `ethers` untuk demo write kontrak                                                      | Perluas  |
| Applicability (DeFi/NFT)              | Laporan Soulbound NFT = use-case NFT nyata                                                                              | Baru     |
| Version Control                       | Git + GitHub + Conventional Commits                                                                                    | Existing |

### 3.2 🤖 Roadmap Machine Learning — target cakupan 80%

ML pindah ke **layanan Python terpisah** (`/ml-service`). Diperlukan karena ekosistem ML = Python.

#### 3.2.1 Fondasi Matematika

- Notebook `01_math_foundations.ipynb`: contoh aljabar linear (SVD pada matriks fitur wallet), kalkulus (gradient descent dari awal untuk regresi logistik), probabilitas (Bayes untuk klasifikasi naif).

#### 3.2.2 Pemrograman & Library

- `numpy`, `pandas`, `matplotlib`, `seaborn` di EDA.
- OOP: kelas `WalletFeatureExtractor`, `ModelRegistry`, `ChainDataLoader`.

#### 3.2.3 Koleksi & Pembersihan Data

- `etl/extract.py` — ambil dari Etherscan/RPC ke Postgres.
- `etl/transform.py` — rekayasa fitur: 30+ fitur (lihat §4).
- `etl/load.py` — dataset berversi → `data/processed/v{n}/`.
- Pra-pemrosesan: scaling (`StandardScaler`), encoding, imputasi, **reduksi dimensionalitas** (PCA, t-SNE untuk visualisasi).

#### 3.2.4 Supervised Learning

- **Wallet Classifier** (multi-kelas: `exchange`, `dex_trader`, `dex_lp`, `nft_collector`, `bot/mev`, `phishing`, `normal`).
- Algoritma: Logistic Regression, KNN, SVM, **Random Forest**, **XGBoost**, **Gradient Boosting**.
- Label dari tag Etherscan + dataset publik (Forta, Chainabuse).
- Notebook `02_supervised_classification.ipynb`.

#### 3.2.5 Unsupervised Learning

- **Wallet Clustering** (KMeans, DBSCAN, Hierarchical) → segmentasi wallet → ditampilkan di UI sebagai "wallet persona".
- **Anomaly Detection** (Isolation Forest, One-Class SVM) → tandai wallet outlier.
- Reduksi dimensionalitas: PCA + Autoencoder (PyTorch) untuk visualisasi 2D.

#### 3.2.6 Reinforcement Learning (opsional, lanjutan)

- Lingkungan mainan: agen bidding harga gas (Q-Learning) — notebook saja, bukan production.

#### 3.2.7 Evaluasi Model

- Metrik: akurasi, precision, recall, F1, ROC-AUC, log-loss, confusion matrix.
- Validasi: stratified K-Fold CV, temporal train/val/test split.
- Reproducibilitas: seed tetap + hash dataset.

#### 3.2.8 Deep Learning

- **LSTM** untuk _anomali urutan transaksi_ (input: urutan tx wallet → output: skor anomali). PyTorch.
- **GNN** (opsional, GraphSAGE via PyG) untuk klasifikasi graf wallet → _topik lanjutan_.
- Notebook `03_lstm_tx_sequence.ipynb` + `04_gnn_wallet_graph.ipynb`.

#### 3.2.9 NLP

- Klasifikasi _nama token berisiko_ (BERT-tiny / DistilBERT) → tandai token scam berdasarkan nama simbol.
- Tokenisasi, embeddings, fine-tuning kecil.

#### 3.2.10 Explainable AI

- Nilai **SHAP** untuk wallet classifier, ditampilkan per prediksi di UI.

### 3.3 📊 Roadmap AI & Data Scientist — target cakupan 85%

| Bab                      | Modul Proyek                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Matematika               | Notebook §3.2.1                                                                                                                    |
| Statistik                | Notebook `05_statistics.ipynb`: pengujian hipotesis (apakah rata-rata gas bot wallet > manusia?), CLT, sampling.                    |
| Ekonometrik              | Notebook `06_timeseries.ipynb`: ARIMA + Prophet untuk forecast aktivitas wallet (hitung tx harian).                                 |
| Coding                   | Python + SQL (kueri analitik di Postgres). DSA leetcode log opsional.                                                              |
| Exploratory Data Analysis | Notebook `00_eda.ipynb`: distribusi fitur, korelasi, missing values, outlier, visualisasi.                                          |
| Classic & Advanced ML    | Lihat §3.2.4–3.2.5.                                                                                                                |
| Deep Learning            | §3.2.8                                                                                                                             |
| **MLOps**                | §3.4 (di bawah)                                                                                                                   |

### 3.4 🚀 Lapisan MLOps (lintas-bagian)

- **Containerization**: Dockerfile per layanan + `docker-compose.yml` (web, ml-service, postgres, minio, mlflow).
- **CI/CD**: GitHub Actions
  - Web: typecheck + lint + e2e (Playwright).
  - ML: pytest + lint + train-on-PR (smoke).
  - Contracts: `forge test` + Slither.
- **Experiment Tracking**: Server **MLflow**, mencatat metrik & artifact per run.
- **Model Registry**: MLflow Registry, tag `staging` / `production`.
- **Model Serving**: Endpoint FastAPI `/predict`, muat model dari registry, kembalikan prediksi + SHAP.
- **Monitoring**: Prometheus + Grafana (latensi, error rate, deteksi drift sederhana).
- **Data Versioning**: **DVC** untuk dataset di `data/`.

---

## 4. Spesifikasi Rekayasa Fitur (Wallet → Vector)

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

## 5. Struktur Folder Akhir

```
chainnusa/
├── apps/
│   └── web/                          # Next.js 14 (existing src/)
│       ├── app/
│       ├── components/
│       └── lib/
│           ├── chains.ts
│           ├── etherscan.ts
│           ├── ml-client.ts          # BARU: memanggil ml-service
│           └── contracts/            # BARU: ABI + write helpers
├── ml-service/                       # BARU: Python FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/{predict,explain,cluster}.py
│   │   ├── models/{wallet_clf,anomaly,lstm}.py
│   │   └── features/extractor.py
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
├── contracts/                        # BARU: Proyek Foundry
│   ├── src/
│   │   ├── AnalysisRegistry.sol      # menyimpan CID dari hasil analisis
│   │   └── ReportSBT.sol             # laporan soulbound NFT
│   ├── test/
│   ├── script/Deploy.s.sol
│   └── foundry.toml
├── infra/
│   ├── docker-compose.yml
│   ├── prometheus.yml
│   └── grafana/
├── data/                             # Dilacak DVC
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
├── package.json                      # root workspace (pnpm)
├── pnpm-workspace.yaml
└── README.md
```

---

## 6. Tech Stack Akhir

| Lapisan        | Tech                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 14, Tailwind, Recharts, wagmi, viem, RainbowKit                                        |
| Backend (web)  | Next API Routes, LangChain, Anthropic SDK, Ollama provider                                     |
| ML Service     | Python 3.11, FastAPI, scikit-learn, XGBoost, PyTorch, statsmodels, prophet, transformers, SHAP |
| Smart Contract | Solidity 0.8.x, **Foundry**, OpenZeppelin, Slither, Mythril                                     |
| Database       | PostgreSQL 16 (analytics), SQLite (cache development)                                          |
| Storage        | MinIO/S3 (artifacts), IPFS (Pinata)                                                            |
| MLOps          | MLflow, DVC, Docker, GitHub Actions, Prometheus, Grafana                                       |
| Testing        | Vitest (web), Pytest (ml), Forge (contracts), Playwright (e2e)                                 |

---

## 7. Roadmap Implementasi (Milestones)

| #   | Milestone                                                                                   | Output                                  | Estimasi |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------- | -------- |
| M1  | Restrukturisasi → pnpm monorepo (`apps/web` dulu)                                           | Green build                             | 0.5 hari |
| M2  | Postgres + pipeline ETL (Etherscan → fitur wallet)                                          | Tabel `wallet_features` dengan 1k wallet| 2 hari   |
| M3  | Notebook EDA (`00_eda.ipynb`)                                                              | Insight + plot                          | 1 hari   |
| M4  | Kerangka ML service + `WalletFeatureExtractor` + endpoint `/predict` (dummy)                | Service berjalan di Docker              | 1 hari   |
| M5  | Klasifikasi supervised (RF + XGBoost) + tracking MLflow + SHAP                              | Artifact model + API live               | 3 hari   |
| M6  | Unsupervised (KMeans + Isolation Forest)                                                    | Endpoint `/cluster`, `/anomaly`         | 2 hari   |
| M7  | Notebook statistik & ekonometrik                                                            | 2 notebook + laporan                    | 2 hari   |
| M8  | Anomali urutan tx LSTM                                                                      | Notebook + endpoint                     | 3 hari   |
| M9  | Klasifikasi nama token NLP                                                                  | Notebook + endpoint                     | 2 hari   |
| M10 | Smart contract `AnalysisRegistry` + `ReportSBT` (Foundry, deploy ke Sepolia/Arbitrum Sepolia)| Kontrak terverifikasi + test            | 3 hari   |
| M11 | Sign-in wallet (SIWE) + integrasi Chainlink price feed                                      | Frontend + backend terhubung            | 1.5 hari |
| M12 | Pin IPFS + emisi CID on-chain dari hasil analisis                                           | Alur E2E                                | 1 hari   |
| M13 | CI/CD (3 workflow) + Slither di pipeline                                                    | Semua hijau                             | 1 hari   |
| M14 | Monitoring (Prometheus + Grafana) + cek drift                                               | Dashboard live                          | 1.5 hari |
| M15 | Dokumen + threat model + diagram arsitektur                                                 | `/docs` lengkap                         | 1 hari   |

**Total realistis: ~25 hari kerja** (1 orang full-time).

---

## 8. Quality Gates

- **Web**: typecheck ketat, lint bersih, Playwright e2e (3 happy paths).
- **ML**: cakupan pytest ≥80% pada `features/` dan `models/`, F1 model ≥ 0,75 pada test set, threshold drift terdefinisi.
- **Contracts**: `forge test` 100% lulus, Slither tanpa severity tinggi, cakupan baris ≥90%, snapshot gas terlacak.
- **Security**: tidak ada rahasia di repo (gitleaks di CI), audit dependensi (npm audit + pip-audit) di CI.

---

## 9. Pemetaan Akhir ke 3 Roadmaps (target setelah implementasi)

| Roadmap             | Target Cakupan | Bukti                                                                                               |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| Blockchain          | **90%**        | Kontrak Foundry + test + Slither + Chainlink + IPFS + deploy L2 + dApp                              |
| Machine Learning    | **80%**        | Notebook matematika, sklearn, XGBoost, PyTorch LSTM, SHAP, NLP, metrik evaluasi                     |
| AI & Data Scientist | **85%**        | EDA, statistik, ekonometrik, rantai MLOps penuh (MLflow + Docker + CI/CD + monitoring)              |

Sisanya 10-20% (misalnya, deep RL, GAN, Substrate non-EVM, ekonometrik lanjutan CUPED) sengaja **di luar cakupan** karena tidak relevan dengan domain analisis wallet — didokumentasikan di `docs/out-of-scope.md` sebagai justifikasi akademis.
