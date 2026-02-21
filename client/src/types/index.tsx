// types/index.ts
interface StockCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface GraphNode {
  id: string;
  label: string;
  type: 'company' | 'executive' | 'patent' | 'subsidiary';
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}