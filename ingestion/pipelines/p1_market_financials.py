"""
ingestion/pipelines/p1_market_financials.py

Pipeline 1: Market Data & Financials
Schedule: Daily cron
Sources:  OpenBB (yfinance provider)
Outputs:  data/raw/   → CSV per dataset per ticker
          data/processed/ → JSON summary per ticker

Matches architecture node:
    "Pipeline 1: Market & Financials — Lambda: OpenBB Fetcher (daily cron)"
"""

import json
import pandas as pd
from pathlib import Path
from datetime import datetime

from ingestion.core.config import RAW_DIR, PROC_DIR, TTL
from ingestion.core.utils import get_logger, is_stale, pct

log = get_logger("p1_market_financials")


# Cache Helpers

def _raw(ticker: str, dataset: str, ext: str = "csv") -> Path:
    return RAW_DIR / f"{ticker}_{dataset}.{ext}"


# Fetch Functions

def fetch_price_history(ticker: str, period: str = "2y", force: bool = False) -> pd.DataFrame:
    """OHLCV price history — Pipeline 1 market data."""
    path = _raw(ticker, f"prices_{period}")
    if not force and not is_stale(path, TTL["market"]):
        log.info(f"[{ticker}] prices: cache hit")
        return pd.read_csv(path, index_col=0, parse_dates=True)

    log.info(f"[{ticker}] prices: fetching ({period})...")
    try:
        import yfinance as yf
        df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
        df.to_csv(path)
        log.info(f"[{ticker}] prices: saved → {path.name}")
        return df
    except Exception as e:
        log.error(f"[{ticker}] prices: failed — {e}")
        return pd.DataFrame()


def fetch_income_statement(ticker: str, force: bool = False) -> pd.DataFrame:
    path = _raw(ticker, "income")
    if not force and not is_stale(path, TTL["financials"]):
        log.info(f"[{ticker}] income: cache hit")
        return pd.read_csv(path, index_col=0)

    log.info(f"[{ticker}] income: fetching...")
    try:
        import yfinance as yf
        df = yf.Ticker(ticker).financials.T
        df.index = pd.to_datetime(df.index).year
        df.index.name = "Year"
        df = df / 1e9  # → billions
        df.to_csv(path)
        log.info(f"[{ticker}] income: saved → {path.name}")
        return df
    except Exception as e:
        log.error(f"[{ticker}] income: failed — {e}")
        return pd.DataFrame()


def fetch_balance_sheet(ticker: str, force: bool = False) -> pd.DataFrame:
    path = _raw(ticker, "balance")
    if not force and not is_stale(path, TTL["financials"]):
        log.info(f"[{ticker}] balance: cache hit")
        return pd.read_csv(path, index_col=0)

    log.info(f"[{ticker}] balance: fetching...")
    try:
        import yfinance as yf
        df = yf.Ticker(ticker).balance_sheet.T
        df.index = pd.to_datetime(df.index).year
        df.index.name = "Year"
        df = df / 1e9
        df.to_csv(path)
        log.info(f"[{ticker}] balance: saved → {path.name}")
        return df
    except Exception as e:
        log.error(f"[{ticker}] balance: failed — {e}")
        return pd.DataFrame()


def fetch_cashflow(ticker: str, force: bool = False) -> pd.DataFrame:
    path = _raw(ticker, "cashflow")
    if not force and not is_stale(path, TTL["financials"]):
        log.info(f"[{ticker}] cashflow: cache hit")
        return pd.read_csv(path, index_col=0)

    log.info(f"[{ticker}] cashflow: fetching...")
    try:
        import yfinance as yf
        df = yf.Ticker(ticker).cashflow.T
        df.index = pd.to_datetime(df.index).year
        df.index.name = "Year"
        df = df / 1e9
        df.to_csv(path)
        log.info(f"[{ticker}] cashflow: saved → {path.name}")
        return df
    except Exception as e:
        log.error(f"[{ticker}] cashflow: failed — {e}")
        return pd.DataFrame()


