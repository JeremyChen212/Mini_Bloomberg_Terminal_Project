"""
ingestion/pipelines/p3_news_sentiment.py
──────────────────────────────────────────
Pipeline 3: News & Sentiment
Schedule: Hourly cron
Sources:  yfinance news feed
Outputs:  data/processed/ → JSON news feed per ticker

Matches architecture node:
    "Pipeline 3: News & Sentiment — Lambda: News Fetcher (hourly cron)"
"""

import json
from pathlib import Path
from datetime import datetime

from ingestion.core.config import PROC_DIR, TTL
from ingestion.core.utils import get_logger, is_stale

log = get_logger("p3_news_sentiment")


def fetch_news(ticker: str, limit: int = 20, force: bool = False) -> list[dict]:
    path = PROC_DIR / f"{ticker}_p3_news.json"

    if not force and not is_stale(path, TTL["news"]):
        log.info(f"[{ticker}] news: cache hit")
        return json.loads(path.read_text()).get("articles", [])

    log.info(f"[{ticker}] news: fetching...")
    try:
        import yfinance as yf
        raw = yf.Ticker(ticker).news or []
        articles = []
        for item in raw[:limit]:
            articles.append({
                "ticker":      ticker,
                "title":       item.get("title"),
                "publisher":   item.get("publisher"),
                "url":         item.get("link"),
                "published_at":datetime.fromtimestamp(item.get("providerPublishTime", 0)).isoformat()
                               if item.get("providerPublishTime") else None,
                "source":      "yfinance",
                "fetched_at":  datetime.now().isoformat(),
                # sentiment: placeholder — fill with LLM in Phase 3 AI pipeline
                "sentiment":   None,
            })

        out = {
            "pipeline":   "p3_news_sentiment",
            "ticker":     ticker,
            "total":      len(articles),
            "fetched_at": datetime.now().isoformat(),
            "articles":   articles,
        }
        path.write_text(json.dumps(out, indent=2))
        log.info(f"[{ticker}] news: {len(articles)} articles → {path.name}")
        return articles

    except Exception as e:
        log.error(f"[{ticker}] news: failed — {e}")
        return []


def run(ticker: str, force: bool = False) -> dict:
    ticker = ticker.upper()
    log.info(f"── P3 START: {ticker} ──")
    articles = fetch_news(ticker, force=force)
    log.info(f"── P3 DONE: {ticker} ──")
    return {"ticker": ticker, "articles": articles}
