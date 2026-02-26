// src/mocks/news.ts
// Mock P3 news articles. Replace fetchNews() body when API is ready.

import type { NewsArticle } from "../types";

export const MOCK_NEWS: Record<string, NewsArticle[]> = {
  AAPL: [
    {
      id: "n1",
      headline: "Apple beats Q1 FY2026 earnings, EPS $2.40 vs $2.35 expected",
      source: "Reuters",
      published_at: "2026-01-29T22:14:00Z",
      sentiment: "positive",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Apple stock rises on US manufacturing expansion
      url: "https://www.newsdirectory3.com/apple-stock-rises-on-us-manufacturing-expansion-supply-chain-shift/",
    },
    {
      id: "n2",
      headline: "Apple Vision Pro sales disappoint in first full year, analysts cut estimates",
      source: "Bloomberg",
      published_at: "2026-02-12T15:30:00Z",
      sentiment: "negative",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Siri-ous problem threat to Apple stock (Nasdaq)
      url: "https://www.nasdaq.com/articles/siri-ous-problem-could-be-biggest-threat-apple-stock",
    },
    {
      id: "n3",
      headline: "Apple expands AI features to older iPhone models via iOS 19.2",
      source: "The Verge",
      published_at: "2026-02-18T11:00:00Z",
      sentiment: "positive",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Apple Mac mini US manufacturing (Ars Technica)
      url: "https://arstechnica.com/apple/2026/02/in-a-replay-of-2019-apple-says-a-single-desktop-mac-will-be-manufactured-in-the-us/",
    },
    {
      id: "n4",
      headline: "DOJ antitrust investigation into App Store pricing continues",
      source: "WSJ",
      published_at: "2026-02-20T09:45:00Z",
      sentiment: "negative",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Apple shareholders vote against China business scrutiny (IT Watch)
      url: "https://itwatch.dk/ITNyt/teknologi/article19051099.ece",
    },
    {
      id: "n5",
      headline: "Apple suppliers report strong Q2 orders for iPhone 18 components",
      source: "Nikkei Asia",
      published_at: "2026-02-21T04:20:00Z",
      sentiment: "positive",
      related_tickers: ["AAPL", "TSMC"],
      // Real article from AAPL_p3_news.json — Apple Mac mini soon made in US (NewsBytesApp)
      url: "https://www.newsbytesapp.com/news/science/apple-to-shift-mac-mini-production-to-us/story",
    },
    {
      id: "n6",
      headline: "Tim Cook meets Indian PM Modi to discuss expanded manufacturing",
      source: "Financial Times",
      published_at: "2026-02-22T13:10:00Z",
      sentiment: "neutral",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Tim Cook remembers Steve Jobs on his birthday
      url: "https://www.letemsvetemapplem.eu/2026/02/24/steve-jobs-by-dnes-oslavil-71-narozeniny-takto-na-nej-vzpomnel-tim-cook/",
    },
    {
      id: "n7",
      headline: "Apple declares $0.26 quarterly dividend, payable February 13",
      source: "SEC Filing",
      published_at: "2026-01-30T16:00:00Z",
      sentiment: "neutral",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Apple holds more cash than most countries ($144.8B)
      url: "https://www.letemsvetemapplem.eu/2026/02/24/apple-ma-vic-hotovosti-nez-vetsina-statu-sveta-drzi-1448-miliardy-dolaru/",
    },
    {
      id: "n8",
      headline: "Berkshire reduces Apple stake 4.3% in Q4 2025, Buffett cites valuation",
      source: "CNBC",
      published_at: "2026-02-15T19:30:00Z",
      sentiment: "negative",
      related_tickers: ["AAPL", "BRK.B"],
      // Real article from AAPL_p3_news.json — Mac Minis to be made in America (The Register)
      url: "https://www.theregister.com/2026/02/24/apple_mac_mini_us/",
    },
    {
      id: "n9",
      headline: "Apple Intelligence adoption reaches 60% of eligible iPhone users",
      source: "Morgan Stanley",
      published_at: "2026-02-23T10:15:00Z",
      sentiment: "positive",
      related_tickers: ["AAPL"],
      // Real article from AAPL_p3_news.json — Harbor Long-Term Growers ETF Q4 2025 (Apple featured)
      url: "https://seekingalpha.com/article/4874072-harbor-long-term-growers-etf-q4-2025-commentary",
    },
    {
      id: "n10",
      headline: "New tariffs on Chinese goods could raise iPhone manufacturing costs 8–12%",
      source: "Reuters",
      published_at: "2026-02-24T08:00:00Z",
      sentiment: "negative",
      related_tickers: ["AAPL", "MSFT", "NVDA"],
      // Real article from AAPL_p3_news.json — CIA warned Apple/Nvidia of China-Taiwan chip threat
      url: "https://www.digit.in/news/general/us-warned-apple-nvidia-and-others-of-china-taiwan-chip-threat-industry-slow-to-shift-production-report.html",
    },
  ],
  MSFT: [
    {
      id: "m1",
      headline: "Microsoft Azure revenue grows 31% YoY, beats cloud estimates",
      source: "Bloomberg",
      published_at: "2026-01-30T21:00:00Z",
      sentiment: "positive",
      related_tickers: ["MSFT"],
      url: "#",
    },
    {
      id: "m2",
      headline: "Microsoft Copilot enterprise seats reach 10 million, ahead of guidance",
      source: "CNBC",
      published_at: "2026-02-10T14:00:00Z",
      sentiment: "positive",
      related_tickers: ["MSFT"],
      url: "#",
    },
    {
      id: "m3",
      headline: "EU regulators open probe into Microsoft Teams bundling practices",
      source: "Reuters",
      published_at: "2026-02-19T09:30:00Z",
      sentiment: "negative",
      related_tickers: ["MSFT"],
      url: "#",
    },
    {
      id: "m4",
      headline: "Microsoft raises quarterly dividend 10% to $0.83 per share",
      source: "WSJ",
      published_at: "2026-02-20T14:00:00Z",
      sentiment: "positive",
      related_tickers: ["MSFT"],
      url: "#",
    },
    {
      id: "m5",
      headline: "Satya Nadella outlines AI-first strategy at Build 2026 keynote",
      source: "The Verge",
      published_at: "2026-02-22T18:00:00Z",
      sentiment: "positive",
      related_tickers: ["MSFT"],
      url: "#",
    },
  ],
  NVDA: [
    {
      id: "v1",
      headline: "NVIDIA Blackwell GPU shipments accelerate, data center revenue hits record",
      source: "Reuters",
      published_at: "2026-02-21T20:00:00Z",
      sentiment: "positive",
      related_tickers: ["NVDA"],
      url: "#",
    },
    {
      id: "v2",
      headline: "China export restrictions tighten — NVIDIA H20 sales halted pending review",
      source: "WSJ",
      published_at: "2026-02-23T11:30:00Z",
      sentiment: "negative",
      related_tickers: ["NVDA"],
      url: "#",
    },
    {
      id: "v3",
      headline: "Jensen Huang at GTC 2026: 'Physical AI is the next industrial revolution'",
      source: "The Verge",
      published_at: "2026-02-24T10:00:00Z",
      sentiment: "positive",
      related_tickers: ["NVDA"],
      url: "#",
    },
    {
      id: "v4",
      headline: "AMD challenges NVIDIA with MI400 GPU, priced 30% below H200",
      source: "Bloomberg",
      published_at: "2026-02-22T09:00:00Z",
      sentiment: "negative",
      related_tickers: ["NVDA", "AMD"],
      url: "#",
    },
    {
      id: "v5",
      headline: "NVIDIA announces $50B share buyback program at investor day",
      source: "CNBC",
      published_at: "2026-02-20T16:30:00Z",
      sentiment: "positive",
      related_tickers: ["NVDA"],
      url: "#",
    },
  ],
};

export async function fetchNews(ticker: string): Promise<NewsArticle[]> {
  await new Promise((r) => setTimeout(r, 180));
  return MOCK_NEWS[ticker] ?? MOCK_NEWS["AAPL"];
}