"""
ingestion/core/utils.py
────────────────────────
Shared logging + cache helpers used by all pipelines.
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path

from ingestion.core.config import LOG_DIR


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        fmt = logging.Formatter("%(asctime)s  %(levelname)-8s  %(name)s  %(message)s")
        # File handler
        fh = logging.FileHandler(LOG_DIR / f"{name}.log")
        fh.setFormatter(fmt)
        # Console handler
        ch = logging.StreamHandler()
        ch.setFormatter(fmt)
        logger.addHandler(fh)
        logger.addHandler(ch)
    return logger


def is_stale(path: Path, ttl_hours: int) -> bool:
    """Return True if file doesn't exist or is older than ttl_hours."""
    if not path.exists():
        return True
    age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
    return age > timedelta(hours=ttl_hours)


def pct(val) -> float | None:
    """Convert decimal ratio → rounded percentage."""
    if val is None:
        return None
    return round(val * 100, 2)
