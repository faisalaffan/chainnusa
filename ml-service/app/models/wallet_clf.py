"""Wallet classifier: multi-class supervised (Random Forest + XGBoost)."""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import classification_report, f1_score
from xgboost import XGBClassifier
import joblib
import logging

log = logging.getLogger(__name__)

WALLET_CLASSES = [
    "exchange", "dex_trader", "dex_lp", "nft_collector",
    "bot", "phishing", "normal",
]


class WalletClassifier:
    def __init__(self, model_type: str = "xgb", random_state: int = 42):
        self.model_type = model_type
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.model = None
        self.feature_names: list[str] = []

    def _build_model(self):
        if self.model_type == "xgb":
            return XGBClassifier(
                n_estimators=200, max_depth=6, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                objective="multi:softprob", random_state=self.random_state,
                n_jobs=-1,
            )
        return RandomForestClassifier(
            n_estimators=200, max_depth=12, min_samples_leaf=5,
            class_weight="balanced_subsample", random_state=self.random_state,
            n_jobs=-1,
        )

    def train(self, X: pd.DataFrame, y: pd.Series) -> dict:
        """Train classifier with stratified CV evaluation."""
        self.feature_names = list(X.columns)
        X_scaled = self.scaler.fit_transform(X)
        y_encoded = self.label_encoder.fit_transform(y)
        self.model = self._build_model()
        self.model.fit(X_scaled, y_encoded)

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.random_state)
        cv_scores = cross_val_score(self.model, X_scaled, y_encoded, cv=cv, scoring="f1_macro")
        y_pred = self.model.predict(X_scaled)
        report = classification_report(y_encoded, y_pred, target_names=self.label_encoder.classes_, output_dict=True)

        return {
            "f1_macro": float(f1_score(y_encoded, y_pred, average="macro")),
            "f1_weighted": float(f1_score(y_encoded, y_pred, average="weighted")),
            "cv_f1_macro_mean": float(cv_scores.mean()),
            "cv_f1_macro_std": float(cv_scores.std()),
            "classification_report": report,
        }

    def predict(self, X: pd.DataFrame) -> tuple[list[str], np.ndarray]:
        if self.model is None:
            raise RuntimeError("Model not trained or loaded")
        X_scaled = self.scaler.transform(X[self.feature_names])
        probs = self.model.predict_proba(X_scaled)
        preds = self.label_encoder.inverse_transform(self.model.predict(X_scaled))
        return list(preds), probs

    def save(self, path: str) -> None:
        joblib.dump({
            "model": self.model,
            "scaler": self.scaler,
            "label_encoder": self.label_encoder,
            "feature_names": self.feature_names,
            "model_type": self.model_type,
        }, path)

    def load(self, path: str) -> None:
        data = joblib.load(path)
        self.model = data["model"]
        self.scaler = data["scaler"]
        self.label_encoder = data["label_encoder"]
        self.feature_names = data["feature_names"]
        self.model_type = data.get("model_type", "xgb")
