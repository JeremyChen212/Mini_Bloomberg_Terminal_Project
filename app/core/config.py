"""
app/core/config.py

Application settings for the Mini Bloomberg Terminal API.
"""
from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Mini Bloomberg Terminal"
    VERSION: str = "1.0.0"

    # FastAPI
    DEBUG: bool = False

    # CORS — allow local frontend dev servers
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",   # React / Next.js default
        "http://localhost:5173",   # Vite default
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # OpenBB / data provider
    DEFAULT_PROVIDER: str = "yfinance"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
