// src/components/layout/Dashboard.tsx

import { useState } from "react";
import { BarChart2, Network } from "lucide-react";
import { clsx } from "clsx";
import NewsFeed       from "../news/NewsFeed";
import ChartPanel     from "../chart/ChartPanel";
import KnowledgeGraph from "../graph/KnowledgeGraph";

type RightView = "chart" | "graph";

export default function Dashboard() {
  const [view, setView] = useState<RightView>("chart");

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: "320px 1fr",
        height: "calc(100vh - 64px - 2rem)",
      }}
    >
      {/* ── LEFT: News feed — full height ── */}
      <div className="min-h-0">
        <NewsFeed />
      </div>

      {/* ── RIGHT: toggle bar + active panel ── */}
      <div className="flex flex-col gap-2 min-h-0">

        {/* Toggle bar */}
        <div className="flex items-center gap-1 shrink-0">
          {(["chart", "graph"] as RightView[]).map((v) => {
            const isActive = view === v;
            const Icon = v === "chart" ? BarChart2 : Network;
            const label = v === "chart" ? "CHART" : "GRAPH";
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={isActive}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1 rounded border text-[11px] font-semibold tracking-wider transition-all duration-150",
                  isActive
                    ? "bg-terminal-accent/15 border-terminal-accent/50 text-terminal-accent"
                    : "border-terminal-border text-terminal-muted hover:border-white/20 hover:text-white/60"
                )}
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Active panel — fills all remaining height */}
        <div className="flex-1 min-h-0">
          {view === "chart" ? <ChartPanel /> : <KnowledgeGraph />}
        </div>

      </div>
    </div>
  );
}