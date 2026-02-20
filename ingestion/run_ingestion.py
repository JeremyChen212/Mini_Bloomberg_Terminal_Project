"""
ingestion/run_ingestion.py
───────────────────────────
Master ingestion runner — orchestrates all 4 pipelines.

Usage:
    # Run all pipelines for one ticker
    python -m ingestion.run_ingestion --ticker AAPL

    # Run all pipelines for multiple tickers
    python -m ingestion.run_ingestion --tickers AAPL MSFT GOOGL NVDA

    # Run from a watchlist file (one ticker per line)
    python -m ingestion.run_ingestion --watchlist watchlist.txt

    # Run only specific pipelines
    python -m ingestion.run_ingestion --ticker AAPL --pipelines p1 p2

    # Force re-fetch (ignore cache)
    python -m ingestion.run_ingestion --ticker AAPL --force

Pipelines:
    p1 — Market Data & Financials  (daily)
    p2 — SEC Filings               (on trigger)
    p3 — News & Sentiment          (hourly)
    p4 — Executives & Ownership    (weekly)
"""

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from ingestion.core.config import PROC_DIR, DEFAULT_TICKERS
from ingestion.core.utils import get_logger
from ingestion.pipelines import (
    p1_market_financials,
    p2_sec_filings,
    p3_news_sentiment,
    p4_executives,
)

log = get_logger("run_ingestion")

PIPELINE_MAP = {
    "p1": p1_market_financials,
    "p2": p2_sec_filings,
    "p3": p3_news_sentiment,
    "p4": p4_executives,
}


def run_all_pipelines(ticker: str, pipelines: list[str], force: bool = False) -> dict:
    """Run selected pipelines for a single ticker."""
    ticker = ticker.upper()
    log.info(f"{'═'*55}")
    log.info(f"INGESTION START: {ticker}  pipelines={pipelines}")
    log.info(f"{'═'*55}")

    results = {"ticker": ticker, "started_at": datetime.now().isoformat()}

    for pid in pipelines:
        module = PIPELINE_MAP.get(pid)
        if not module:
            log.warning(f"Unknown pipeline: {pid}, skipping")
            continue
        try:
            results[pid] = module.run(ticker, force=force)
        except Exception as e:
            log.error(f"[{ticker}] {pid} crashed: {e}")
            results[pid] = {"error": str(e)}

    results["finished_at"] = datetime.now().isoformat()

    # Save master run summary
    out = PROC_DIR / f"{ticker}_ingestion_run.json"
    with open(out, "w") as f:
        json.dump(
            {k: v for k, v in results.items() if k not in ("ticker",)
             or isinstance(v, str)},
            f, indent=2, default=str
        )
    log.info(f"[{ticker}] Run summary → {out.name}")
    return results


def run_watchlist(tickers: list[str], pipelines: list[str], force: bool = False):
    """Run all selected pipelines across a list of tickers."""
    log.info(f"Starting watchlist ingestion: {len(tickers)} tickers, pipelines={pipelines}")
    summary = []

    for ticker in tickers:
        try:
            result = run_all_pipelines(ticker, pipelines, force=force)
            summary.append({"ticker": ticker, "status": "ok"})
        except Exception as e:
            log.error(f"[{ticker}] Watchlist run failed: {e}")
            summary.append({"ticker": ticker, "status": "error", "error": str(e)})
        time.sleep(0.5)  # be nice to APIs between tickers

    # Save watchlist run summary
    out = PROC_DIR / "watchlist_run_summary.json"
    out.write_text(json.dumps({
        "run_at":    datetime.now().isoformat(),
        "tickers":   tickers,
        "pipelines": pipelines,
        "results":   summary,
    }, indent=2))
    log.info(f"Watchlist complete. Summary → {out.name}")
    return summary


def load_watchlist_file(path: str) -> list[str]:
    with open(path) as f:
        return [line.strip().upper() for line in f if line.strip() and not line.startswith("#")]


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="OpenTerminal Ingestion Layer — runs data pipelines",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Pipelines:
  p1  Market Data & Financials  (prices, income, balance sheet, cashflow)
  p2  SEC Filings               (10-K, 10-Q, 8-K from EDGAR)
  p3  News & Sentiment          (headlines, publisher, timestamps)
  p4  Executives & Ownership    (officers, institutional holders)
        """,
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--ticker",    type=str,            help="Single ticker symbol")
    group.add_argument("--tickers",   type=str, nargs="+", help="Multiple ticker symbols")
    group.add_argument("--watchlist", type=str,            help="Path to watchlist .txt file")
    group.add_argument("--default",   action="store_true", help=f"Use default watchlist: {DEFAULT_TICKERS}")

    parser.add_argument(
        "--pipelines", type=str, nargs="+",
        choices=["p1", "p2", "p3", "p4"],
        default=["p1", "p2", "p3", "p4"],
        help="Which pipelines to run (default: all)",
    )
    parser.add_argument("--force", action="store_true", help="Force re-fetch, ignore cache")
    args = parser.parse_args()

    if args.ticker:
        tickers = [args.ticker]
    elif args.tickers:
        tickers = args.tickers
    elif args.watchlist:
        tickers = load_watchlist_file(args.watchlist)
        log.info(f"Loaded {len(tickers)} tickers from {args.watchlist}")
    elif args.default:
        tickers = DEFAULT_TICKERS

    run_watchlist(tickers, pipelines=args.pipelines, force=args.force)

    print(f"\n✅ Ingestion complete.")
    print(f"   Raw data  → data/raw/")
    print(f"   Processed → data/processed/")
    print(f"   Logs      → logs/")


if __name__ == "__main__":
    main()
