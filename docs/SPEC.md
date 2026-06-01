# Audit Coverage — 3 Roadmaps vs ChainNusa

First, summarize what is **already** vs **not yet** covered. Percentage = estimated roadmap nodes touched by the current project.

| Roadmap                 | Current Coverage | Notes                                                                                                                                        |
| ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blockchain**          | ~30%             | On-chain data consumption (EVM, Etherscan, ERC-20 parsing, dApp UI) **exists**. Smart contracts, security, deployment, oracles, L2/scaling **not yet**. |
| **Machine Learning**    | ~5%              | Only **calling LLM APIs** (Claude/Ollama). No math foundations, no training, no model evaluation.                                              |
| **AI & Data Scientist** | ~10%             | Data pipeline exists, but no EDA, inferential statistics, econometrics, MLOps.                                                                |

**Conclusion:** not yet covering everything. If the goal = **cover all three roadmaps**, the project needs to be extended into a _full-stack on-chain intelligence platform_ (data + ML + smart contracts).

Below is the complete specification.

---

# 📐 SPEC v2 — ChainNusa Full Coverage Edition

## 1. Vision & Positioning

> **ChainNusa** = on-chain wallet intelligence platform — combining **dApp** (Web3 layer), **ML pipeline** (data science layer), and **AI summary** (LLM layer). One project, three scientific disciplines.

Primary output for users: wallet risk score, wallet type classification, anomaly detection, activity prediction, natural language summary, **on-chain proof of analysis**.

---

## 2. Target Architecture (Multi-Service)

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

## 3. Complete Modules per Roadmap

### 3.1 🔗 Blockchain Roadmap — target coverage 90%

| Roadmap Node                          | Project Module                                                                                                             | Status   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| Basic / General Blockchain            | "Education" section in UI + documentation `/docs/blockchain-101.md`                                                        | New      |
| EVM Chains (ETH/BSC/Polygon/Arbitrum) | `src/lib/chains.ts` (extend to 6 chains)                                                                                   | Extend   |
| Cryptography (hashing, signing)       | Wallet sign-in (SIWE) + verify signature server-side                                                                       | New      |
| Cryptowallets                         | Connect via WalletConnect/MetaMask (`wagmi`)                                                                               | New      |
| Smart Contracts (Solidity)            | `contracts/AnalysisRegistry.sol`, `contracts/ReportSBT.sol` (Soulbound Token for analysis)                                  | New      |
| Smart Contract Frameworks             | **Foundry** (test + deploy)                                                                                                | New      |
| Smart Contract Testing                | `forge test` (unit + invariant + fuzz)                                                                                     | New      |
| Smart Contract Security               | Audit checklist + run **Slither** + **Mythril** in CI                                                                      | New      |
| Oracles                               | Chainlink Price Feed for USD conversion in analysis                                                                        | New      |
| L2 / Scaling                          | Deploy contract to **Arbitrum Sepolia** + **Base Sepolia** testnet                                                         | New      |
| Decentralized Storage                 | Store AI summary JSON on **IPFS** (via Pinata/web3.storage), CID emitted on-chain                                          | New      |
| Node-as-a-Service                     | Use **Alchemy** / **Infura** RPC (env-configurable)                                                                        | Extend   |
| dApps Frontend                        | React + Vue (optional) — currently React only                                                                              | Existing |
| Client Library                        | Already using `viem`; add `ethers` for contract write demo                                                                 | Extend   |
| Applicability (DeFi/NFT)              | Soulbound NFT report = real NFT use-case                                                                                   | New      |
| Version Control                       | Git + GitHub + Conventional Commits                                                                                        | Existing |

### 3.2 🤖 Machine Learning Roadmap — target coverage 80%

ML moves to a **separate Python service** (`/ml-service`). Required because the ML ecosystem = Python.

#### 3.2.1 Mathematical Foundations

- Notebook `01_math_foundations.ipynb`: examples of linear algebra (SVD on wallet feature matrix), calculus (gradient descent from scratch for logistic regression), probability (Bayes for naive classification).

#### 3.2.2 Programming & Libraries

- `numpy`, `pandas`, `matplotlib`, `seaborn` in EDA.
- OOP: `WalletFeatureExtractor`, `ModelRegistry`, `ChainDataLoader` classes.

#### 3.2.3 Data Collection & Cleaning

