# Out of Scope (Intentional)

List of topics present in reference roadmaps but **not implemented** in ChainNusa, with explicit reasons. Goal: honest portfolio, not claiming to cover everything.

## Blockchain Roadmap

| Topic | Reason skipped |
|---|---|
| **Substrate / non-EVM** | Project spec = EVM wallet analysis. Polkadot/Solana have fundamentally different architecture, need a separate project. |
| **zkSNARK / Halo2 / Circom** | No privacy-preserving use case in public analysis domain. Suitable for private voting, identity, etc. |
| **Bitcoin Core (UTXO model)** | Account model totally different from EVM (UTXO vs account-based). |
| **MEV bot live deployment** | Ethically questionable; analyzing MEV = OK, operating one = different. |
| **Token launch / ICO** | Not relevant to an analyzer. |

## Machine Learning Roadmap

| Topic | Reason skipped |
|---|---|
| **GAN** | No generative use case in this domain. Wallet feature space is tabular + sequence. |
| **Reinforcement Learning (production)** | Toy notebook OK; real RL for gas bidding = expensive & risky mainnet experiment. |
| **GraphSAGE / GNN production** | Experiment notebook `04_gnn_wallet_graph.ipynb` may be added (deferred), but production graph DB (Neo4j) = separate scope. |
| **AutoML platform end-to-end** | MLflow + manual sweeps sufficient to demonstrate skill. |
| **Federated Learning** | No multi-tenant dataset. |

## AI & Data Scientist Roadmap

| Topic | Reason skipped |
|---|---|
| **Advanced econometrics (CUPED, RDD, IV)** | Analyzer domain has no causal experiment. Keep observational + ARIMA. |
| **A/B testing platform** | No user-facing product with variant testing. |
| **Real-time streaming (Kafka + Flink)** | Batch pipeline is sufficient. Streaming = project pivot. |
| **NLP Indonesian sentiment** | Not relevant; on-chain analysis does not consume user-generated text. |

## Engineering / Infra

| Topic | Reason skipped |
|---|---|
| **Kubernetes production deploy** | docker-compose sufficient for demo. K8s = complexity without concrete portfolio benefit. |
| **Multi-region failover** | Single-region sufficient. |
| **Blue-green deploy** | Single instance OK. |
| **Service mesh (Istio)** | Overkill. |

## Notes

This list **can be moved to "in scope"** at any time if concrete justification arises. Document purpose: be honest about boundaries, avoid an incredible "I can do everything" claim.
