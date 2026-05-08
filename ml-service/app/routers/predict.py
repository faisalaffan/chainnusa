"""Endpoint /predict — wallet classification + anomaly detection."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import pandas as pd

from app.features.extractor import WalletFeatureExtractor, NormalTxData, TokenTxData
from app.models.wallet_clf import WalletClassifier
from app.models.anomaly import AnomalyDetector
from app.dependencies import get_clf_model, get_anomaly_model

router = APIRouter(prefix="/predict", tags=["predict"])


class TxInput(BaseModel):
    hash: str = ""
    block_number: str = "0"
    time_stamp: str = "0"
    from_addr: str = ""
    to_addr: str = ""
    value: str = "0"
    gas: str = "0"
    gas_price: str = "0"
    gas_used: str = "0"
    is_error: str = "0"
    input: str = "0x"
    contract_address: str = ""
    method_id: str = ""
    function_name: str = ""


class TokenTxInput(BaseModel):
    hash: str = ""
    block_number: str = "0"
    time_stamp: str = "0"
    from_addr: str = ""
    to_addr: str = ""
    value: str = "0"
    token_name: str = ""
    token_symbol: str = ""
    token_decimal: str = "18"
    contract_address: str = ""


class PredictRequest(BaseModel):
    address: str
    chain_id: int = 1
    normal_txs: list[TxInput] = []
    token_txs: list[TokenTxInput] = []


class PredictResponse(BaseModel):
    address: str
    chain_id: int
    classification: str
    class_probabilities: dict[str, float]
    is_anomaly: bool
    anomaly_score: float


@router.post("", response_model=PredictResponse)
async def predict_wallet(
    req: PredictRequest,
    clf: WalletClassifier = Depends(get_clf_model),
    anomaly: AnomalyDetector = Depends(get_anomaly_model),
):
    extractor = WalletFeatureExtractor()
    normal_txs = [
        NormalTxData(**t.model_dump()) for t in req.normal_txs
    ]
    token_txs = [
        TokenTxData(**t.model_dump()) for t in req.token_txs
    ]
    features = extractor.extract(req.address, req.chain_id, normal_txs, token_txs)
    df = extractor.features_dataframe([features])

    try:
        preds, probs = clf.predict(df)
    except RuntimeError:
        preds, probs = ["unknown"], [[1.0]]

    try:
        anom_bool, anom_scores = anomaly.predict(df)
    except RuntimeError:
        anom_bool, anom_scores = [False], [0.0]

    prob_dict = {cls: float(p) for cls, p in zip(clf.label_encoder.classes_, probs[0])}

    return PredictResponse(
        address=req.address,
        chain_id=req.chain_id,
        classification=preds[0],
        class_probabilities=prob_dict,
        is_anomaly=bool(anom_bool[0]),
        anomaly_score=float(anom_scores[0]),
    )
