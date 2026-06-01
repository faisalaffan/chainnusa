# Di Luar Cakupan (Disengaja)

Daftar topik yang ada di roadmap referensi tetapi **tidak diimplementasikan** di ChainNusa, dengan alasan eksplisit. Tujuan: portofolio yang jujur, tidak mengklaim mencakup semuanya.

## Blockchain Roadmap

| Topik | Alasan dilewati |
|---|---|
| **Substrate / non-EVM** | Spesifikasi proyek = analisis wallet EVM. Polkadot/Solana memiliki arsitektur yang fundamentally berbeda, memerlukan proyek terpisah. |
| **zkSNARK / Halo2 / Circom** | Tidak ada use case privasi dalam domain analisis publik. Cocok untuk voting privat, identitas, dll. |
| **Bitcoin Core (model UTXO)** | Model akun sangat berbeda dari EVM (UTXO vs account-based). |
| **Deploy live MEV bot** | Secara etis dipertanyakan; menganalisis MEV = OK, menjalankannya = berbeda. |
| **Token launch / ICO** | Tidak relevan untuk analyzer. |

## Machine Learning Roadmap

| Topik | Alasan dilewati |
|---|---|
| **GAN** | Tidak ada use case generatif di domain ini. Ruang fitur wallet bersifat tabular + sequence. |
| **Reinforcement Learning (produksi)** | Notebook mainan OK; RL nyata untuk gas bidding = eksperimen mainnet yang mahal & berisiko. |
| **GraphSAGE / GNN produksi** | Notebook eksperimen `04_gnn_wallet_graph.ipynb` mungkin ditambahkan (ditunda), tetapi graph DB produksi (Neo4j) = cakupan terpisah. |
| **Platform AutoML end-to-end** | MLflow + manual sweep sudah cukup untuk menunjukkan kemampuan. |
| **Federated Learning** | Tidak ada dataset multi-tenant. |

## AI & Data Scientist Roadmap

| Topik | Alasan dilewati |
|---|---|
| **Ekonometrik lanjutan (CUPED, RDD, IV)** | Domain analyzer tidak memiliki eksperimen kausal. Tetap menggunakan observational + ARIMA. |
| **Platform A/B testing** | Tidak ada produk berhadapan pengguna dengan pengujian varian. |
| **Streaming real-time (Kafka + Flink)** | Batch pipeline sudah cukup. Streaming = pivot proyek. |
| **NLP sentimen Bahasa Indonesia** | Tidak relevan; analisis on-chain tidak mengonsumsi teks buatan pengguna. |

## Engineering / Infra

| Topik | Alasan dilewati |
|---|---|
| **Deploy produksi Kubernetes** | docker-compose cukup untuk demo. K8s = kompleksitas tanpa manfaat portofolio konkret. |
| **Failover multi-region** | Single-region sudah cukup. |
| **Deploy blue-green** | Instance tunggal OK. |
| **Service mesh (Istio)** | Berlebihan. |

## Catatan

Daftar ini **dapat dipindahkan ke "dalam cakupan"** kapan saja jika ada justifikasi konkret. Tujuan dokumen: jujur tentang batasan, menghindari klaim "saya bisa melakukan segalanya" yang tidak masuk akal.