def fetch_key_metrics(ticker: str, force: bool = False) -> dict:
    """Snapshot of valuation, profitability, health metrics."""
    path = _raw(ticker, "metrics")
    if not force and not is_stale(path, TTL["market"]):
        log.info(f"[{ticker}] metrics: cache hit")
        return pd.read_csv(path, index_col=0)["Value"].to_dict()

    log.info(f"[{ticker}] metrics: fetching...")
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info
        metrics = {
            # Identity
            "name":               info.get("longName"),
            "sector":             info.get("sector"),
            "industry":           info.get("industry"),
            "employees":          info.get("fullTimeEmployees"),
            "website":            info.get("website"),
            "country":            info.get("country"),
            # Price
            "price":              info.get("currentPrice"),
            "week_52_high":       info.get("fiftyTwoWeekHigh"),
            "week_52_low":        info.get("fiftyTwoWeekLow"),
            "market_cap_b":       round((info.get("marketCap") or 0) / 1e9, 2),
            # Valuation
            "pe_trailing":        info.get("trailingPE"),
            "pe_forward":         info.get("forwardPE"),
            "ps_ratio":           info.get("priceToSalesTrailing12Months"),
            "pb_ratio":           info.get("priceToBook"),
            "ev_ebitda":          info.get("enterpriseToEbitda"),
            "eps_ttm":            info.get("trailingEps"),
            # Profitability
            "gross_margin_pct":   pct(info.get("grossMargins")),
            "net_margin_pct":     pct(info.get("profitMargins")),
            "op_margin_pct":      pct(info.get("operatingMargins")),
            "roe_pct":            pct(info.get("returnOnEquity")),
            "roa_pct":            pct(info.get("returnOnAssets")),
            # Growth
            "revenue_growth_pct": pct(info.get("revenueGrowth")),
            "earnings_growth_pct":pct(info.get("earningsGrowth")),
            # Health
            "debt_equity":        info.get("debtToEquity"),
            "current_ratio":      info.get("currentRatio"),
            "quick_ratio":        info.get("quickRatio"),
            # Dividends
            "dividend_yield_pct": pct(info.get("dividendYield")),
            "payout_ratio_pct":   pct(info.get("payoutRatio")),
            # Risk
            "beta":               info.get("beta"),
            # Meta
            "fetched_at":         datetime.now().isoformat(),
            "source":             "yfinance",
        }
        pd.DataFrame.from_dict(metrics, orient="index", columns=["Value"]).to_csv(path)
        log.info(f"[{ticker}] metrics: saved → {path.name}")
        return metrics
    except Exception as e:
        log.error(f"[{ticker}] metrics: failed — {e}")
        return {}


def compute_derived(income: pd.DataFrame, balance: pd.DataFrame, cashflow: pd.DataFrame) -> pd.DataFrame:
    """Compute derived metrics not directly in yfinance info."""
    derived = pd.DataFrame()
    try:
        if "Total Revenue" in income.columns and not income.empty:
            rev = income["Total Revenue"].sort_index()
            derived["revenue_b"]          = rev
            derived["revenue_yoy_pct"]    = rev.pct_change() * 100

        if "Net Income" in income.columns and "Total Revenue" in income.columns:
            derived["net_margin_pct"]     = (income["Net Income"] / income["Total Revenue"]) * 100

        if "Gross Profit" in income.columns and "Total Revenue" in income.columns:
            derived["gross_margin_pct"]   = (income["Gross Profit"] / income["Total Revenue"]) * 100

        if "Free Cash Flow" in cashflow.columns and "Total Revenue" in income.columns:
            derived["fcf_margin_pct"]     = (cashflow["Free Cash Flow"] / income["Total Revenue"]) * 100

        if "Total Debt" in balance.columns and "Stockholders Equity" in balance.columns:
            derived["debt_equity"]        = balance["Total Debt"] / balance["Stockholders Equity"]

        derived = derived.round(2)
    except Exception as e:
        log.warning(f"Derived metrics partial failure: {e}")
    return derived


# Pipeline Entry Point

def run(ticker: str, force: bool = False) -> dict:
    """
    Run Pipeline 1 for one ticker.
    Returns structured dict ready for ETL → DynamoDB write.
    """
    ticker = ticker.upper()
    log.info(f"── P1 START: {ticker} ──")

    prices   = fetch_price_history(ticker, force=force)
    income   = fetch_income_statement(ticker, force=force)
    balance  = fetch_balance_sheet(ticker, force=force)
    cashflow = fetch_cashflow(ticker, force=force)
    metrics  = fetch_key_metrics(ticker, force=force)
    derived  = compute_derived(income, balance, cashflow)

    # Save derived CSV
    if not derived.empty:
        out = PROC_DIR / f"{ticker}_derived.csv"
        derived.to_csv(out)
        log.info(f"[{ticker}] derived: saved → {out.name}")

    # Save processed JSON summary (feed into RAG / DynamoDB later)
    summary = {
        "pipeline":  "p1_market_financials",
        "ticker":    ticker,
        "name":      metrics.get("name"),
        "sector":    metrics.get("sector"),
        "industry":  metrics.get("industry"),
        "fetched_at":metrics.get("fetched_at"),
        "metrics":   {k: v for k, v in metrics.items() if v is not None},
        "derived":   derived.to_dict() if not derived.empty else {},
    }
    json_path = PROC_DIR / f"{ticker}_p1_summary.json"
    with open(json_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    log.info(f"[{ticker}] JSON summary → {json_path.name}")
    log.info(f"── P1 DONE: {ticker} ──")

    return {
        "ticker":   ticker,
        "prices":   prices,
        "income":   income,
        "balance":  balance,
        "cashflow": cashflow,
        "metrics":  metrics,
        "derived":  derived,
        "summary":  summary,
    }
