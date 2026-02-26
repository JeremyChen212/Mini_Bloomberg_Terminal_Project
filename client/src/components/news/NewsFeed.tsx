// src/components/news/NewsFeed.tsx
//
// Left panel — full height news feed for the selected ticker.
// Filter tabs: All / Positive / Negative / Neutral
// Scrollable article list with sentiment badges and relative timestamps.

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Newspaper, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { useTerminalStore } from "../../store/terminalStore";
import { useNews } from "../../hooks/useNews";
import type { Sentiment } from "../../types";

// ─── Sentiment config ─────────────────────────────────────────────────────────

const SENTIMENT = {
  positive: {
    label: "POS",
    textColor: "text-terminal-positive",
    borderColor: "border-terminal-positive/40",
    bgColor: "bg-terminal-positive/10",
    dotColor: "bg-terminal-positive",
    leftBorder: "border-l-terminal-positive",
    Icon: TrendingUp,
  },
  negative: {
    label: "NEG",
    textColor: "text-terminal-negative",
    borderColor: "border-terminal-negative/40",
    bgColor: "bg-terminal-negative/10",
    dotColor: "bg-terminal-negative",
    leftBorder: "border-l-terminal-negative",
    Icon: TrendingDown,
  },
  neutral: {
    label: "NEU",
    textColor: "text-terminal-muted",
    borderColor: "border-white/15",
    bgColor: "bg-white/5",
    dotColor: "bg-terminal-muted",
    leftBorder: "border-l-terminal-muted",
    Icon: Minus,
  },
} satisfies Record<Sentiment, {
  label: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  dotColor: string;
  leftBorder: string;
  Icon: React.ElementType;
}>;

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: {
  article: { id: string; headline: string; source: string; published_at: string; sentiment: Sentiment; url: string }
}) {
  const s = SENTIMENT[article.sentiment];
  const { Icon } = s;
  const timeAgo = formatDistanceToNow(new Date(article.published_at), { addSuffix: true });

  return (
    <article className={clsx(
      "group relative pl-3 pr-3 py-3",
      "border-l-2 rounded-r",
      "hover:bg-white/[0.03] transition-colors duration-150",
      // Left border color by sentiment
      article.sentiment === "positive" && "border-l-terminal-positive",
      article.sentiment === "negative" && "border-l-terminal-negative",
      article.sentiment === "neutral"  && "border-l-terminal-border",
    )}>
      {/* Headline — clicking opens article in a new tab */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-white/80 text-[11px] leading-[1.55] mb-2 group-hover:text-white hover:text-terminal-accent transition-colors cursor-pointer"
      >
        {article.headline}
      </a>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Sentiment badge — icon + text (never color alone for WCAG) */}
          <span className={clsx(
            "inline-flex items-center gap-1 text-[9px] font-bold tracking-wider",
            "border rounded-sm px-1.5 py-0.5",
            s.textColor, s.borderColor, s.bgColor
          )}>
            <Icon className="w-2.5 h-2.5" aria-hidden="true" />
            {s.label}
          </span>
          <span className="text-terminal-muted text-[10px]">{article.source}</span>
        </div>

        <div className="flex items-center gap-2">
          <time className="text-terminal-muted text-[10px]" dateTime={article.published_at}>
            {timeAgo}
          </time>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open article"
            className="opacity-0 group-hover:opacity-100 text-terminal-muted hover:text-terminal-info transition-all"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="pl-3 py-3 border-l-2 border-terminal-border animate-pulse space-y-2">
      <div className="h-2.5 bg-white/8 rounded w-full" />
      <div className="h-2.5 bg-white/8 rounded w-4/5" />
      <div className="h-2.5 bg-white/8 rounded w-1/2" />
      <div className="flex gap-2 pt-1">
        <div className="h-4 w-9 bg-white/8 rounded" />
        <div className="h-4 w-14 bg-white/8 rounded" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FilterTab = "all" | Sentiment;

export default function NewsFeed() {
  const ticker = useTerminalStore((s) => s.ticker);
  const { data: articles, isLoading, isError } = useNews(ticker);
  const [tab, setTab] = useState<FilterTab>("all");

  const filtered = articles?.filter((a) => tab === "all" || a.sentiment === tab) ?? [];

  const counts = {
    all:      articles?.length ?? 0,
    positive: articles?.filter((a) => a.sentiment === "positive").length ?? 0,
    negative: articles?.filter((a) => a.sentiment === "negative").length ?? 0,
    neutral:  articles?.filter((a) => a.sentiment === "neutral").length  ?? 0,
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all",      label: "All"  },
    { id: "positive", label: "Pos"  },
    { id: "negative", label: "Neg"  },
    { id: "neutral",  label: "Neu"  },
  ];

  const tabActive = "bg-terminal-accent/15 border-terminal-accent/50 text-terminal-accent";
  const tabIdle   = "border-terminal-border text-terminal-muted hover:border-white/20 hover:text-white/60";

  return (
    <section
      className="flex flex-col h-full bg-terminal-bg border border-terminal-border rounded-lg overflow-hidden"
      aria-label={`${ticker} news feed`}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-terminal-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="w-3.5 h-3.5 text-terminal-accent" aria-hidden="true" />
            <span className="text-white text-xs font-semibold tracking-widest">NEWS</span>
          </div>
          <span className="text-terminal-muted text-[10px] font-mono">{ticker}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1" role="tablist">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border transition-all duration-150",
                tab === id ? tabActive : tabIdle
              )}
            >
              {label}
              <span className={clsx(
                "rounded px-1 py-px text-[9px] font-mono",
                tab === id ? "bg-terminal-accent/20 text-terminal-accent" : "bg-white/5 text-terminal-muted"
              )}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable feed */}
      <div
        className="flex-1 overflow-y-auto py-1 divide-y divide-terminal-border/50"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#1e293b transparent" }}
        role="feed"
        aria-busy={isLoading}
      >
        {isLoading && Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-3 py-1"><Skeleton /></div>
        ))}

        {isError && (
          <div className="flex items-center justify-center h-40 text-terminal-negative text-xs">
            Failed to load news
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex items-center justify-center h-40 text-terminal-muted text-xs">
            No articles
          </div>
        )}

        {!isLoading && !isError && filtered.map((a) => (
          <div key={a.id} className="px-3">
            <ArticleCard article={a} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2 border-t border-terminal-border">
        <p className="text-terminal-muted text-[10px]" aria-live="polite">
          {isLoading ? "Loading..." : `${filtered.length} articles · auto-refreshes every 2 min`}
        </p>
      </div>
    </section>
  );
}