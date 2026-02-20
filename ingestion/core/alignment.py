"""
ingestion/core/alignment.py

Timestamp Alignment Engine

Strategy:
- Use the MOST SPARSE dataset as the reference clock (avoids artificial gap-filling)
- Sparse order (sparsest → densest): executives → filings → financials → news → prices
- All other datasets are aligned TO the reference using backward-fill (last known value)
- No data is fabricated — gaps remain as null unless a real value exists at/before that date

This produces a unified timeline per ticker where every date has consistent,
non-hallucinated data across all pipeline outputs.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

from ingestion.core.config import PROC_DIR
from ingestion.core.utils import get_logger

log = get_logger("alignment")

# Sparsity order — index 0 = sparsest (used as reference clock first)
SPARSITY_ORDER = ["executives", "filings", "financials", "news", "prices"]


# ── Loaders — read processed JSON/CSV into dated Series/DataFrames ────────────

def load_prices(ticker: str) -> pd.DataFrame:
    """Daily OHLCV — densest dataset."""
    path = PROC_DIR.parent / "raw" / f"{ticker}_prices_2y.csv"
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_csv(path, index_col=0, parse_dates=True)
    df.index = pd.to_datetime(df.index).normalize()
    # Flatten MultiIndex columns if present (yfinance sometimes returns these)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0].lower() if isinstance(col, tuple) else col.lower() for col in df.columns]
    else:
        df.columns = [c.lower() for c in df.columns]
    return df[["close", "volume"]].rename(columns={"close": "price_close", "volume": "price_volume"})


def load_financials(ticker: str) -> pd.DataFrame:
    """Annual financials — sparse (1 row per year)."""
    path = PROC_DIR / f"{ticker}_p1_summary.json"
    if not path.exists():
        return pd.DataFrame()
    try:
        data = json.loads(path.read_text())
        derived = data.get("derived", {})
        if not derived:
            return pd.DataFrame()
        df = pd.DataFrame(derived)
        # derived index is year integers — convert to year-end dates
        df.index = pd.to_datetime([f"{y}-12-31" for y in df.index])
        df.index = df.index.normalize()
        return df
    except Exception as e:
        log.warning(f"[{ticker}] load_financials: {e}")
        return pd.DataFrame()


def load_filings(ticker: str) -> pd.DataFrame:
    """SEC filings — sparse (few per year)."""
    path = PROC_DIR / f"{ticker}_p2_filings.json"
    if not path.exists():
        return pd.DataFrame()
    try:
        data = json.loads(path.read_text())
        filings = data.get("filings", [])
        if not filings:
            return pd.DataFrame()
        rows = []
        for f in filings:
            d = f.get("filed_date")
            if d:
                rows.append({
                    "date":             pd.to_datetime(d).normalize(),
                    "filing_type":      f.get("form_type"),
                    "filing_url":       f.get("filing_url"),
                    "accession_number": f.get("accession_number"),
                })
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows).set_index("date")
        df = df[~df.index.duplicated(keep="last")]
        return df
    except Exception as e:
        log.warning(f"[{ticker}] load_filings: {e}")
        return pd.DataFrame()


def load_news(ticker: str) -> pd.DataFrame:
    """News articles — semi-dense (multiple per day possible)."""
    path = PROC_DIR / f"{ticker}_p3_news.json"
    if not path.exists():
        return pd.DataFrame()
    try:
        data = json.loads(path.read_text())
        articles = data.get("articles", [])
        if not articles:
            return pd.DataFrame()
        rows = []
        for a in articles:
            d = a.get("published_at")
            if d:
                rows.append({
                    "date":          pd.to_datetime(d).normalize(),
                    "news_title":    a.get("title"),
                    "news_url":      a.get("url"),
                    "news_publisher":a.get("publisher"),
                })
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows).set_index("date")
        # Keep most recent article per day
        df = df[~df.index.duplicated(keep="last")]
        return df
    except Exception as e:
        log.warning(f"[{ticker}] load_news: {e}")
        return pd.DataFrame()


def load_executives(ticker: str) -> pd.DataFrame:
    """Executive snapshot — sparsest (1 snapshot, weekly refresh)."""
    path = PROC_DIR / f"{ticker}_p4_exec_ownership.json"
    if not path.exists():
        return pd.DataFrame()
    try:
        data = json.loads(path.read_text())
        execs = data.get("executives", [])
        if not execs:
            return pd.DataFrame()
        fetched = pd.to_datetime(data.get("fetched_at", datetime.now().isoformat())).normalize()
        ceo = next((e for e in execs if "ceo" in (e.get("title") or "").lower()), None)
        if ceo:
            return pd.DataFrame([{
                "exec_ceo_name":  ceo.get("name"),
                "exec_ceo_title": ceo.get("title"),
                "exec_count":     len(execs),
            }], index=[fetched])
        return pd.DataFrame()
    except Exception as e:
        log.warning(f"[{ticker}] load_executives: {e}")
        return pd.DataFrame()


# Core Alignment Function

def align(
    ticker: str,
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Align all pipeline datasets for a ticker over [start, end].

    Steps:
    1. Load all datasets
    2. Pick the sparsest available dataset as the reference clock
    3. Build a unified date index from start → end (business days)
    4. Join all datasets onto that index using backward-fill (ffill)
       so each date carries the last known value — no data fabrication
    5. Return a clean DataFrame with one row per date

    Returns:
        pd.DataFrame with DatetimeIndex and columns from all pipelines.
        Columns are NaN where no data exists at or before that date.
    """
    ticker = ticker.upper()
    start_dt = pd.Timestamp(start).normalize()
    end_dt   = pd.Timestamp(end).normalize()

    # Load all datasets
    datasets = {
        "prices":     load_prices(ticker),
        "financials": load_financials(ticker),
        "filings":    load_filings(ticker),
        "news":       load_news(ticker),
        "executives": load_executives(ticker),
    }

    # Log what's available
    available = {k: len(v) for k, v in datasets.items() if not v.empty}
    log.info(f"[{ticker}] available datasets: {available}")

    if not available:
        log.warning(f"[{ticker}] No data available for alignment")
        return pd.DataFrame()

    # Build unified daily index over the requested range
    date_index = pd.date_range(start=start_dt, end=end_dt, freq="D")

    # Start with an empty frame on the full date index
    aligned = pd.DataFrame(index=date_index)
    aligned.index.name = "date"

    # Join each dataset using ffill (backward fill) — carries last known value forward
    for name, df in datasets.items():
        if df.empty:
            continue
        # Reindex onto the full date range, then ffill
        # Only fill forward from the first available data point
        df_reindexed = df.reindex(date_index, method=None)  # sparse join
        df_filled = df_reindexed.ffill()                    # carry forward
        aligned = aligned.join(df_filled, how="left")

    # Clip to requested range
    aligned = aligned.loc[start_dt:end_dt]

    log.info(f"[{ticker}] aligned: {len(aligned)} rows × {len(aligned.columns)} cols "
             f"({start_dt.date()} → {end_dt.date()})")
    return aligned


