"""Tests for WalletFeatureExtractor."""

import pytest
from app.features.extractor import WalletFeatureExtractor, NormalTxData, TokenTxData


def make_normal_tx(**kwargs) -> NormalTxData:
    defaults = {
        "hash": "0xabc", "block_number": "100", "time_stamp": "1700000000",
        "from_addr": "0xme", "to_addr": "0xother", "value": "1000000000000000000",
        "gas": "21000", "gas_price": "20000000000", "gas_used": "21000",
        "is_error": "0", "input": "0x", "contract_address": "",
        "method_id": "", "function_name": "",
    }
    defaults.update(kwargs)
    return NormalTxData(**defaults)


def make_token_tx(**kwargs) -> TokenTxData:
    defaults = {
        "hash": "0xtok", "block_number": "100", "time_stamp": "1700000000",
        "from_addr": "0xother", "to_addr": "0xme", "value": "500000000",
        "token_name": "USDC", "token_symbol": "USDC",
        "token_decimal": "6", "contract_address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    }
    defaults.update(kwargs)
    return TokenTxData(**defaults)


class TestWalletFeatureExtractor:
    def test_empty_txs(self):
        ext = WalletFeatureExtractor()
        feat = ext.extract("0xme", 1, [], [])
        assert feat["tx_count"] == 0
        assert feat["active_days"] == 0
        assert feat["native_in"] == 0.0

    def test_single_incoming_tx(self):
        ext = WalletFeatureExtractor()
        txs = [make_normal_tx(from_addr="0xother", to_addr="0xme", value="2000000000000000000")]
        feat = ext.extract("0xme", 1, txs, [])
        assert feat["tx_count"] == 1
        assert feat["native_in"] == 2.0
        assert feat["native_out"] == 0.0

    def test_single_outgoing_tx(self):
        ext = WalletFeatureExtractor()
        txs = [make_normal_tx(from_addr="0xme", to_addr="0xother", value="1000000000000000000")]
        feat = ext.extract("0xme", 1, txs, [])
        assert feat["tx_count"] == 1
        assert feat["native_out"] == 1.0
        assert feat["gas_spent"] > 0

    def test_dex_swap_detection(self):
        ext = WalletFeatureExtractor()
        txs = [
            make_normal_tx(
                from_addr="0xme", to_addr="0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",
                value="0", input="0x38ed1739",
                method_id="0x38ed1739",
            )
        ]
        feat = ext.extract("0xme", 1, txs, [])
        assert feat["dex_swap_ratio"] == 1.0

    def test_failed_tx(self):
        ext = WalletFeatureExtractor()
        txs = [make_normal_tx(is_error="1")]
        feat = ext.extract("0xme", 1, txs, [])
        assert feat["failed_tx_ratio"] == 1.0

    def test_stablecoin_detection(self):
        ext = WalletFeatureExtractor()
        tt = [make_token_tx()]
        feat = ext.extract("0xme", 1, [], tt)
        assert feat["stablecoin_ratio"] == 1.0
        assert feat["unique_tokens"] == 1

    def test_features_dataframe(self):
        ext = WalletFeatureExtractor()
        f1 = ext.extract("0xme", 1, [], [])
        f2 = ext.extract("0xother", 56, [], [])
        df = ext.features_dataframe([f1, f2])
        assert len(df) == 2
        assert "tx_value_series" not in df.columns
        assert "address" in df.columns

    def test_sequence_output_present_with_txs(self):
        ext = WalletFeatureExtractor()
        txs = [make_normal_tx() for _ in range(70)]
        feat = ext.extract("0xme", 1, txs, [])
        assert "tx_value_series" in feat
        assert len(feat["tx_value_series"]) <= 64
