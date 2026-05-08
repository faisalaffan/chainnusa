import numpy as np
import pandas as pd
from typing import TypedDict, NotRequired
from dataclasses import dataclass


class WalletFeatures(TypedDict):
    address: str
    chain_id: int
    tx_count: int
    active_days: int
    avg_tx_per_day: float
    days_since_first_tx: float
    days_since_last_tx: float
    dormant_ratio: float
    native_in: float
    native_out: float
    net_flow: float
    gas_spent: float
    avg_tx_value: float
    std_tx_value: float
    max_tx_value: float
    unique_counterparties: int
    top1_share: float
    contract_interaction_ratio: float
    eoa_interaction_ratio: float
    unique_tokens: int
    erc20_tx_ratio: float
    stablecoin_ratio: float
    nft_tx_count: int
    dex_swap_ratio: float
    failed_tx_ratio: float
    self_tx_ratio: float
    weekend_activity_ratio: float
    night_activity_ratio: float
    interactions_with_known_mixer: int
    interactions_with_phishing_list: int
    new_token_creation_count: int
    tx_value_series: NotRequired[list[float]]
    gas_series: NotRequired[list[float]]
    time_delta_series: NotRequired[list[float]]


@dataclass
class NormalTxData:
    hash: str
    block_number: str
    time_stamp: str
    from_addr: str
    to_addr: str
    value: str
    gas: str
    gas_price: str
    gas_used: str
    is_error: str
    input: str
    contract_address: str
    method_id: str = ""
    function_name: str = ""


@dataclass
class TokenTxData:
    hash: str
    block_number: str
    time_stamp: str
    from_addr: str
    to_addr: str
    value: str
    token_name: str
    token_symbol: str
    token_decimal: str
    contract_address: str


STABLECOINS: dict[str, str] = {
    "0xdac17f958d2ee523a2206206994597c13d831ec7".lower(): "USDT",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48".lower(): "USDC",
    "0x6b175474e89094c44da98b954eedeac495271d0f".lower(): "DAI",
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d".lower(): "USDC_BSC",
    "0x55d398326f99059ff775485246999027b3197955".lower(): "USDT_BSC",
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f".lower(): "USDT_POLYGON",
    "0x2791bca1f2de4661ed88a30c99a7a9449aa84174".lower(): "USDC_POLYGON",
}

KNOWN_MIXERS: set[str] = {
    a.lower()
    for a in [
        "0x1bed3b46b8bb5d8dfbd5b26428a27ebc72c51a53",
    ]
}

PHISHING_LIST: set[str] = set()


def load_phishing_list(addresses: set[str]) -> None:
    """Load external phishing address list at startup."""
    global PHISHING_LIST
    PHISHING_LIST = {a.lower() for a in addresses}


