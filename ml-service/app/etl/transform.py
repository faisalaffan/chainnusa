"""Transform raw wallet data into feature vectors."""

import pandas as pd
from app.features.extractor import (
    WalletFeatureExtractor, NormalTxData, TokenTxData, WalletFeatures,
)
import logging

log = logging.getLogger(__name__)


class FeatureTransformer:
    def __init__(self, seed: int = 42):
        self.extractor = WalletFeatureExtractor(seed=seed)

    def transform(self, raw_data_list: list[dict]) -> list[WalletFeatures]:
        features = []
        for raw in raw_data_list:
            normal_txs = self._parse_normal_txs(raw.get("normal_txs", []))
            token_txs = self._parse_token_txs(raw.get("token_txs", []))
            feat = self.extractor.extract(
                address=raw["address"],
                chain_id=raw.get("chain_id", 1),
                normal_txs=normal_txs,
                token_txs=token_txs,
            )
            features.append(feat)
        return features

    def transform_to_dataframe(self, raw_data_list: list[dict]) -> pd.DataFrame:
        features = self.transform(raw_data_list)
        return self.extractor.features_dataframe(features)

    @staticmethod
    def _parse_normal_txs(txs: list[dict]) -> list[NormalTxData]:
        result = []
        for t in txs:
            result.append(NormalTxData(
                hash=t.get("hash", ""),
                block_number=t.get("blockNumber", "0"),
                time_stamp=t.get("timeStamp", "0"),
                from_addr=t.get("from", ""),
                to_addr=t.get("to", ""),
                value=t.get("value", "0"),
                gas=t.get("gas", "0"),
                gas_price=t.get("gasPrice", "0"),
                gas_used=t.get("gasUsed", "0"),
                is_error=t.get("isError", "0"),
                input=t.get("input", "0x"),
                contract_address=t.get("contractAddress", ""),
                method_id=t.get("methodId", ""),
                function_name=t.get("functionName", ""),
            ))
        return result

    @staticmethod
    def _parse_token_txs(txs: list[dict]) -> list[TokenTxData]:
        result = []
        for t in txs:
            result.append(TokenTxData(
                hash=t.get("hash", ""),
                block_number=t.get("blockNumber", "0"),
                time_stamp=t.get("timeStamp", "0"),
                from_addr=t.get("from", ""),
                to_addr=t.get("to", ""),
                value=t.get("value", "0"),
                token_name=t.get("tokenName", ""),
                token_symbol=t.get("tokenSymbol", ""),
                token_decimal=t.get("tokenDecimal", "18"),
                contract_address=t.get("contractAddress", ""),
            ))
        return result
