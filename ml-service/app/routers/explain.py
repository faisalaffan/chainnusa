"""Endpoint /explain — SHAP explanations for wallet predictions."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import numpy as np

from app.features.extractor import WalletFeatureExtractor, NormalTxData, TokenTxData
from app.models.wallet_clf import WalletClassifier
from app.dependencies import get_clf_model, get_shap_explainer

router = APIRouter(prefix="/explain", tags=["explain"])


class ExplainRequest(BaseModel):
    address: str
    chain_id: int = 1
    normal_txs: list[dict] = []
    token_txs: list[dict] = []


class FeatureContribution(BaseModel):
    feature: str
    contribution: float
    direction: str  # "positive" or "negative"


class ExplainResponse(BaseModel):
    address: str
    predicted_class: str
    top_features: list[FeatureContribution]


@router.post("", response_model=ExplainResponse)
async def explain_prediction(
    req: ExplainRequest,
    clf: WalletClassifier = Depends(get_clf_model),
):
    extractor = WalletFeatureExtractor()
    normal_txs = [NormalTxData(**t) for t in req.normal_txs]
    token_txs = [TokenTxData(**t) for t in req.token_txs]
    features = extractor.extract(req.address, req.chain_id, normal_txs, token_txs)
    df = extractor.features_dataframe([features])

    try:
        preds, _ = clf.predict(df)
    except RuntimeError:
        preds = ["unknown"]

    contributions: list[FeatureContribution] = []
    try:
        explainer = get_shap_explainer(clf)
        if explainer is not None and clf.model is not None:
            X_scaled = clf.scaler.transform(df[clf.feature_names])
            class_idx = list(clf.label_encoder.classes_).index(preds[0])
            shap_values = explainer.shap_values(X_scaled)
            if isinstance(shap_values, list):
                vals = shap_values[class_idx][0]
            else:
                vals = shap_values[class_idx][0] if shap_values.ndim > 2 else shap_values[0]

            idx_sorted = np.argsort(-np.abs(vals))
            for i in idx_sorted[:8]:
                contributions.append(FeatureContribution(
                    feature=clf.feature_names[i],
                    contribution=round(float(vals[i]), 4),
                    direction="positive" if vals[i] > 0 else "negative",
                ))
    except Exception:
        pass

    return ExplainResponse(
        address=req.address,
        predicted_class=preds[0],
        top_features=contributions or [
            FeatureContribution(feature="(model not loaded)", contribution=0, direction="positive")
        ],
    )