class WalletFeatureExtractor:
    """Extract 30+ features from normalized tx data."""

    def __init__(self, seed: int = 42):
        self.rng = np.random.default_rng(seed)

    def extract(
        self, address: str, chain_id: int,
        normal_txs: list[NormalTxData], token_txs: list[TokenTxData],
        sequence_len: int = 64,
    ) -> WalletFeatures:
        me = address.lower()
        txs_df = self._normal_txs_to_df(normal_txs, me)
        token_df = self._token_txs_to_df(token_txs, me)

        if txs_df.empty:
            return self._empty_features(address, chain_id)

        # activity
        tx_count = len(txs_df)
        dates = pd.to_datetime(txs_df["time_stamp"], unit="s", utc=True)
        active_days = int(dates.dt.date.nunique())
        avg_tx_per_day = tx_count / max(active_days, 1)
        now_ts = pd.Timestamp.now(tz="UTC")
        first_ts = dates.min()
        last_ts = dates.max()
        days_since_first = (now_ts - first_ts).total_seconds() / 86400
        days_since_last = (now_ts - last_ts).total_seconds() / 86400
        total_days = (last_ts - first_ts).total_seconds() / 86400 or 1
        dormant_ratio = (total_days - active_days) / total_days

        # volume
        native_in = float(txs_df["value_in"].sum())
        native_out = float(txs_df["value_out"].sum())
        gas_spent = float(txs_df["gas_cost"].sum())
        net_flow = native_in - native_out
        tx_values = txs_df["tx_value"].values
        avg_tx_value = float(np.mean(tx_values)) if len(tx_values) > 0 else 0.0
        std_tx_value = float(np.std(tx_values)) if len(tx_values) > 0 else 0.0
        max_tx_value = float(np.max(tx_values)) if len(tx_values) > 0 else 0.0

        # counterparty
        cp_counts = txs_df["counterparty"].value_counts()
        unique_cp = len(cp_counts)
        top1_share = float(cp_counts.iloc[0] / tx_count) if unique_cp > 0 else 0.0
        contract_ratio = float(txs_df["is_contract"].mean()) if tx_count > 0 else 0.0
        eoa_ratio = 1.0 - contract_ratio

        # token
        if not token_df.empty:
            unique_tokens = int(token_df["contract_address"].nunique())
            erc20_ratio = float(len(token_df) / (tx_count + len(token_df)))
            stablecoin_addrs = set(STABLECOINS.keys())
            stable_hits = int(token_df["contract_address"].isin(stablecoin_addrs).sum())
            total_token = len(token_df)
            stablecoin_ratio = float(stable_hits / total_token) if total_token > 0 else 0.0
            nft_tx_count = 0
        else:
            unique_tokens = 0
            erc20_ratio = 0.0
            stablecoin_ratio = 0.0
            nft_tx_count = 0

        # behavior
        dex_ratio = float(txs_df["is_dex"].mean()) if tx_count > 0 else 0.0
        failed_ratio = float(txs_df["is_error"].mean()) if tx_count > 0 else 0.0
        self_ratio = float(txs_df["is_self"].mean()) if tx_count > 0 else 0.0
        weekend_ratio = float(
            (dates.dt.dayofweek >= 5).mean()
        ) if len(dates) > 0 else 0.0
        night_ratio = float(
            ((dates.dt.hour >= 0) & (dates.dt.hour < 6)).mean()
        ) if len(dates) > 0 else 0.0

        # risk
        mixer_hits = int(txs_df["counterparty"].isin(KNOWN_MIXERS).sum())
        phishing_hits = int(txs_df["counterparty"].isin(PHISHING_LIST).sum())

        # sequence
        sorted_txs = txs_df.sort_values("time_stamp")
        value_series = sorted_txs["tx_value"].values[-sequence_len:].tolist()
        gas_series_list = sorted_txs["gas_cost"].values[-sequence_len:].tolist()
        time_deltas = (
            sorted_txs["time_stamp"].diff().fillna(0).values[-sequence_len:].tolist()
        )

        return WalletFeatures(
            address=address, chain_id=chain_id,
            tx_count=tx_count, active_days=active_days,
            avg_tx_per_day=round(avg_tx_per_day, 4),
            days_since_first_tx=round(days_since_first, 2),
            days_since_last_tx=round(days_since_last, 2),
            dormant_ratio=round(dormant_ratio, 4),
            native_in=round(native_in, 6), native_out=round(native_out, 6),
            net_flow=round(net_flow, 6), gas_spent=round(gas_spent, 6),
            avg_tx_value=round(avg_tx_value, 6),
            std_tx_value=round(std_tx_value, 6),
            max_tx_value=round(max_tx_value, 6),
            unique_counterparties=unique_cp,
            top1_share=round(top1_share, 4),
            contract_interaction_ratio=round(contract_ratio, 4),
            eoa_interaction_ratio=round(eoa_ratio, 4),
            unique_tokens=unique_tokens,
            erc20_tx_ratio=round(erc20_ratio, 4),
            stablecoin_ratio=round(stablecoin_ratio, 4),
            nft_tx_count=nft_tx_count,
            dex_swap_ratio=round(dex_ratio, 4),
            failed_tx_ratio=round(failed_ratio, 4),
            self_tx_ratio=round(self_ratio, 4),
            weekend_activity_ratio=round(weekend_ratio, 4),
            night_activity_ratio=round(night_ratio, 4),
            interactions_with_known_mixer=mixer_hits,
            interactions_with_phishing_list=phishing_hits,
            new_token_creation_count=0,
            tx_value_series=value_series,
            gas_series=gas_series_list,
            time_delta_series=[float(v) for v in time_deltas],
        )

    @staticmethod
    def features_dataframe(features_list: list[WalletFeatures]) -> pd.DataFrame:
        df = pd.DataFrame(features_list)
        seq_cols = ["tx_value_series", "gas_series", "time_delta_series"]
        return df.drop(columns=[c for c in seq_cols if c in df.columns], errors="ignore")

    def _normal_txs_to_df(self, txs: list[NormalTxData], me: str) -> pd.DataFrame:
        if not txs:
            return pd.DataFrame()
        records = []
        for tx in txs:
            from_a = (tx.from_addr or "").lower()
            to_a = (tx.to_addr or "").lower()
            value = self._safe_int(tx.value) / 1e18
            gas_cost = (
                self._safe_int(tx.gas_used) * self._safe_int(tx.gas_price) / 1e18
            )
            counterparty = to_a if from_a == me else from_a
            is_contract = bool(tx.input and tx.input != "0x")
            dex_methods = {
                "0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x5c11d795",
                "0x414bf389", "0xc04b8d59", "0xdb3e2198", "0xf28c0498",
                "0xac9650d8",
            }
            records.append({
                "time_stamp": int(tx.time_stamp or 0),
                "from_addr": from_a, "to_addr": to_a,
                "value_in": value if to_a == me else 0.0,
                "value_out": value if from_a == me else 0.0,
                "gas_cost": gas_cost if from_a == me else 0.0,
                "tx_value": value,
                "counterparty": counterparty,
                "is_contract": is_contract,
                "is_dex": tx.method_id.lower() in dex_methods,
                "is_error": tx.is_error == "1",
                "is_self": from_a == to_a == me,
            })
        return pd.DataFrame(records)

    def _token_txs_to_df(self, txs: list[TokenTxData], me: str) -> pd.DataFrame:
        if not txs:
            return pd.DataFrame()
        records = []
        for tx in txs:
            records.append({
                "time_stamp": int(tx.time_stamp or 0),
                "from_addr": (tx.from_addr or "").lower(),
                "to_addr": (tx.to_addr or "").lower(),
                "value": self._safe_int(tx.value) / (10 ** int(tx.token_decimal or 18)),
                "token_symbol": tx.token_symbol,
                "contract_address": (tx.contract_address or "").lower(),
            })
        return pd.DataFrame(records)

    @staticmethod
    def _safe_int(s: str | None) -> int:
        if not s:
            return 0
        try:
            return int(s)
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def _empty_features(address: str, chain_id: int) -> WalletFeatures:
        return WalletFeatures(
            address=address, chain_id=chain_id,
            tx_count=0, active_days=0, avg_tx_per_day=0.0,
            days_since_first_tx=0.0, days_since_last_tx=0.0,
            dormant_ratio=0.0, native_in=0.0, native_out=0.0,
            net_flow=0.0, gas_spent=0.0, avg_tx_value=0.0,
            std_tx_value=0.0, max_tx_value=0.0,
            unique_counterparties=0, top1_share=0.0,
            contract_interaction_ratio=0.0, eoa_interaction_ratio=0.0,
            unique_tokens=0, erc20_tx_ratio=0.0, stablecoin_ratio=0.0,
            nft_tx_count=0, dex_swap_ratio=0.0, failed_tx_ratio=0.0,
            self_tx_ratio=0.0, weekend_activity_ratio=0.0,
            night_activity_ratio=0.0,
            interactions_with_known_mixer=0,
            interactions_with_phishing_list=0,
            new_token_creation_count=0,
        )