- `etl/extract.py` — fetch from Etherscan/RPC to Postgres.
- `etl/transform.py` — feature engineering: 30+ features (see §4).
- `etl/load.py` — versioned dataset → `data/processed/v{n}/`.
- Preprocessing: scaling (`StandardScaler`), encoding, imputation, **dimensionality reduction** (PCA, t-SNE for visualization).

#### 3.2.4 Supervised Learning

- **Wallet Classifier** (multi-class: `exchange`, `dex_trader`, `dex_lp`, `nft_collector`, `bot/mev`, `phishing`, `normal`).
- Algorithms: Logistic Regression, KNN, SVM, **Random Forest**, **XGBoost**, **Gradient Boosting**.
- Labels from Etherscan tags + public datasets (Forta, Chainabuse).
- Notebook `02_supervised_classification.ipynb`.

#### 3.2.5 Unsupervised Learning

- **Wallet Clustering** (KMeans, DBSCAN, Hierarchical) → wallet segmentation → displayed in UI as "wallet persona".
- **Anomaly Detection** (Isolation Forest, One-Class SVM) → flag outlier wallets.
- Dimensionality reduction: PCA + Autoencoder (PyTorch) for 2D visualization.

#### 3.2.6 Reinforcement Learning (optional, advanced)

- Toy env: gas-price bidding agent (Q-Learning) — notebook only, not production.

#### 3.2.7 Model Evaluation

- Metrics: accuracy, precision, recall, F1, ROC-AUC, log-loss, confusion matrix.
- Validation: stratified K-Fold CV, temporal train/val/test split.
- Reproducibility: fixed seeds + dataset hash.

#### 3.2.8 Deep Learning

- **LSTM** for _transaction sequence anomaly_ (input: wallet tx sequence → output: anomaly score). PyTorch.
- **GNN** (optional, GraphSAGE via PyG) for wallet-graph classification → _advanced topic_.
- Notebook `03_lstm_tx_sequence.ipynb` + `04_gnn_wallet_graph.ipynb`.

#### 3.2.9 NLP

- _Risky token name_ classification (BERT-tiny / DistilBERT) → flag scam tokens based on symbol name.
- Tokenization, embeddings, small fine-tuning.

#### 3.2.10 Explainable AI

- **SHAP** values for wallet classifier, displayed per prediction in UI.

### 3.3 📊 AI & Data Scientist Roadmap — target coverage 85%

| Chapter                   | Project Module                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mathematics               | Notebook §3.2.1                                                                                         |
| Statistics                | Notebook `05_statistics.ipynb`: hypothesis testing (is bot wallet avg gas > human?), CLT, sampling.     |
| Econometrics              | Notebook `06_timeseries.ipynb`: ARIMA + Prophet for wallet activity forecast (daily tx count).          |
| Coding                    | Python + SQL (analytics queries in Postgres). DSA leetcode log optional.                                |
| Exploratory Data Analysis | Notebook `00_eda.ipynb`: feature distributions, correlations, missing values, outliers, visualizations. |
| Classic & Advanced ML     | See §3.2.4–3.2.5.                                                                                       |
| Deep Learning             | §3.2.8                                                                                                  |
| **MLOps**                 | §3.4 (below)                                                                                           |

### 3.4 🚀 MLOps Layer (cross-cutting)

- **Containerization**: Dockerfile per service + `docker-compose.yml` (web, ml-service, postgres, minio, mlflow).
- **CI/CD**: GitHub Actions
  - Web: typecheck + lint + e2e (Playwright).
  - ML: pytest + lint + train-on-PR (smoke).
  - Contracts: `forge test` + Slither.
- **Experiment Tracking**: **MLflow** server, logging metrics & artifacts per run.
- **Model Registry**: MLflow Registry, tag `staging` / `production`.
- **Model Serving**: FastAPI endpoint `/predict`, load model from registry, return predictions + SHAP.
- **Monitoring**: Prometheus + Grafana (latency, error rate, simple drift detection).
- **Data Versioning**: **DVC** for datasets in `data/`.

---

## 4. Feature Engineering Spec (Wallet → Vector)

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

## 5. Final Folder Structure

