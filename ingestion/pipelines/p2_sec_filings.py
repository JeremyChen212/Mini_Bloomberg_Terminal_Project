"""
ingestion/pipelines/p2_sec_filings.py
───────────────────────────────────────
Pipeline 2: SEC Filings
Schedule: On new filing trigger (EventBridge + EDGAR RSS)
Sources:  SEC EDGAR direct + OpenBB SEC provider
Outputs:  data/raw/   → raw filing HTML/JSON
          data/processed/ → structured filing records

Matches architecture node:
    "Pipeline 2: SEC Filings — Lambda: Filing Scraper (on new filing trigger)"
"""

import json
import time
import requests
import pandas as pd
from pathlib import Path
from datetime import datetime

from ingestion.core.config import RAW_DIR, PROC_DIR, TTL
from ingestion.core.utils import get_logger, is_stale

log = get_logger("p2_sec_filings")

# SEC requires a User-Agent header — identify yourself to avoid being blocked
SEC_HEADERS = {
    "User-Agent": "OpenTerminal contact@yourdomain.com",
    "Accept-Encoding": "gzip, deflate",
}
SEC_RATE_LIMIT = 0.2   # 5 requests/sec max (SEC allows 10, we use 5 to be safe)

SUPPORTED_FORMS = ["10-K", "10-Q", "8-K", "DEF 14A", "S-1", "4"]


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _raw(ticker: str, dataset: str) -> Path:
    return RAW_DIR / f"{ticker}_{dataset}.json"


# ── EDGAR CIK lookup ──────────────────────────────────────────────────────────

def get_cik(ticker: str) -> str | None:
    """Look up CIK number for a ticker from SEC EDGAR."""
    path = RAW_DIR / f"{ticker}_cik.json"
    if path.exists():
        return json.loads(path.read_text()).get("cik")

    log.info(f"[{ticker}] Looking up CIK...")
    try:
        time.sleep(SEC_RATE_LIMIT)
        url = "https://efts.sec.gov/LATEST/search-index?q=%22{}%22&dateRange=custom&startdt=2000-01-01&forms=10-K".format(ticker)
        # Simpler approach: use the company tickers JSON
        resp = requests.get(
            "https://www.sec.gov/files/company_tickers.json",
            headers=SEC_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker.upper():
                cik = str(entry["cik_str"]).zfill(10)
                path.write_text(json.dumps({"ticker": ticker, "cik": cik}))
                log.info(f"[{ticker}] CIK found: {cik}")
                return cik
        log.warning(f"[{ticker}] CIK not found in EDGAR")
        return None
    except Exception as e:
        log.error(f"[{ticker}] CIK lookup failed: {e}")
        return None


# ── Fetch filings ─────────────────────────────────────────────────────────────

def fetch_filings(ticker: str, form_type: str = "10-K", limit: int = 10, force: bool = False) -> list[dict]:
    """
    Fetch filings list from SEC EDGAR for a given form type.
    Returns list of filing dicts with metadata.
    """
    dataset = f"filings_{form_type.replace(' ', '_')}"
    path = _raw(ticker, dataset)

    if not force and not is_stale(path, TTL["filings"]):
        log.info(f"[{ticker}] {form_type}: cache hit")
        return json.loads(path.read_text())

    cik = get_cik(ticker)
    if not cik:
        return []

    log.info(f"[{ticker}] {form_type}: fetching from EDGAR...")
    try:
        time.sleep(SEC_RATE_LIMIT)
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        resp = requests.get(url, headers=SEC_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        filings_raw = data.get("filings", {}).get("recent", {})
        forms   = filings_raw.get("form", [])
        dates   = filings_raw.get("filingDate", [])
        accnums = filings_raw.get("accessionNumber", [])
        docs    = filings_raw.get("primaryDocument", [])
        descs   = filings_raw.get("primaryDocDescription", [])

        results = []
        for i, form in enumerate(forms):
            if form.upper() != form_type.upper():
                continue
            accn = accnums[i].replace("-", "")
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn}/{docs[i]}"
            results.append({
                "ticker":          ticker,
                "cik":             cik,
                "form_type":       form,
                "filed_date":      dates[i],
                "accession_number":accnums[i],
                "primary_document":docs[i],
                "description":     descs[i] if i < len(descs) else None,
                "filing_url":      filing_url,
                "source":          "sec_edgar",
                "fetched_at":      datetime.now().isoformat(),
            })
            if len(results) >= limit:
                break

        path.write_text(json.dumps(results, indent=2))
        log.info(f"[{ticker}] {form_type}: {len(results)} filings saved → {path.name}")
        return results

    except Exception as e:
        log.error(f"[{ticker}] {form_type}: fetch failed — {e}")
        return []


# ── Pipeline entry point ───────────────────────────────────────────────────────

def run(ticker: str, force: bool = False) -> dict:
    """
    Run Pipeline 2 for one ticker.
    Fetches 10-K, 10-Q, and 8-K filings and saves structured records.
    """
    ticker = ticker.upper()
    log.info(f"── P2 START: {ticker} ──")

    all_filings = []
    for form in ["10-K", "10-Q", "8-K"]:
        filings = fetch_filings(ticker, form_type=form, limit=10, force=force)
        all_filings.extend(filings)

    # Save combined processed JSON
    out = PROC_DIR / f"{ticker}_p2_filings.json"
    out.write_text(json.dumps({
        "pipeline":   "p2_sec_filings",
        "ticker":     ticker,
        "total":      len(all_filings),
        "fetched_at": datetime.now().isoformat(),
        "filings":    all_filings,
    }, indent=2))
    log.info(f"[{ticker}] {len(all_filings)} total filings → {out.name}")
    log.info(f"── P2 DONE: {ticker} ──")

    return {"ticker": ticker, "filings": all_filings}
