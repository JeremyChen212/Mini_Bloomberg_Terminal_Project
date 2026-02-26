# Pluto Terminal

An open-source Bloomberg Terminal alternative built by the TQT Quantathon Team. The Bloomberg Terminal costs ~$25,000/year and is out of reach for most people - we're building a version that anyone can run locally, with a planned migration to AWS.

The terminal pulls financial data, SEC filings, news sentiment, and executive/institutional ownership into a single dashboard. A knowledge graph ties everything together so you can see how a company, its leadership, its investors, and its news all connect.

---

## What it does

- **Live stock chart** — price + volume with a crosshair tooltip and multiple time ranges (1D / 1W / 1M / 3M / 1Y / 5Y)
- **News feed** — real articles with sentiment tags (positive / negative / neutral), clickable links that open in a new tab
- **Knowledge graph** — interactive node graph connecting a company to its C-suite, institutional holders, SEC filings, recent news events, and peer companies. Click any node for a detail popup showing real data pulled from the ingestion pipeline
- **Data ingestion pipeline** — four modular Python pipelines that collect from yfinance, OpenBB, SEC EDGAR, and EventRegistry/NewsAPI to produce clean JSON and CSV outputs
- **Multi-ticker support** — AAPL, MSFT, and NFLX are pre-processed and ready to view; run the ingestion script for any ticker you want to add

---

## Tech Stack

### Frontend (`client/`)

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS v4 |
| State management | Zustand 5 |
| Server state / caching | TanStack Query v5 |
| Charts | Recharts 3 |
| Knowledge graph | @xyflow/react (React Flow) v12 |
| UI primitives | Radix UI (Dialog, Tabs, Tooltip) |
| Icons | Lucide React |
| Date formatting | date-fns |
| Fonts | IBM Plex Mono, Rajdhani (Google Fonts) |

### Backend (`app/`)

| Layer | Technology |
|---|---|
| Framework | FastAPI (Python) |
| Data provider | OpenBB Platform |
| API docs | Swagger UI at `/docs` |

### Data Ingestion (`ingestion/`)

| Layer | Technology |
|---|---|
| Market data | yfinance + OpenBB |
| News + sentiment | EventRegistry (NewsAPI.ai) |
| SEC filings | SEC EDGAR public API |
| Executive/ownership data | yfinance institutional API |
| Storage (current) | Local CSV + JSON in `data/` |
| Storage (planned) | AWS S3 + DynamoDB |

### Planned Cloud Architecture (AWS)

```
Public Sources (SEC EDGAR, yfinance, NewsAPI)
                │
                ▼
     AWS Lambda  ─── Ingestion / ETL
                │
                ▼
          AWS S3  ─── Raw filings + data
                │
                ▼
     AWS Lambda  ─── Parser / Processor
                │
                ▼
       AWS DynamoDB  ─── Processed data
                │
                ▼
  AWS API Gateway → Lambda  ─── REST API
                │
                ▼
  AWS CloudFront + React  ─── Dashboard UI
```

GPT/RAG integration over company fundamentals is planned once the first three pipelines are wired to the cloud.

---

## Project Structure

```
Mini_Bloomberg_Terminal_Project/
│
├── app/                              # FastAPI backend
│   ├── main.py                       # App entry point, CORS, routers
│   ├── core/
│   │   ├── config.py                 # Settings (provider, allowed origins, version)
│   │   └── cache.py                  # In-memory caching layer
│   └── routers/
│       └── aligned_data.py           # /api/v1/data endpoints
│
├── client/                           # React/TypeScript dashboard
│   ├── src/
│   │   ├── App.tsx                   # Auth gate — login → dashboard transition
│   │   ├── main.tsx                  # React root + QueryClientProvider
│   │   ├── index.css                 # Tailwind @theme (purple/fuchsia color palette)
│   │   ├── pages/
│   │   │   └── LoginPage.tsx         # Login screen with animated background
│   │   ├── components/
│   │   │   ├── navbar/               # Navbar, Searchbar, TickerDisplay, TimeRangeSelector
│   │   │   ├── layout/               # Dashboard layout with CHART/GRAPH toggle
│   │   │   ├── chart/                # ChartPanel — price area chart, volume, metrics grid
│   │   │   ├── graph/                # KnowledgeGraph — ReactFlow + node detail popups
│   │   │   └── news/                 # NewsFeed with sentiment filter tabs
│   │   ├── hooks/
│   │   │   ├── useChartData.tsx      # TanStack Query hooks for price data + company summary
│   │   │   └── useNews.tsx           # TanStack Query hook for news feed
│   │   ├── store/
│   │   │   └── terminalStore.tsx     # Zustand global store (selected ticker, time range)
│   │   ├── mocks/                    # Mock data for offline development (price, news, company)
│   │   └── types/                    # Shared TypeScript type definitions
│   ├── package.json
│   └── vite.config.ts
│
├── ingestion/                        # Python data ingestion
│   ├── run_ingestion.py              # CLI entry point
│   ├── core/
│   │   ├── config.py                 # Directory paths, TTL settings
│   │   ├── alignment.py              # Cross-pipeline data alignment utilities
│   │   └── utils.py                  # Shared helper functions
│   └── pipelines/
│       ├── p1_market_financials.py   # Price history, income statement, balance sheet, metrics
│       ├── p2_sec_filings.py         # 10-K, 10-Q, 8-K filings from SEC EDGAR
│       ├── p3_news_sentiment.py      # News articles + sentiment from EventRegistry
│       └── p4_executives.py          # C-suite bios, pay, institutional ownership data
│
├── data/
│   ├── raw/                          # Per-ticker CSVs + JSONs (direct from source APIs)
│   └── processed/                    # Clean JSON summaries per pipeline per ticker
│
├── logs/                             # Per-pipeline run logs
└── pluto-terminal/                   # Original login page prototype (React, no TypeScript)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Conda (recommended) or a virtualenv
- A free [EventRegistry / NewsAPI.ai](https://newsapi.ai/) account (for the news pipeline)

---

### 1 — Run the frontend (no backend required)

The dashboard runs entirely on mock data out of the box, so you can get it running with three commands. No API keys needed.

```bash
cd Mini_Bloomberg_Terminal_Project/client
npm install
npx vite build
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The login screen will appear — just click **Sign In** to get to the dashboard.

