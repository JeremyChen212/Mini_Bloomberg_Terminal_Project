"""
ingestion/pipelines/p4_executives.py

Pipeline 4: Executives & Ownership
Schedule: Weekly cron
Sources:  yfinance (officers, institutional holders)
Outputs:  data/processed/ → JSON exec + ownership records

Matches architecture node:
    "Pipeline 4: Exec & Ownership — Lambda: Exec Scraper (weekly cron)"
"""

import json
from pathlib import Path
from datetime import datetime

import pandas as pd

from ingestion.core.config import RAW_DIR, PROC_DIR, TTL
from ingestion.core.utils import get_logger, is_stale

log = get_logger("p4_executives")


def fetch_executives(ticker: str, force: bool = False) -> list[dict]:
    path = RAW_DIR / f"{ticker}_executives.json"

    if not force and not is_stale(path, TTL["executives"]):
        log.info(f"[{ticker}] executives: cache hit")
        return json.loads(path.read_text())

    log.info(f"[{ticker}] executives: fetching...")
    try:
        import yfinance as yf
        officers = yf.Ticker(ticker).info.get("companyOfficers", [])
        execs = [
            {
                "ticker":             ticker,
                "name":               o.get("name"),
                "title":              o.get("title"),
                "year_born":          o.get("yearBorn"),
                "total_pay":          o.get("totalPay"),
                "exercised_value":    o.get("exercisedValue"),
                "unexercised_value":  o.get("unexercisedValue"),
                "source":             "yfinance",
                "fetched_at":         datetime.now().isoformat(),
            }
            for o in officers
        ]
        path.write_text(json.dumps(execs, indent=2))
        log.info(f"[{ticker}] executives: {len(execs)} officers saved → {path.name}")
        return execs
    except Exception as e:
        log.error(f"[{ticker}] executives: failed — {e}")
        return []


def fetch_institutional_holders(ticker: str, force: bool = False) -> list[dict]:
    path = RAW_DIR / f"{ticker}_institutions.json"

    if not force and not is_stale(path, TTL["executives"]):
        log.info(f"[{ticker}] institutions: cache hit")
        return json.loads(path.read_text())

    log.info(f"[{ticker}] institutions: fetching...")
    try:
        import yfinance as yf
        df = yf.Ticker(ticker).institutional_holders
        if df is None or df.empty:
            return []
        records = df.to_dict(orient="records")
        # Serialize dates
        for r in records:
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()
        path.write_text(json.dumps(records, indent=2, default=str))
        log.info(f"[{ticker}] institutions: {len(records)} holders → {path.name}")
        return records
    except Exception as e:
        log.error(f"[{ticker}] institutions: failed — {e}")
        return []


def run(ticker: str, force: bool = False) -> dict:
    ticker = ticker.upper()
    log.info(f"── P4 START: {ticker} ──")

    executives   = fetch_executives(ticker, force=force)
    institutions = fetch_institutional_holders(ticker, force=force)

    out = PROC_DIR / f"{ticker}_p4_exec_ownership.json"
    out.write_text(json.dumps({
        "pipeline":     "p4_executives",
        "ticker":       ticker,
        "fetched_at":   datetime.now().isoformat(),
        "executives":   executives,
        "institutions": institutions,
    }, indent=2, default=str))
    log.info(f"── P4 DONE: {ticker} ──")

    return {"ticker": ticker, "executives": executives, "institutions": institutions}
