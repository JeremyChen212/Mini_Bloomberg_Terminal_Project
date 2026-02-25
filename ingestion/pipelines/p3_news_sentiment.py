import json
from datetime import datetime
from ingestion.core.config import PROC_DIR, TTL, EVENTREGISTRY_API_KEY
from ingestion.core.utils import get_logger, is_stale
from eventregistry import (
    EventRegistry,
    QueryArticlesIter,
    QueryItems,
)


log = get_logger("p3_news_sentiment")

TICKER_TO_COMPANY: dict[str, str] = {
    "TSLA":  "Tesla",
    "MSFT":  "Microsoft",
    "GOOGL": "Google",
    "AAPL":  "Apple",
    "AMZN":  "Amazon",
    "META":  "Meta",
    "NVDA":  "NVIDIA",
    "AMD":   "Advanced Micro Devices",  
    "CRM":   "Salesforce",               
    "NFLX":  "Netflix",
}

# Shared EventRegistry client — initialised once at module load.
# allowUseOfArchive=False restricts results to the last ~31 days (free tier).
_er: EventRegistry | None = None


def _get_client() -> EventRegistry:
    global _er
    if _er is None:
        key = EVENTREGISTRY_API_KEY
        if not key:
            raise EnvironmentError(
                "EVENTREGISTRY_API_KEY is not set. "
                "Add it to your .env file or environment variables:\n"
                "  export EVENTREGISTRY_API_KEY=your_key_here"
            )
        log.info(f"Initialising EventRegistry client (key ends: ...{key[-4:]})")
        _er = EventRegistry(
            apiKey=key,
            allowUseOfArchive=False,
        )
    return _er


def _resolve_uris(er: EventRegistry, ticker: str, keyword: str) -> tuple[str, str]:
    """
    Resolve the concept URI for the company and the 'news/Business' category URI.
    Results are deterministic for a given keyword so no extra caching is needed —
    the SDK caches internally, and the calls are fast.
    """
    concept_uri  = er.getConceptUri(keyword)
    category_uri = er.getCategoryUri("news")
    log.info(f"[{ticker}] concept_uri={concept_uri}  category_uri={category_uri}")
    return concept_uri, category_uri


def _parse_article(ticker: str, item: dict) -> dict:
    """Normalize an EventRegistry article object into the pipeline schema."""
    return {
        "ticker":       ticker,
        "title":        item.get("title"),
        "publisher":    item.get("source", {}).get("title"),
        "url":          item.get("url"),
        "published_at": item.get("dateTimePub"),
        "description":  item.get("body", "")[:500],   # truncate for storage
        "source":       "eventregistry",
        "fetched_at":   datetime.utcnow().isoformat(),
        # sentiment: placeholder — fill with LLM in Phase 3 AI pipeline
        "sentiment":    None,
    }


def fetch_news(
    ticker:  str,
    keyword: str | None = None,
    limit:   int  = 500,
    force:   bool = False,
) -> list[dict]:
    """
    Fetch news articles for *ticker* via the EventRegistry SDK.

    Args:
        ticker:  Stock ticker used for cache keying and output tagging.
        keyword: Company name sent to getConceptUri (defaults to TICKER_TO_COMPANY
                 lookup, then falls back to the raw ticker symbol).
        limit:   Max articles to retrieve (pass None for all available).
        force:   Bypass cache and always fetch fresh data.

    Returns:
        List of normalised article dicts.
    """
    path = PROC_DIR / f"{ticker}_p3_news.json"

    if not force and not is_stale(path, TTL["news"]):
        log.info(f"[{ticker}] news: cache hit")
        return json.loads(path.read_text()).get("articles", [])

    search_keyword = keyword or TICKER_TO_COMPANY.get(ticker, ticker)
    log.info(f"[{ticker}] news: fetching via EventRegistry SDK (keyword='{search_keyword}')...")

    try:
        er = _get_client()
        concept_uri, category_uri = _resolve_uris(er, ticker, search_keyword)
        query_kwargs: dict = {}

        if concept_uri:
            query_kwargs["conceptUri"] = concept_uri
        else:
            # Fallback: plain keyword search so the pipeline doesn't fail
            query_kwargs["keywords"] = search_keyword
            log.info(f"[{ticker}] Using keyword fallback: '{search_keyword}'")

        if category_uri:
            query_kwargs["categoryUri"] = category_uri

        if not query_kwargs:
            log.error(f"[{ticker}] news: no valid query params — skipping")
            return []

        q = QueryArticlesIter(
            conceptUri  = concept_uri,
            categoryUri = category_uri,
        )

        articles: list[dict] = []
        for item in q.execQuery(er, sortBy="date", maxItems=limit):
            articles.append(_parse_article(ticker, item))

        out = {
            "pipeline":   "p3_news_sentiment",
            "ticker":     ticker,
            "keyword":    search_keyword,
            "total":      len(articles),
            "fetched_at": datetime.utcnow().isoformat(),
            "articles":   articles,
        }
        path.write_text(json.dumps(out, indent=2))
        log.info(f"[{ticker}] news: {len(articles)} articles -> {path.name}")
        return articles

    except EnvironmentError:
        raise
    except Exception as e:
        log.error(f"[{ticker}] news: failed — {e}")
        return []


def run(ticker: str, keyword: str | None = None, force: bool = False) -> dict:
    ticker = ticker.upper()
    log.info(f"-- P3 START: {ticker} --")
    articles = fetch_news(ticker, keyword=keyword, force=force)
    log.info(f"-- P3 DONE:  {ticker} --")
    return {"ticker": ticker, "articles": articles}