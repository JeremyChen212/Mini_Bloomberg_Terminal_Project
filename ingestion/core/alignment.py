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
def _to_utc_naive_index(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure DatetimeIndex is timezone-naive (UTC) for safe comparisons/joins."""
    if df is None or df.empty:
        return df
    idx = pd.to_datetime(df.index, errors="coerce")
    # If tz-aware, convert to UTC then drop tz; if tz-naive, leave as-is.
    if getattr(idx, "tz", None) is not None:
        idx = idx.tz_convert("UTC").tz_localize(None)
    df = df.copy()
    df.index = idx
    return df[~df.index.isna()]

log = get_logger("alignment")

# Sparsity order — index 0 = sparsest (used as reference clock first)
SPARSITY_ORDER = ["executives", "filings", "financials", "news", "prices"]


# Loaders: read processed JSON/CSV into dated Series/DataFrames

def load_prices(ticker: str) -> pd.DataFrame:
    """Daily OHLCV — densest dataset."""
    path = PROC_DIR.parent / "raw" / f"{ticker}_prices_2y.csv"
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_csv(path, skiprows=3, header=0)
    df.columns = ["date", "close", "high", "low", "open", "volume"]
    df = df.dropna(subset=["date"])
    df = df[df["date"].str.match(r"\d{4}-\d{2}-\d{2}", na=False)]
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df = df.set_index("date")
    return df[["close", "volume"]].rename(
        columns={"close": "price_close", "volume": "price_volume"}
    )

def load_financials(ticker: str) -> pd.DataFrame:
    """Annual financials — sparse (1 row per year)."""
    # Prefer derived CSV if it exists
    csv_path = PROC_DIR / f"{ticker}_derived.csv"
    json_path = PROC_DIR / f"{ticker}_p1_summary.json"

    try:
        if csv_path.exists():
            df = pd.read_csv(csv_path)
	
            # Handle either: year is a column, or year is the first unnamed column (index-like)
            if "year" not in df.columns:
                first = df.columns[0]
                df = df.rename(columns={first: "year"})

            df["year"] = df["year"].astype(int)
            df = df.set_index("year")

        elif json_path.exists():
            data = json.loads(json_path.read_text())
            derived = data.get("derived", {})
            if not derived:
                return pd.DataFrame()
            df = pd.DataFrame(derived)

        else:
            return pd.DataFrame()

        # Anchor annual rows to year-start so they align onto daily dates for that year
        df.index = pd.to_datetime([f"{int(y)}-01-01" for y in df.index]).normalize()
        df = df.sort_index()
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
                    "date": pd.to_datetime(d, utc=True).tz_localize(None).normalize(),
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
def align(ticker: str, start: date, end: date) -> pd.DataFrame:
    ticker = ticker.upper()
    start_dt = pd.Timestamp(start).normalize()
    end_dt   = pd.Timestamp(end).normalize()

    datasets = {
        "prices":     load_prices(ticker),
        "financials": load_financials(ticker),
        "filings":    load_filings(ticker),
        "news":       load_news(ticker),
        "executives": load_executives(ticker),
    }
    datasets = {k: _to_utc_naive_index(v) for k, v in datasets.items()}

    available = {k: len(v) for k, v in datasets.items() if not v.empty}
    log.info(f"[{ticker}] available datasets: {available}")

    if not available:
        log.warning(f"[{ticker}] No data available for alignment")
        return pd.DataFrame()

    # clip requested range to available data across all datasets
    earliest = min(df.index.min() for df in datasets.values() if not df.empty).normalize()
    latest   = max(df.index.max() for df in datasets.values() if not df.empty).normalize()

    if end_dt < earliest or start_dt > latest:
        log.warning(
            f"[{ticker}] requested range outside available data: {start_dt.date()}->{end_dt.date()} "
            f"(available {earliest.date()}->{latest.date()})"
        )
        return pd.DataFrame(index=pd.DatetimeIndex([], name="date"))

    if start_dt < earliest:
        log.info(f"[{ticker}] shifting start {start_dt.date()} -> {earliest.date()} (earliest available)")
        start_dt = earliest

    if end_dt > latest:
        log.info(f"[{ticker}] shifting end {end_dt.date()} -> {latest.date()} (latest available)")
        end_dt = latest

    # Build unified daily index over the clipped range
    date_index = pd.date_range(start=start_dt, end=end_dt, freq="D")

    aligned = pd.DataFrame(index=date_index)
    aligned.index.name = "date"

    for name, df in datasets.items():
        if df.empty:
            continue
        df_reindexed = df.reindex(date_index, method=None)
        df_filled = df_reindexed.ffill()
        aligned = aligned.join(df_filled, how="left")

    log.info(f"[{ticker}] aligned: {len(aligned)} rows × {len(aligned.columns)} cols "
             f"({start_dt.date()} -> {end_dt.date()})")
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

    datasets = {k: _to_utc_naive_index(v) for k, v in datasets.items()}

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
