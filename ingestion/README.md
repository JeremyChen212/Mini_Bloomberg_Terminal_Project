# OpenTerminal — Ingestion Layer

Modular data ingestion pipelines that feed the Bloomberg-alternative platform.
Each pipeline maps directly to a node in the architecture diagram.

## Structure

```
ingestion/
├── core/
│   ├── alignment.py       # Timestamp alignment engine (sparse-ref strategy)
│   ├── config.py          # Paths, TTLs, default watchlist
│   └── utils.py           # Shared logger + cache helpers
├── pipelines/
│   ├── p1_market_financials.py   # Prices, income, balance, cashflow
│   ├── p2_sec_filings.py         # SEC EDGAR 10-K, 10-Q, 8-K
│   ├── p3_news_sentiment.py      # News headlines + timestamps
│   └── p4_executives.py          # Officers + institutional holders
├── storage/               # (Phase 2) DynamoDB writer goes here
├── run_ingestion.py       # Master runner / CLI
└── watchlist.txt          # Your ticker universe
```

## Quick Start

```bash
pip install yfinance pandas requests fastapi uvicorn pydantic-settings

# Run all pipelines for AAPL
python -m ingestion.run_ingestion --ticker AAPL

# Run all pipelines for your watchlist
python -m ingestion.run_ingestion --watchlist ingestion/watchlist.txt

# Run only market data + SEC filings
python -m ingestion.run_ingestion --tickers AAPL MSFT --pipelines p1 p2

# Force re-fetch (bypass cache)
python -m ingestion.run_ingestion --ticker AAPL --force

# Use built-in default watchlist (top 10 tech)
python -m ingestion.run_ingestion --default
```

## Pipelines

| ID | Name | Schedule | Source | Output |
|----|------|----------|--------|--------|
| p1 | Market & Financials | Daily | yfinance | Prices, income, balance, cashflow, metrics |
| p2 | SEC Filings | On trigger | SEC EDGAR | 10-K, 10-Q, 8-K records |
| p3 | News & Sentiment | Hourly | yfinance news | Headlines, URLs, timestamps |
| p4 | Executives & Ownership | Weekly | yfinance | Officers, institutional holders |

## Output Files

```
data/
├── raw/
│   ├── AAPL_prices_2y.csv
│   ├── AAPL_income.csv
│   ├── AAPL_balance.csv
│   ├── AAPL_cashflow.csv
│   ├── AAPL_metrics.csv
│   ├── AAPL_filings_10-K.json
│   ├── AAPL_executives.json
│   └── ...
└── processed/
    ├── AAPL_p1_summary.json            ← feed into DynamoDB / RAG
    ├── AAPL_p2_filings.json
    ├── AAPL_p3_news.json
    ├── AAPL_p4_exec_ownership.json
    ├── AAPL_derived.csv
    └── watchlist_run_summary.json
```

---

## Alignment Layer

`ingestion/core/alignment.py` synchronizes all pipeline outputs onto a unified
timeline so the API can serve consistent, gap-free data to the frontend.

### Strategy

All datasets have different update frequencies — prices update daily, financials
annually, filings a few times a year, executives weekly. The alignment engine
handles this without fabricating data:

- **Sparsity order** (sparsest → densest): `executives → filings → financials → news → prices`
- **Forward-fill only** — each date carries the last known real value. Gaps stay
  null if no prior value exists. Nothing is invented.

Two modes are available:

| Mode | Index | Best for |
|------|-------|----------|
| `daily` | Every calendar day from `start` → `end` | Charts, time-series |
| `sparse` | Only dates where the sparsest dataset has a real point | Tables, event views |

### Usage (direct Python)

```python
from datetime import date
from ingestion.core.alignment import align, align_to_sparse_ref

# Daily mode — one row per calendar day
df = align("AAPL", date(2024, 1, 1), date(2024, 12, 31))

# Sparse mode — one row per real data point (executives/filings dates)
df = align_to_sparse_ref("AAPL", date(2024, 1, 1), date(2024, 12, 31))
```

---

## API Endpoint

Once ingestion has run, start the API server and the frontend can pull
aligned data directly:

```bash
uvicorn app.main:app --reload --port 8000
```

### `GET /api/v1/data/{ticker}`

Accepts a date range and returns all aligned datasets in a format ready
to populate the UI.

```
GET /api/v1/data/AAPL?start=2024-01-01&end=2024-12-31&mode=daily
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `start` | 1 year ago | Start date `YYYY-MM-DD` |
| `end` | today | End date `YYYY-MM-DD` |
| `mode` | `daily` | `daily` or `sparse` |
| `include` | all | Comma-separated: `prices,financials,filings,news,executives` |

**Example response:**

```json
{
  "success": true,
  "ticker": "AAPL",
  "start": "2024-01-01",
  "end": "2024-12-31",
  "mode": "daily",
  "row_count": 366,
  "columns": [
    { "key": "price_close", "label": "Price Close", "dataset": "prices", "type": "number" },
    { "key": "news_title",  "label": "News Title",  "dataset": "news",   "type": "string" }
  ],
  "rows": [
    {
      "date": "2024-01-02",
      "price_close": 185.2,
      "price_volume": 58293200,
      "news_title": "Apple hits record high",
      "news_url": "https://...",
      "filing_type": null,
      "exec_ceo_name": "Tim Cook"
    }
  ],
  "meta": {
    "alignment_strategy": "daily calendar index with forward-fill",
    "note": "Null values mean no data existed at or before that date. No values are fabricated."
  }
}
```

### Other endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/data/` | List all tickers with processed data available |
| `GET /api/v1/data/{ticker}/summary` | Latest value per column — good for overview cards |
| `GET /docs` | Interactive Swagger UI for the full API |
