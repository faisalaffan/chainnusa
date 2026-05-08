"""Load features into PostgreSQL and versioned datasets."""

import pandas as pd
import json
import hashlib
from pathlib import Path
from sqlalchemy import create_engine, text
import logging

log = logging.getLogger(__name__)


class DataLoader:
    def __init__(self, database_url: str, data_dir: str = "data"):
        self.database_url = database_url
        self.engine = create_engine(database_url, pool_pre_ping=True)
        self.data_dir = Path(data_dir)

    def ensure_tables(self) -> None:
        with self.engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS wallet_features (
                    address TEXT NOT NULL,
                    chain_id INTEGER NOT NULL,
                    tx_count INTEGER,
                    active_days INTEGER,
                    avg_tx_per_day DOUBLE PRECISION,
                    days_since_first_tx DOUBLE PRECISION,
                    days_since_last_tx DOUBLE PRECISION,
                    dormant_ratio DOUBLE PRECISION,
                    native_in DOUBLE PRECISION,
                    native_out DOUBLE PRECISION,
                    net_flow DOUBLE PRECISION,
                    gas_spent DOUBLE PRECISION,
                    avg_tx_value DOUBLE PRECISION,
                    std_tx_value DOUBLE PRECISION,
                    max_tx_value DOUBLE PRECISION,
                    unique_counterparties INTEGER,
                    top1_share DOUBLE PRECISION,
                    contract_interaction_ratio DOUBLE PRECISION,
                    eoa_interaction_ratio DOUBLE PRECISION,
                    unique_tokens INTEGER,
                    erc20_tx_ratio DOUBLE PRECISION,
                    stablecoin_ratio DOUBLE PRECISION,
                    nft_tx_count INTEGER,
                    dex_swap_ratio DOUBLE PRECISION,
                    failed_tx_ratio DOUBLE PRECISION,
                    self_tx_ratio DOUBLE PRECISION,
                    weekend_activity_ratio DOUBLE PRECISION,
                    night_activity_ratio DOUBLE PRECISION,
                    interactions_with_known_mixer INTEGER,
                    interactions_with_phishing_list INTEGER,
                    new_token_creation_count INTEGER,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (address, chain_id)
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS analysis_labels (
                    address TEXT NOT NULL,
                    chain_id INTEGER NOT NULL,
                    label TEXT NOT NULL,
                    source TEXT NOT NULL,
                    confidence DOUBLE PRECISION DEFAULT 1.0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (address, chain_id, label)
                )
            """))
            conn.commit()

    def load_features(self, df: pd.DataFrame, version: str = "") -> None:
        seq_cols = ["tx_value_series", "gas_series", "time_delta_series"]
        data = df.drop(columns=[c for c in seq_cols if c in df.columns], errors="ignore")
        with self.engine.connect() as conn:
            data.to_sql("wallet_features", conn, if_exists="append", index=False)
            conn.commit()
        log.info(f"Loaded {len(data)} rows to wallet_features")

    def save_versioned_dataset(self, df: pd.DataFrame, version: str | None = None) -> str:
        if version is None:
            version = hashlib.sha256(
                json.dumps(sorted(df.columns.tolist())).encode()
            ).hexdigest()[:12]
        out_dir = self.data_dir / "processed" / f"v{version}"
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / "wallet_features.parquet"
        df.to_parquet(path, index=False)
        log.info(f"Saved versioned dataset to {path}")
        return version

    def load_labels(self, labels_df: pd.DataFrame) -> None:
        with self.engine.connect() as conn:
            labels_df.to_sql("analysis_labels", conn, if_exists="append", index=False)
            conn.commit()
        log.info(f"Loaded {len(labels_df)} labels")