---

### 2 — Run the data ingestion pipeline

This pulls real data for any ticker and writes it to `data/raw/` and `data/processed/`.

```bash
# Step 1 — activate your conda environment
conda activate <your-env>

# Step 2 — install Python dependencies
pip install yfinance pandas requests eventregistry python-dotenv openbb

# Step 3 — set your EventRegistry API key, then reactivate the environment
conda env config vars set EVENTREGISTRY_API_KEY=your_actual_key_here

# Step 4 — run all four pipelines for a ticker (replace AAPL with any ticker)
python -m ingestion.run_ingestion --ticker AAPL
```

After a successful run you'll have:
- `data/raw/AAPL_prices_2y.csv`, `AAPL_income.csv`, `AAPL_filings_10-K.json`, etc.
- `data/processed/AAPL_p1_summary.json`, `AAPL_p2_filings.json`, `AAPL_p3_news.json`, `AAPL_p4_exec_ownership.json`

---

### 3 — Run the FastAPI backend (optional)

The backend serves the processed JSON files over REST. The frontend works without it using mock data, but you'll need it once the live data wiring is complete.

```bash
pip install fastapi uvicorn
uvicorn app.main:app --reload --port 8000
```

---

## The Four Data Pipelines

| Pipeline | What it collects | Output file |
|---|---|---|
| **P1 — Market & Financials** | Live price, 2-year OHLCV history, income statement, balance sheet, cash flow, key metrics (P/E, EPS, margins, beta) | `*_p1_summary.json` |
| **P2 — SEC Filings** | 10-K (annual report), 10-Q (quarterly report), 8-K (current events) pulled from SEC EDGAR | `*_p2_filings.json` |
| **P3 — News & Sentiment** | Up to 500 recent articles with headlines, sources, publish dates, and sentiment labels | `*_p3_news.json` |
| **P4 — Executives & Ownership** | C-suite names, titles, compensation, birth year + top institutional holders with % held, share count, total value, and quarter-over-quarter change | `*_p4_exec_ownership.json` |

---

## Pre-Processed Tickers

The following tickers have data already included in the repo:

| Ticker | Company |
|---|---|
| `AAPL` | Apple Inc. |
| `MSFT` | Microsoft Corporation |
| `NFLX` | Netflix Inc. |

To add a new ticker: `python -m ingestion.run_ingestion --ticker <TICKER>`

---

## Roadmap

- [x] Four-pipeline data ingestion (market, filings, news, execs)
- [x] React dashboard — price chart, volume chart, key metrics grid
- [x] Knowledge graph with node filtering
- [x] Node-click popups with real exec/institution data and linked news
- [x] Sentiment-filtered news feed with real article links
- [x] Login page integrated into the main dashboard app
- [ ] AWS deployment (S3 → Lambda → DynamoDB → API Gateway → CloudFront)
- [ ] Live backend replacing mock data
- [ ] GPT/RAG integration over company fundamentals
- [ ] Bloomberg-style shortcut command bar
- [ ] Excel + Jupyter notebook export APIs
- [ ] Expanded ticker watchlist
- [ ] C-suite data → stock price prediction model (TQT Week 10 deliverable)

---

## Team

Built by the TQT Quant Team — **Antara, Jayani, Jeremy, Jay, Dora, Diana**

| Focus area | Team members |
|---|---|
| Web scraping + data pipelines + frontend | Antara, Jeremy, Jay |
| UI/UX design (Figma) | Dora, Jeremy |
| AWS infrastructure | Antara, Diana, Dora, Jayani, Jeremy |

---

## Pitch Deck

[View on Google Slides](https://docs.google.com/presentation/d/1jLcxTmaq09rHVb9nUOH1IE7bj2pJqOpfK3PtmrF8Uqw/edit)

---
