# Out of Scope (Intentional)

Daftar topik yang ada di roadmap referensi tapi **tidak diimplementasikan** di ChainNusa, dengan alasan eksplisit. Tujuan: portfolio jujur, bukan klaim cover semua.

## Blockchain Roadmap

| Topik | Alasan skip |
|---|---|
| **Substrate / non-EVM** | Spec proyek = analisis wallet EVM. Polkadot/Solana arsitektur berbeda fundamental, butuh proyek terpisah. |
| **zkSNARK / Halo2 / Circom** | Tidak ada use case privacy preserving di domain analisis publik. Cocok untuk private voting, identity, dll. |
| **Bitcoin Core (UTXO model)** | Model akun beda total dengan EVM (UTXO vs account-based). |
| **MEV bot live deployment** | Etis dipertanyakan; analisis MEV = OK, mengoperasikan = beda. |
| **Token launch / ICO** | Tidak relevan dengan analyzer. |

## Machine Learning Roadmap

| Topik | Alasan skip |
|---|---|
| **GAN** | Tidak ada use case generative di domain ini. Wallet feature space adalah tabular + sequence. |
| **Reinforcement Learning (production)** | Toy notebook OK; real RL untuk gas bidding = mainnet experiment yang mahal & beresiko. |
| **GraphSAGE / GNN production** | Notebook eksperimen `04_gnn_wallet_graph.ipynb` boleh ada (deferred), tapi production graph DB (Neo4j) = scope tersendiri. |
| **AutoML platform end-to-end** | MLflow + manual sweep cukup untuk demonstrate skill. |
| **Federated Learning** | Tidak ada multi-tenant dataset. |

## AI & Data Scientist Roadmap

| Topik | Alasan skip |
|---|---|
| **Advanced econometrics (CUPED, RDD, IV)** | Domain analyzer tidak punya causal experiment. Keep observational + ARIMA. |
| **A/B testing platform** | Tidak ada user-facing produk dengan variant testing. |
| **Real-time streaming (Kafka + Flink)** | Pipeline batch sudah cukup. Streaming = pivot proyek. |
| **NLP Indonesian sentiment** | Tidak relevan; analisis on-chain tidak konsumsi teks user-generated. |

## Engineering / Infra

| Topik | Alasan skip |
|---|---|
| **Kubernetes production deploy** | docker-compose cukup untuk demo. K8s = kompleksitas tanpa nilai tambah konkret untuk portfolio. |
| **Multi-region failover** | Single-region cukup. |
| **Blue-green deploy** | Single instance OK. |
| **Service mesh (Istio)** | Overkill. |

## Catatan

Daftar ini **bisa dipindahkan ke "in scope"** kapan saja kalau ada justifikasi konkret. Tujuan dokumen: jujur tentang batasan, hindari "saya bisa semuanya" yang tidak credible.
