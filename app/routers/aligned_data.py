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


def _serialize(val):
    """Make values JSON-safe."""
    import math
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val


@router.get(
    "/{ticker}",
    summary="Aligned multi-pipeline data for a date range",
    response_description="Unified timeline with prices, financials, filings, news, and exec data",
)
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
            "  sparse — one row per sparse reference point (filings/financials dates only)"
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
    - `sparse`: uses the sparsest dataset (filings/financials) as the reference clock.
      Best for tables and event-driven views.

    **Frontend usage:**
    The response `rows` array can be mapped directly to chart data or table rows.
    Each row has a `date` key plus one key per available data column.
    Null values mean no data exists at or before that date for that field.
    """
    # Defaults
    if not end:
        end = date.today()
    if not start:
        start = end - timedelta(days=365)

    if start > end:
        raise HTTPException(status_code=400, detail="start must be before end")

    ticker = ticker.upper()

    try:
        from ingestion.core.alignment import align, align_to_sparse_ref

        if mode == "sparse":
            df = align_to_sparse_ref(ticker, start, end)
        else:
            df = align(ticker, start, end)

        if df.empty:
            return {
                "success": True,
                "ticker": ticker,
                "start": str(start),
                "end": str(end),
                "mode": mode,
                "row_count": 0,
                "columns": [],
                "rows": [],
                "meta": {
                    "message": "No ingested data found. Run the ingestion layer first.",
                    "hint": "python -m ingestion.run_ingestion --ticker " + ticker,
                },
            }

        # Filter columns by requested datasets
        requested = [d.strip() for d in include.split(",")]
        col_filter = []
        col_map = {
            "prices":     ["price_close", "price_volume"],
            "financials": ["revenue_b", "revenue_yoy_pct", "net_margin_pct",
                           "gross_margin_pct", "fcf_margin_pct", "debt_equity"],
            "filings":    ["filing_type", "filing_url", "accession_number"],
            "news":       ["news_title", "news_url", "news_publisher"],
            "executives": ["exec_ceo_name", "exec_ceo_title", "exec_count"],
        }
        for dataset in requested:
            for col in col_map.get(dataset, []):
                if col in df.columns:
                    col_filter.append(col)

        if col_filter:
            df = df[[c for c in col_filter if c in df.columns]]

        # Serialize to list of row dicts
        rows = []
        for idx, row in df.iterrows():
            record = {"date": idx.date().isoformat()}
            for col in df.columns:
                record[col] = _serialize(row[col])
            rows.append(record)

        # Build column metadata for the frontend
        columns_meta = []
        for col in df.columns:
            columns_meta.append({
                "key":      col,
                "label":    col.replace("_", " ").title(),
                "dataset":  next((k for k, v in col_map.items() if col in v), "other"),
                "type":     "number" if df[col].dtype in ["float64", "int64"] else "string",
                "nullable": bool(df[col].isna().any()),
            })

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
                    else "sparse reference clock (sparsest dataset)"
                ),
                "note": (
                    "Null values mean no data existed at or before that date. "
                    "No values are fabricated."
                ),
            },
        }

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail=(
                "Ingestion layer not found. Make sure the ingestion/ folder is "
                "in your project root alongside app/."
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{ticker}/summary",
    summary="Summary snapshot — latest values per dataset",
)
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

        # Get last non-null value for each column
        summary = {}
        for col in df.columns:
            last_valid = df[col].dropna()
            if not last_valid.empty:
                summary[col] = {
                    "value": _serialize(last_valid.iloc[-1]),
                    "as_of": last_valid.index[-1].date().isoformat(),
                }

        return {
            "success": True,
            "ticker":  ticker.upper(),
            "data":    summary,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
