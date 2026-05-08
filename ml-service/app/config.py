from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://chainnusa:chainnusa@localhost:5432/chainnusa"
    mlflow_tracking_uri: str = "http://localhost:5000"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "chainnusa-models"
    internal_token: str = "chainnusa-internal-secret"
    model_registry_path: str = "models"
    log_level: str = "INFO"

    model_config = {"env_prefix": "ML_", "env_file": ".env"}


settings = Settings()