```
chainnusa/
├── apps/
│   └── web/                          # Next.js 14 (existing src/)
│       ├── app/
│       ├── components/
│       └── lib/
│           ├── chains.ts
│           ├── etherscan.ts
│           ├── ml-client.ts          # NEW: calls ml-service
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
│   │   ├── AnalysisRegistry.sol      # stores CID of analysis result
│   │   └── ReportSBT.sol             # soulbound NFT report
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

## 6. Final Tech Stack

| Layer          | Tech                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 14, Tailwind, Recharts, wagmi, viem, RainbowKit                                        |
| Backend (web)  | Next API Routes, LangChain, Anthropic SDK, Ollama provider                                     |
| ML Service     | Python 3.11, FastAPI, scikit-learn, XGBoost, PyTorch, statsmodels, prophet, transformers, SHAP |
| Smart Contract | Solidity 0.8.x, **Foundry**, OpenZeppelin, Slither, Mythril                                    |
| Database       | PostgreSQL 16 (analytics), SQLite (dev cache)                                                  |
| Storage        | MinIO/S3 (artifacts), IPFS (Pinata)                                                            |
| MLOps          | MLflow, DVC, Docker, GitHub Actions, Prometheus, Grafana                                       |
| Testing        | Vitest (web), Pytest (ml), Forge (contracts), Playwright (e2e)                                 |

---

## 7. Implementation Roadmap (Milestones)

| #   | Milestone                                                                                     | Output                                   | Estimate |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------- | -------- |
| M1  | Restructure → pnpm monorepo (`apps/web` only first)                                           | Green build                              | 0.5 days |
| M2  | Postgres + ETL pipeline (Etherscan → wallet features)                                         | `wallet_features` table with 1k wallets  | 2 days   |
| M3  | EDA notebook (`00_eda.ipynb`)                                                                 | Insights + plots                         | 1 day    |
| M4  | ML service skeleton + `WalletFeatureExtractor` + `/predict` endpoint (dummy)                  | Service running in Docker                | 1 day    |
| M5  | Supervised classifier (RF + XGBoost) + MLflow tracking + SHAP                                 | Model artifact + API live                | 3 days   |
| M6  | Unsupervised (KMeans + Isolation Forest)                                                      | `/cluster`, `/anomaly` endpoints         | 2 days   |
| M7  | Statistics & Econometrics notebooks                                                           | 2 notebooks + report                     | 2 days   |
| M8  | LSTM tx-sequence anomaly                                                                      | Notebook + endpoint                      | 3 days   |
| M9  | NLP token-name classifier                                                                     | Notebook + endpoint                      | 2 days   |
| M10 | Smart contracts `AnalysisRegistry` + `ReportSBT` (Foundry, deploy to Sepolia/Arbitrum Sepolia) | Verified contracts + tests               | 3 days   |
| M11 | Wallet sign-in (SIWE) + Chainlink price feed integration                                      | Frontend + backend wired                 | 1.5 days |
| M12 | IPFS pin + CID emit on-chain from analysis results                                             | E2E flow                                 | 1 day    |
| M13 | CI/CD (3 workflows) + Slither in pipeline                                                     | All green                                | 1 day    |
| M14 | Monitoring (Prometheus + Grafana) + drift check                                                | Dashboard live                           | 1.5 days |
| M15 | Docs + threat model + architecture diagram                                                     | Complete `/docs`                         | 1 day    |

**Realistic total: ~25 working days** (1 person full-time).

---

## 8. Quality Gates

- **Web**: strict typecheck, clean lint, Playwright e2e (3 happy paths).
- **ML**: pytest coverage ≥80% on `features/` and `models/`, model F1 ≥ 0.75 on test set, drift threshold defined.
- **Contracts**: `forge test` 100% pass, Slither no high-severity, ≥90% line coverage, gas snapshot tracked.
- **Security**: no secrets in repo (gitleaks in CI), dependency audit (npm audit + pip-audit) in CI.

---

## 9. Final Mapping to 3 Roadmaps (target after implementation)

| Roadmap             | Coverage Target | Evidence                                                                                  |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| Blockchain          | **90%**         | Foundry contracts + tests + Slither + Chainlink + IPFS + L2 deploy + dApp                 |
| Machine Learning    | **80%**         | Math notebook, sklearn, XGBoost, PyTorch LSTM, SHAP, NLP, eval metrics                    |
| AI & Data Scientist | **85%**         | EDA, statistics, econometrics, MLOps full chain (MLflow + Docker + CI/CD + monitoring)    |

The remaining 10–20% (e.g., deep RL, GAN, Substrate non-EVM, advanced econometrics CUPED) are intentionally **out-of-scope** because they are not relevant to the wallet analysis domain — documented in `docs/out-of-scope.md` as academic justification.
