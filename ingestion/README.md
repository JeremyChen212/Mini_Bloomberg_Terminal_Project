# OpenTerminal — Ingestion Layer

Modular data ingestion pipelines that feed the Bloomberg-alternative platform.
Each pipeline maps directly to a node in the architecture diagram.

## Structure

```
ingestion/
├── core/
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
pip install yfinance pandas requests

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
    ├── AAPL_p1_summary.json       ← feed into DynamoDB / RAG
    ├── AAPL_p2_filings.json
    ├── AAPL_p3_news.json
    ├── AAPL_p4_exec_ownership.json
    ├── AAPL_derived.csv
    └── watchlist_run_summary.json
```

## Phase 2: DynamoDB Writer

The `storage/` folder is reserved for the DynamoDB persistence layer.
Once you're ready to move to AWS, add a `dynamo_writer.py` there that
reads from `data/processed/` and writes to your DynamoDB tables.

## Phase 3: AI / RAG

The `*_summary.json` files are already structured for RAG ingestion.
Feed them into a vector store (OpenSearch / Bedrock) or pass directly
to GPT/Claude API with context.
