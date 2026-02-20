"""
app/routers/aligned_data.py

Date-range aligned data endpoint.

GET /api/v1/data/{ticker}?start=2024-01-01&end=2024-12-31

Returns all pipeline datasets synchronized to a unified timeline,
ready to directly populate the UI.
"""

from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

# Allow importing ingestion layer from project root
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.cache import cached
from app.core.config import settings

router = APIRouter()

# Column → dataset mapping 
# Maps dataset names to known column prefixes produced by each pipeline.
# If a column exists in the aligned DataFrame but isn't listed here it falls
# under "other" — it will still be returned, just without a dataset label.
COL_PREFIXES: dict[str, list[str]] = {
    "prices":     ["price_"],
    "financials": ["revenue_", "net_margin", "gross_margin", "fcf_margin",
                   "debt_equity", "pe_", "eps_"],
    "filings":    ["filing_"],
    "news":       ["news_"],
    "executives": ["exec_"],
}

# Explicit full-column overrides (for columns that don't follow a clean prefix)
COL_EXPLICIT: dict[str, str] = {}  # add overrides here if needed


def _dataset_for_col(col: str) -> str:
    """Return the dataset name for a given column."""
    if col in COL_EXPLICIT:
        return COL_EXPLICIT[col]
    for dataset, prefixes in COL_PREFIXES.items():
        if any(col.startswith(p) for p in prefixes):
            return dataset
    return "other"


def _col_type(series) -> str:
    import pandas as pd
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    return "string"


def _serialize(val):
    """Make values JSON-safe."""
    import math
    import pandas as pd
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val


# Main endpoint

@router.get(
    "/{ticker}",
    summary="Aligned multi-pipeline data for a date range",
    response_description="Unified timeline with prices, financials, filings, news, and exec data",
)
@cached(ttl=120)  # cache each (ticker, start, end, mode, include) for 2 minutes
async def get_aligned_data(
    ticker: str,
    start: Optional[date] = Query(
        default=None,
        description="Start date (YYYY-MM-DD). Defaults to 1 year ago.",
    ),
    end: Optional[date] = Query(
        default=None,
        description="End date (YYYY-MM-DD). Defaults to today.",
    ),
    mode: str = Query(
        default="daily",
        description=(
            "Alignment mode:\n"
            "  daily  — one row per calendar day, all datasets ffill'd (default)\n"
            "  sparse — one row per sparse reference point (executives/filings dates only)"
        ),
    ),
    include: str = Query(
        default="prices,financials,filings,news,executives",
        description="Comma-separated list of datasets to include.",
    ),
):
    """
    Returns timestamp-aligned data across all ingestion pipelines for a ticker.

    **Alignment strategy:**
    - `daily`: unified calendar index, all datasets forward-filled onto every day.
      Best for charts and time-series views.
    - `sparse`: uses the sparsest dataset (executives → filings → financials …) as
      the reference clock. Only returns rows where the sparse ref has a real data point.
      Best for tables and event-driven views.

    **Frontend usage:**
    The response `rows` array can be mapped directly to chart data or table rows.
    Each row has a `date` key plus one key per available data column.
    Null values mean no data exists at or before that date for that field.
    """
    #  Defaults 
    if not end:
        end = date.today()
    if not start:
        start = end - timedelta(days=365)

    if start > end:
        raise HTTPException(status_code=400, detail="start must be before end")

    if mode not in ("daily", "sparse"):
        raise HTTPException(status_code=400, detail="mode must be 'daily' or 'sparse'")

    ticker = ticker.upper()
    requested_datasets = {d.strip() for d in include.split(",")}

    try:
        from ingestion.core.alignment import align, align_to_sparse_ref

        df = align_to_sparse_ref(ticker, start, end) if mode == "sparse" else align(ticker, start, end)

        if df.empty:
            return {
                "success":   True,
                "ticker":    ticker,
                "start":     str(start),
                "end":       str(end),
                "mode":      mode,
                "row_count": 0,
                "columns":   [],
                "rows":      [],
                "meta": {
                    "message": "No ingested data found. Run the ingestion layer first.",
                    "hint":    f"python -m ingestion.run_ingestion --ticker {ticker}",
                },
            }

        # Filter columns to requested datasets
        # Keep a column if it belongs to a requested dataset (or "other" always included)
        keep_cols = [
            col for col in df.columns
            if _dataset_for_col(col) in requested_datasets
            or _dataset_for_col(col) == "other"
        ]
        if keep_cols:
            df = df[keep_cols]

        # Build column metadata for the frontend
        columns_meta = [
            {
                "key":      col,
                "label":    col.replace("_", " ").title(),
                "dataset":  _dataset_for_col(col),
                "type":     _col_type(df[col]),
                "nullable": bool(df[col].isna().any()),
            }
            for col in df.columns
        ]

        # Serialize rows 
        rows = [
            {"date": idx.date().isoformat(), **{col: _serialize(row[col]) for col in df.columns}}
            for idx, row in df.iterrows()
        ]

        return {
            "success":   True,
            "ticker":    ticker,
            "start":     str(start),
            "end":       str(end),
            "mode":      mode,
            "row_count": len(rows),
            "columns":   columns_meta,
            "rows":      rows,
            "meta": {
                "alignment_strategy": (
                    "daily calendar index with forward-fill"
                    if mode == "daily"
                    else "sparse reference clock (sparsest available dataset)"
                ),
                "datasets_requested": sorted(requested_datasets),
                "datasets_present":   sorted({_dataset_for_col(c) for c in df.columns} - {"other"}),
                "note": (
                    "Null values mean no data existed at or before that date. "
                    "No values are fabricated."
                ),
            },
        }

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Ingestion layer not found ({e}). Make sure the ingestion/ folder is "
                "in your project root alongside app/."
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Summary endpoint 

@router.get(
    "/{ticker}/summary",
    summary="Summary snapshot — latest values per dataset",
)
@cached(ttl=300)  # 5 minutes — summary is cheap to cache longer
async def get_data_summary(ticker: str):
    """
    Returns the latest available value for each dataset column —
    no date range needed. Good for a company overview card.
    """
    try:
        from ingestion.core.alignment import align

        end = date.today()
        start = end - timedelta(days=365)
        df = align(ticker.upper(), start, end)

        if df.empty:
            return {"success": True, "ticker": ticker.upper(), "data": {}}

        summary = {}
        for col in df.columns:
            last_valid = df[col].dropna()
            if not last_valid.empty:
                summary[col] = {
                    "value":   _serialize(last_valid.iloc[-1]),
                    "as_of":   last_valid.index[-1].date().isoformat(),
                    "dataset": _dataset_for_col(col),
                }

        return {
            "success": True,
            "ticker":  ticker.upper(),
            "data":    summary,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Available tickers endpoint

@router.get(
    "/",
    summary="List tickers with available processed data",
)
async def list_available_tickers():
    """
    Scans the processed data directory and returns tickers
    that have at least one pipeline output file.
    """
    try:
        from ingestion.core.config import PROC_DIR
        import re

        files = list(PROC_DIR.glob("*.json")) + list(PROC_DIR.glob("*.csv"))
        # Extract ticker from filenames like AAPL_p1_summary.json
        tickers = sorted({
            re.match(r"^([A-Z]+)_", f.name).group(1)
            for f in files
            if re.match(r"^([A-Z]+)_", f.name)
        })
        return {"success": True, "tickers": tickers, "count": len(tickers)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
