"""
ingestion/core/config.py
─────────────────────────
Central config for the ingestion layer.
Mirrors pipeline structure from architecture diagram.
"""

from pathlib import Path

# ── Directory layout ───────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).resolve().parent.parent.parent
DATA_DIR  = BASE_DIR / "data"
RAW_DIR   = DATA_DIR / "raw"      # S3: Raw Filings & HTML (local equivalent)
PROC_DIR  = DATA_DIR / "processed" # S3: Processed JSON (local equivalent)
LOG_DIR   = BASE_DIR / "logs"

for d in [RAW_DIR, PROC_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Cache TTLs (hours) ────────────────────────────────────────────────────────
TTL = {
    "market":     24,    # Pipeline 1: daily
    "financials": 24,    # Pipeline 1: daily
    "filings":    6,     # Pipeline 2: on new filing trigger
    "news":       1,     # Pipeline 3: hourly
    "executives": 168,   # Pipeline 4: weekly (7 * 24)
    "patents":    168,   # Pipeline 5: weekly
}

# ── Default watchlist ─────────────────────────────────────────────────────────
DEFAULT_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "META", "TSLA", "NFLX", "CRM", "AMD",
]
