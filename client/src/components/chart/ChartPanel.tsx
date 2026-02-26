// src/components/chart/ChartPanel.tsx
//
// The main stock chart panel. Contains:
//   1. Header — ticker, price, change, 52w range
//   2. Price area chart with crosshair tooltip (Recharts)
//   3. Volume bar chart below price
//   4. Key metrics grid (P/E, market cap, margins, etc.)
//
// Reads selectedTicker + selectedRange from Zustand automatically.
// When user changes ticker in the navbar or clicks a time range button,
// this panel re-fetches and re-renders with no extra wiring needed.
//
// Libraries used:
//   recharts       → https://recharts.org/en-US/guide
//   date-fns       → https://date-fns.org/docs/Getting-Started
//   @tanstack/react-query (via useChartData hook)

import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { clsx } from "clsx";
import { useTerminalStore } from "../../store/terminalStore";
import { usePriceData, useCompanySummary } from "../../hooks/useChartData";
import type { TimeRange } from "../../types";
import { TIME_RANGES } from "../../types";
import type { PriceCandle } from "../../mocks/priceData";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatChange(open: number, close: number) {
  const diff = close - open;
  const pct  = (diff / open) * 100;
  const sign = diff >= 0 ? "+" : "";
  return {
    diff:     `${sign}${diff.toFixed(2)}`,
    pct:      `${sign}${pct.toFixed(2)}%`,
    positive: diff >= 0,
  };
}