def align_to_sparse_ref(
    ticker: str,
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Strict version: uses the SPARSEST available dataset as the date index.
    Only returns rows where the sparse reference has a real data point.
    Use this when you want to avoid over-dense timelines.
    """
    ticker = ticker.upper()

    datasets = {
        "prices":     load_prices(ticker),
        "financials": load_financials(ticker),
        "filings":    load_filings(ticker),
        "news":       load_news(ticker),
        "executives": load_executives(ticker),
    }

    # Find sparsest available dataset
    ref_name = None
    ref_df = None
    for name in SPARSITY_ORDER:
        df = datasets.get(name)
        if df is not None and not df.empty:
            ref_name = name
            ref_df = df
            break

    if ref_df is None:
        return pd.DataFrame()

    log.info(f"[{ticker}] sparse reference clock: {ref_name} ({len(ref_df)} points)")

    start_dt = pd.Timestamp(start)
    end_dt   = pd.Timestamp(end)

    # Filter reference to date range
    ref_filtered = ref_df.loc[
        (ref_df.index >= start_dt) & (ref_df.index <= end_dt)
    ]
    if ref_filtered.empty:
        log.warning(f"[{ticker}] sparse ref '{ref_name}' has no data in range")
        return pd.DataFrame()

    aligned = pd.DataFrame(index=ref_filtered.index)
    aligned.index.name = "date"
    aligned = aligned.join(ref_filtered)

    # Join other datasets using ffill onto sparse reference dates
    for name, df in datasets.items():
        if name == ref_name or df.empty:
            continue
        # Reindex onto sparse ref dates, ffill from prior values
        combined_index = df.index.union(ref_filtered.index).sort_values()
        df_reindexed = df.reindex(combined_index).ffill()
        df_on_ref = df_reindexed.reindex(ref_filtered.index)
        aligned = aligned.join(df_on_ref, how="left", rsuffix=f"_{name}")

    return aligned
