"""ChainNusa ML Service — FastAPI entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import predict, explain, cluster
from app.dependencies import init_models

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(f"Starting ChainNusa ML service | log_level={settings.log_level}")
    os.makedirs(settings.model_registry_path, exist_ok=True)
    init_models(settings.model_registry_path)
    yield
    log.info("Shutdown ChainNusa ML service")


app = FastAPI(
    title="ChainNusa ML Service",
    description="Wallet feature extraction, classification, anomaly detection, and clustering",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Internal auth middleware
@app.middleware("http")
async def internal_auth(request: Request, call_next):
    if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
        return await call_next(request)
    token = request.headers.get("X-Internal-Token", "")
    if token != settings.internal_token:
        raise HTTPException(401, "Unauthorized — invalid internal token")
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "chainnusa-ml", "version": "0.2.0"}


app.include_router(predict.router)
app.include_router(explain.router)
app.include_router(cluster.router)