function formatVolume(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

// Format the X-axis tick label depending on the time range
function formatXTick(timestamp: number, range: TimeRange): string {
  const d = new Date(timestamp);
  switch (range) {
    case "1D": return format(d, "h:mma");
    case "1W": return format(d, "EEE ha");
    case "1M": return format(d, "MMM d");
    case "3M": return format(d, "MMM d");
    case "1Y": return format(d, "MMM yy");
    case "5Y": return format(d, "MMM yy");
  }
}

// How many X-axis ticks to show — prevents crowding
function tickCount(range: TimeRange): number {
  switch (range) {
    case "1D": return 7;
    case "1W": return 6;
    case "1M": return 6;
    case "3M": return 7;
    case "1Y": return 7;
    case "5Y": return 6;
  }
}

// ─── Custom tooltip shown when hovering over the chart ───────────────────────
interface TooltipPayload {
  payload?: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

function PriceTooltip({ active, payload, range }: {
  active?: boolean;
  payload?: { payload: PriceCandle }[];
  range: TimeRange;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isUp = d.close >= d.open;

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded px-3 py-2 text-xs shadow-2xl">
      <div className="text-terminal-muted mb-1.5">
        {format(new Date(d.timestamp), range === "1D" || range === "1W"
          ? "MMM d, yyyy  h:mm a"
          : "MMM d, yyyy"
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-terminal-muted">Open</span>
        <span className="text-white font-mono">{formatPrice(d.open)}</span>
        <span className="text-terminal-muted">High</span>
        <span className="text-terminal-positive font-mono">{formatPrice(d.high)}</span>
        <span className="text-terminal-muted">Low</span>
        <span className="text-terminal-negative font-mono">{formatPrice(d.low)}</span>
        <span className="text-terminal-muted">Close</span>
        <span className={clsx("font-mono font-semibold", isUp ? "text-terminal-positive" : "text-terminal-negative")}>
          {formatPrice(d.close)}
        </span>
        <span className="text-terminal-muted">Volume</span>
        <span className="text-white font-mono">{formatVolume(d.volume)}</span>
      </div>
    </div>
  );
}

// ─── Metric card used in the bottom grid ─────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-3">
      <div className="text-terminal-muted text-[10px] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={clsx(
          "text-sm font-semibold font-mono",
          positive === true  && "text-terminal-positive",
          positive === false && "text-terminal-negative",
          positive === undefined && "text-white"
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="text-terminal-muted text-[10px] mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChartPanel() {
  const ticker        = useTerminalStore((s) => s.ticker);
  const selectedRange = useTerminalStore((s) => s.selectedRange);
  const setRange      = useTerminalStore((s) => s.setSelectedRange);

  // Hover state: which candle the cursor is on (for live price display)
  const [hoveredCandle, setHoveredCandle] = useState<PriceCandle | null>(null);

  // Data fetching — TanStack Query handles loading/error/cache automatically
  const priceQuery   = usePriceData(ticker, selectedRange);
  const summaryQuery = useCompanySummary(ticker);

  // ── Derived values from the loaded data ──────────────────────────────
  const candles = priceQuery.data?.candles ?? [];
  const first   = candles[0];
  const last    = candles[candles.length - 1];

  // Show hovered candle price in header, or fall back to latest close
  const displayCandle = hoveredCandle ?? last;
  const change = first && last ? formatChange(first.open, displayCandle?.close ?? last.close) : null;

  // Price domain for Y axis — add 2% padding above and below
  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = prices.length ? Math.min(...prices) * 0.98 : 0;
  const maxPrice = prices.length ? Math.max(...prices) * 1.02 : 0;

  // Opening price reference line
  const openPrice = first?.open;

  // Gradient color based on whether stock is up or down
  const isUp = change?.positive ?? true;
  const lineColor   = isUp ? "#4ade80" : "#f87171";
  const gradientId  = isUp ? "priceGradientUp" : "priceGradientDown";
  const gradientEnd = isUp ? "#4ade800a" : "#f871710a";

  // Metrics from P1 summary
  const m = summaryQuery.data?.metrics;
  const d = summaryQuery.data?.derived;

  // ── Loading state ─────────────────────────────────────────────────────
  if (priceQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] text-terminal-muted text-xs">
        <Activity className="w-4 h-4 animate-pulse mr-2" />
        Loading {ticker}...
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (priceQuery.isError || summaryQuery.isError) {
    return (
      <div className="flex items-center justify-center h-[600px] text-terminal-negative text-xs">
        Failed to load data for {ticker}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section
      className="bg-terminal-bg rounded-lg border border-terminal-border overflow-hidden"
      aria-label={`${ticker} stock chart`}
    >

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-terminal-border">
        <div className="flex items-start justify-between">

          {/* Left: price + change */}
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-white text-2xl font-bold font-mono tracking-tight">
                {displayCandle ? formatPrice(displayCandle.close) : (m?.price ? `$${m.price}` : "—")}
              </span>

              {change && (
                <div className={clsx(
                  "flex items-center gap-1 text-sm font-mono",
                  change.positive ? "text-terminal-positive" : "text-terminal-negative"
                )}>
                  {/* Arrow + number — never color alone (WCAG) */}
                  {change.positive
                    ? <TrendingUp className="w-4 h-4" aria-hidden="true" />
                    : <TrendingDown className="w-4 h-4" aria-hidden="true" />
                  }
                  <span>{change.diff}</span>
                  <span className="text-white/40">({change.pct})</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1 text-[11px] text-terminal-muted">
              <span>{summaryQuery.data?.name}</span>
              <span>·</span>
              <span>{summaryQuery.data?.sector}</span>
              {m && (
                <>
                  <span>·</span>
                  <span>52w  <span className="text-terminal-positive">${m.week_52_high}</span>  /  <span className="text-terminal-negative">${m.week_52_low}</span></span>
                </>
              )}
            </div>
          </div>

          {/* Right: time range selector */}
          <div className="flex items-center gap-1" role="group" aria-label="Chart time range">
            {TIME_RANGES.map((range: TimeRange) => (
              <button
                key={range}
                onClick={() => setRange(range)}
                aria-pressed={selectedRange === range}
                className={clsx(
                  "px-2.5 py-1 text-xs rounded border transition-all duration-150",
                  selectedRange === range
                    ? "bg-terminal-accent/15 border-terminal-accent/50 text-terminal-accent"
                    : "border-terminal-border text-terminal-muted hover:border-white/30 hover:text-white/70"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICE CHART ────────────────────────────────────────────── */}
      <div className="px-2 pt-4" aria-label="Price chart" role="img">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={candles}
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            onMouseMove={(e) => {
              if (e.activePayload?.[0]) {
                setHoveredCandle(e.activePayload[0].payload as PriceCandle);
              }
            }}
            onMouseLeave={() => setHoveredCandle(null)}
          >
            <defs>
              {/* Gradient fill under the price line */}
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lineColor} stopOpacity={0.15} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e1e3a"
              vertical={false}
            />

            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts: number) => formatXTick(ts, selectedRange)}
              tickCount={tickCount(selectedRange)}
              tick={{ fill: "#5a5a80", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#1e1e3a" }}
              tickLine={false}
            />

            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              tick={{ fill: "#5a5a80", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={55}
              orientation="right"
            />

            <Tooltip
              content={<PriceTooltip range={selectedRange} />}
              cursor={{ stroke: "#5a5a80", strokeWidth: 1, strokeDasharray: "3 3" }}
            />

            {/* Reference line at opening price */}
            {openPrice && (
              <ReferenceLine
                y={openPrice}
                stroke="#5a5a80"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}

            <Area
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── VOLUME CHART ───────────────────────────────────────────── */}
      <div className="px-2 pb-2" aria-label="Volume chart" role="img">
        <ResponsiveContainer width="100%" height={60}>
          <BarChart
            data={candles}
            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
          >
            <XAxis dataKey="timestamp" hide />
            <YAxis hide />
            <Tooltip
              content={() => null} // volume tooltip handled by price tooltip above
            />
            <Bar
              dataKey="volume"
              radius={[1, 1, 0, 0]}
              // Each bar is green/red based on close vs open
              fill="#475569"
              // Use a Cell approach via recharts for per-bar coloring
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="text-[10px] text-terminal-muted pl-2 -mt-1">VOLUME</div>
      </div>

      {/* ── METRICS GRID ───────────────────────────────────────────── */}
      {m && (
        <div className="px-4 pb-4 pt-1 border-t border-terminal-border mt-2">
          <div className="text-[10px] text-terminal-muted uppercase tracking-widest mb-3 mt-3">
            Key Metrics
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
            <MetricCard
              label="Market Cap"
              value={`$${parseFloat(m.market_cap_b).toFixed(0)}B`}
              sub={parseFloat(m.market_cap_b) >= 1000 ? `$${(parseFloat(m.market_cap_b)/1000).toFixed(2)}T` : undefined}
            />
            <MetricCard
              label="P/E (TTM)"
              value={m.pe_trailing}
              sub={`Fwd ${m.pe_forward}`}
            />
            <MetricCard
              label="EPS (TTM)"
              value={`$${m.eps_ttm}`}
            />
            <MetricCard
              label="Beta"
              value={m.beta}
              sub="vs S&P 500"
              positive={parseFloat(m.beta) <= 1.5}
            />
            <MetricCard
              label="Gross Margin"
              value={`${m.gross_margin_pct}%`}
              positive={parseFloat(m.gross_margin_pct) > 40}
            />
            <MetricCard
              label="Net Margin"
              value={`${m.net_margin_pct}%`}
              positive={parseFloat(m.net_margin_pct) > 15}
            />
            <MetricCard
              label="Rev Growth"
              value={`${parseFloat(m.revenue_growth_pct) >= 0 ? "+" : ""}${m.revenue_growth_pct}%`}
              positive={parseFloat(m.revenue_growth_pct) >= 0}
            />
            <MetricCard
              label="Div Yield"
              value={`${m.dividend_yield_pct}%`}
            />
          </div>

          {/* Revenue trend from derived data */}
          {d && (
            <div className="mt-3">
              <div className="text-[10px] text-terminal-muted uppercase tracking-widest mb-2">
                Annual Revenue  (USD Billions)
              </div>
              <div className="flex items-end gap-3">
                {Object.entries(d.revenue_b).map(([year, rev]) => {
                  if (isNaN(rev)) return null;
                  const maxRev = Math.max(...Object.values(d.revenue_b).filter(v => !isNaN(v)));
                  const heightPct = (rev / maxRev) * 100;
                  const yoy = d.revenue_yoy_pct[year];
                  const yoyPositive = yoy >= 0;

                  return (
                    <div key={year} className="flex flex-col items-center gap-1 flex-1">
                      <div className="text-[9px] text-terminal-muted">
                        {!isNaN(yoy) && (
                          <span className={yoyPositive ? "text-terminal-positive" : "text-terminal-negative"}>
                            {yoyPositive ? "▲" : "▼"}{Math.abs(yoy).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div
                        className="w-full bg-terminal-info/60 rounded-sm min-h-[4px]"
                        style={{ height: `${Math.max(heightPct * 0.6, 4)}px` }}
                        role="presentation"
                        aria-label={`${year}: $${rev}B revenue`}
                      />
                      <div className="text-[9px] text-terminal-muted">{year}</div>
                      <div className="text-[9px] text-white font-mono">${rev.toFixed(0)}B</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </section>
  );
}