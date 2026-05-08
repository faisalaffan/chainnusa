"""FastAPI dependency injection — load models lazily from registry."""

import os
import logging
from functools import lru_cache

from app.models.wallet_clf import WalletClassifier
from app.models.anomaly import AnomalyDetector

log = logging.getLogger(__name__)

_clf_model: WalletClassifier | None = None
_anomaly_model: AnomalyDetector | None = None
_shap_explainer = None  # type: ignore — shap is optional


def init_models(model_dir: str = "models") -> None:
    global _clf_model, _anomaly_model, _shap_explainer

    clf_path = os.path.join(model_dir, "wallet_clf.pkl")
    anomaly_path = os.path.join(model_dir, "anomaly_detector.pkl")

    _clf_model = WalletClassifier()
    if os.path.exists(clf_path):
        _clf_model.load(clf_path)
        log.info(f"Loaded classifier from {clf_path}")
    else:
        log.warning(f"Classifier not found at {clf_path} — returning dummy predictions")

    _anomaly_model = AnomalyDetector()
    if os.path.exists(anomaly_path):
        _anomaly_model.load(anomaly_path)
        log.info(f"Loaded anomaly detector from {anomaly_path}")
    else:
        log.warning(f"Anomaly model not found at {anomaly_path} — returning dummy predictions")


def get_clf_model() -> WalletClassifier:
    if _clf_model is None:
        _clf_model = WalletClassifier()
    return _clf_model


def get_anomaly_model() -> AnomalyDetector:
    if _anomaly_model is None:
        _anomaly_model = AnomalyDetector()
    return _anomaly_model


def get_shap_explainer(clf: WalletClassifier):
    """Try to create SHAP explainer. Returns None if shap not installed or model not fitted."""
    global _shap_explainer
    if _shap_explainer is not None:
        return _shap_explainer
    if clf.model is None:
        return None
    try:
        import shap
        _shap_explainer = shap.TreeExplainer(clf.model)
        return _shap_explainer
    except ImportError:
        log.warning("shap not installed")
        return None
    except Exception as e:
        log.warning(f"SHAP explainer creation failed: {e}")
        return None
