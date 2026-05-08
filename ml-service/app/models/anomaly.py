"""Anomaly detection: Isolation Forest + One-Class SVM ensemble."""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
import joblib
import logging

log = logging.getLogger(__name__)


class AnomalyDetector:
    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.iforest = IsolationForest(
            contamination=contamination, random_state=random_state, n_jobs=-1,
        )
        self.ocsvm = OneClassSVM(nu=contamination, kernel="rbf", gamma="scale")
        self.feature_names: list[str] = []
        self._threshold: float = 0.0

    def train(self, X: pd.DataFrame) -> dict:
        self.feature_names = list(X.columns)
        X_scaled = self.scaler.fit_transform(X)

        self.iforest.fit(X_scaled)
        self.ocsvm.fit(X_scaled)

        if_scores = -self.iforest.score_samples(X_scaled)
        ocsvm_scores = -self.ocsvm.score_samples(X_scaled)

        if_rank = pd.Series(if_scores).rank(pct=True)
        ocsvm_rank = pd.Series(ocsvm_scores).rank(pct=True)
        combined = (if_rank + ocsvm_rank) / 2

        self._threshold = float(np.percentile(combined, 95))

        return {
            "n_features": len(self.feature_names),
            "contamination": self.contamination,
            "threshold_95": self._threshold,
            "if_score_range": [float(if_scores.min()), float(if_scores.max())],
            "ocsvm_score_range": [float(ocsvm_scores.min()), float(ocsvm_scores.max())],
        }

    def predict(self, X: pd.DataFrame) -> tuple[list[bool], np.ndarray]:
        if self.iforest is None:
            raise RuntimeError("Model not trained or loaded")
        X_scaled = self.scaler.transform(X[self.feature_names])
        if_scores = -self.iforest.score_samples(X_scaled)
        ocsvm_scores = -self.ocsvm.score_samples(X_scaled)
        if_rank = pd.Series(if_scores).rank(pct=True)
        ocsvm_rank = pd.Series(ocsvm_scores).rank(pct=True)
        combined = ((if_rank + ocsvm_rank) / 2).to_numpy()
        is_anomaly = combined >= self._threshold
        return list(is_anomaly), combined

    def save(self, path: str) -> None:
        joblib.dump({
            "iforest": self.iforest, "ocsvm": self.ocsvm,
            "scaler": self.scaler, "feature_names": self.feature_names,
            "contamination": self.contamination, "threshold": self._threshold,
        }, path)

    def load(self, path: str) -> None:
        data = joblib.load(path)
        self.iforest = data["iforest"]
        self.ocsvm = data["ocsvm"]
        self.scaler = data["scaler"]
        self.feature_names = data["feature_names"]
        self.contamination = data["contamination"]
        self._threshold = data["threshold"]
