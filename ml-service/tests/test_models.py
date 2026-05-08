"""Tests for ML models."""

import pytest
import numpy as np
import pandas as pd
from sklearn.datasets import make_classification

from app.models.wallet_clf import WalletClassifier
from app.models.anomaly import AnomalyDetector


@pytest.fixture
def sample_features() -> pd.DataFrame:
    X, y = make_classification(
        n_samples=100, n_features=30, n_informative=15,
        n_classes=5, random_state=42,
    )
    cols = [f"feature_{i}" for i in range(30)]
    return pd.DataFrame(X, columns=cols), pd.Series(y).astype(str)


class TestWalletClassifier:
    def test_train_and_predict(self, sample_features):
        X, y = sample_features
        y = y.map({
            "0": "exchange", "1": "dex_trader", "2": "dex_lp",
            "3": "nft_collector", "4": "normal",
        })
        clf = WalletClassifier(model_type="rf")
        metrics = clf.train(X, y)
        assert "f1_macro" in metrics
        assert 0 < metrics["f1_macro"] <= 1.0

    def test_predict_before_train_raises(self, sample_features):
        X, _ = sample_features
        clf = WalletClassifier()
        with pytest.raises(RuntimeError):
            clf.predict(X)

    def test_save_and_load(self, sample_features, tmp_path):
        X, y = sample_features
        y = y.map({
            "0": "exchange", "1": "dex_trader", "2": "dex_lp",
            "3": "nft_collector", "4": "normal",
        })
        clf = WalletClassifier(model_type="rf")
        clf.train(X, y)
        path = str(tmp_path / "clf.pkl")
        clf.save(path)

        clf2 = WalletClassifier()
        clf2.load(path)
        preds1, _ = clf.predict(X)
        preds2, _ = clf2.predict(X)
        assert preds1 == preds2


class TestAnomalyDetector:
    def test_train_and_predict(self, sample_features):
        X, _ = sample_features
        det = AnomalyDetector()
        metrics = det.train(X)
        assert "threshold_95" in metrics
        is_anom, scores = det.predict(X)
        assert len(is_anom) == len(X)
        anom_count = sum(is_anom)
        assert 0 < anom_count < len(X)

    def test_save_and_load(self, sample_features, tmp_path):
        X, _ = sample_features
        det = AnomalyDetector()
        det.train(X)
        path = str(tmp_path / "anomaly.pkl")
        det.save(path)

        det2 = AnomalyDetector()
        det2.load(path)
        _, s1 = det.predict(X)
        _, s2 = det2.predict(X)
        np.testing.assert_array_almost_equal(s1, s2)
