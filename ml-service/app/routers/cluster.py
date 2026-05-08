"""Endpoint /cluster — KMeans wallet clustering (persona)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from app.features.extractor import WalletFeatureExtractor, NormalTxData, TokenTxData, WalletFeatures

router = APIRouter(prefix="/cluster", tags=["cluster"])


class ClusterRequest(BaseModel):
    wallets: list[dict]  # each has address, chain_id, normal_txs, token_txs


class ClusterPoint(BaseModel):
    address: str
    cluster_id: int
    x: float
    y: float


class ClusterResponse(BaseModel):
    n_clusters: int
    points: list[ClusterPoint]
    cluster_sizes: dict[int, int]


@router.post("", response_model=ClusterResponse)
async def cluster_wallets(req: ClusterRequest, n_clusters: int = 4):
    if len(req.wallets) < 3:
        raise HTTPException(400, "Need at least 3 wallets for clustering")

    extractor = WalletFeatureExtractor()
    features_list: list[WalletFeatures] = []
    for w in req.wallets:
        normal_txs = [NormalTxData(**t) for t in w.get("normal_txs", [])]
        token_txs = [TokenTxData(**t) for t in w.get("token_txs", [])]
        feat = extractor.extract(
            w["address"], w.get("chain_id", 1), normal_txs, token_txs,
        )
        features_list.append(feat)

    df = extractor.features_dataframe(features_list)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df)

    k = min(n_clusters, len(req.wallets))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_scaled)

    points = []
    for i, w in enumerate(req.wallets):
        points.append(ClusterPoint(
            address=w["address"],
            cluster_id=int(labels[i]),
            x=round(float(coords[i, 0]), 4),
            y=round(float(coords[i, 1]), 4),
        ))

    sizes = {int(k): int(v) for k, v in pd.Series(labels).value_counts().to_dict().items()}

    return ClusterResponse(n_clusters=k, points=points, cluster_sizes=sizes)
