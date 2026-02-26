// src/components/graph/KnowledgeGraph.tsx
//
// Knowledge graph with clickable nodes.
// Clicking a node opens a detail popup showing real data from
// AAPL_p4_exec_ownership.json / AAPL_p1_summary.json plus linked
// news articles from the live news feed.

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import type { Node, Edge, NodeProps, NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { clsx } from "clsx";
import { X, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { useTerminalStore } from "../../store/terminalStore";
import { MOCK_P1 } from "../../mocks/company";
import { useNews } from "../../hooks/useNews";
import { Network } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeCategory = "company" | "executive" | "institution" | "filing" | "news" | "peer";

interface NodeData extends Record<string, unknown> {
  category: NodeCategory;
  label: string;
  sub?: string;
  badge?: string;
}

// ─── Real data from AAPL_p4_exec_ownership.json ───────────────────────────────

const EXEC_DETAIL: Record<string, {
  fullName: string; title: string; yearBorn: number | null; pay: number | null;
  bio: string;
}> = {
  "Timothy D. Cook": {
    fullName: "Mr. Timothy D. Cook",
    title: "CEO & Director",
    yearBorn: 1961,
    pay: 16759518,
    bio: "Tim Cook has served as Apple's CEO since 2011, succeeding Steve Jobs. Under his leadership Apple crossed $3T market cap and expanded services revenue to over 25% of total revenue.",
  },
  "Kevan Parekh": {
    fullName: "Mr. Kevan Parekh",
    title: "Senior VP & CFO",
    yearBorn: 1972,
    pay: 4034174,
    bio: "Kevan Parekh became CFO in January 2025, succeeding Luca Maestri. He previously served as VP of Financial Planning & Analysis and has deep expertise in Apple's financial operations.",
  },
  "Sabih Khan": {
    fullName: "Mr. Sabih Khan",
    title: "Senior VP & Chief Operating Officer",
    yearBorn: 1967,
    pay: 5021905,
    bio: "Sabih Khan oversees Apple's global supply chain and manufacturing operations. He has been instrumental in diversifying production across India, Vietnam, and other markets.",
  },
};

const INST_DETAIL: Record<string, {
  fullName: string; pctHeld: number; shares: number; value: number; pctChange: number;
}> = {
  "Vanguard": {
    fullName: "Vanguard Group Inc",
    pctHeld: 0.0972,
    shares: 1426283914,
    value: 388148925248,
    pctChange: 0.0192,
  },
  "BlackRock": {
    fullName: "Blackrock Inc.",
    pctHeld: 0.0786,
    shares: 1154665731,
    value: 314230748948,
    pctChange: 0.0073,
  },
  "Berkshire": {
    fullName: "Berkshire Hathaway, Inc",
    pctHeld: 0.0155,
    shares: 227917808,
    value: 62025555607,
    pctChange: -0.0432,
  },
};

// Keywords used to surface related news articles for each node
const NODE_NEWS_KEYWORDS: Record<string, string[]> = {
  "co-AAPL":       ["apple", "aapl"],
  "exec-ceo":      ["tim cook", "cook", "ceo"],
  "exec-cfo":      ["parekh", "cfo", "financial"],
  "exec-coo":      ["khan", "coo", "supply chain", "manufacturing"],
  "inst-vanguard": ["vanguard", "institutional"],
  "inst-blackrock":["blackrock", "institutional"],
  "inst-berkshire":["berkshire", "buffett", "stake"],
  "news-pos":      ["earnings", "beat", "ai", "intelligence", "growth"],
  "news-neg":      ["tariff", "doj", "antitrust", "investigation"],
};

// ─── Per-category color + icon ────────────────────────────────────────────────

const CAT_COLOR: Record<NodeCategory, string> = {
  company:     "#a78bfa",
  executive:   "#9333ea",
  institution: "#c084fc",
  filing:      "#c026d3",
  news:        "#4ade80",
  peer:        "#5a5a80",
};

const CAT_ICON: Record<NodeCategory, string> = {
  company:     "🏢",
  executive:   "👤",
  institution: "🏦",
  filing:      "📄",
  news:        "📰",
  peer:        "◈",
};

// ─── Custom node component ────────────────────────────────────────────────────

function GraphNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const color = CAT_COLOR[d.category];

  return (
    <>
      <Handle
        type="target" position={Position.Top}
        style={{ background: color, width: 5, height: 5, border: "none" }}
      />
      <div
        style={{
          borderLeftColor: color,
          boxShadow: selected ? `0 0 12px ${color}55` : "0 2px 10px #00000066",
          cursor: "pointer",
        }}
        className="bg-terminal-surface border border-terminal-border border-l-2 rounded px-3 py-2 min-w-[130px] max-w-[190px] font-mono"
      >
        <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-terminal-border">
          <span className="text-[10px]" aria-hidden="true">{CAT_ICON[d.category]}</span>
          <span className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color }}>
            {d.category}
          </span>
        </div>
        <div className="text-white text-[11px] font-semibold leading-snug">{d.label}</div>
        {d.sub && (
          <div className="text-terminal-muted text-[9px] mt-0.5 leading-snug">{d.sub}</div>
        )}
        {d.badge && (
          <div
            className="mt-1.5 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border"
            style={{ color, background: `${color}18`, borderColor: `${color}44` }}
          >
            {d.badge}
          </div>
        )}
        {/* Click hint */}
        <div className="text-[8px] text-terminal-muted/60 mt-1.5 italic">click for details</div>
      </div>
      <Handle
        type="source" position={Position.Bottom}
        style={{ background: color, width: 5, height: 5, border: "none" }}
      />
    </>
  );
}

const NODE_TYPES = { graphNode: GraphNode };

// ─── Node detail popup ────────────────────────────────────────────────────────

function formatPay(pay: number | null): string {
  if (!pay) return "N/A";
  return `$${(pay / 1_000_000).toFixed(1)}M`;
}

function formatShares(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
}

function formatValue(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

interface RelatedArticle {
  id: string;
  headline: string;
  url: string;
  sentiment: "positive" | "negative" | "neutral";
  source: string;
}

interface PopupProps {
  nodeId: string;
  data: NodeData;
  relatedArticles: RelatedArticle[];
  onClose: () => void;
}

function NodeDetailPopup({ nodeId, data, relatedArticles, onClose }: PopupProps) {
  const color = CAT_COLOR[data.category];

  return (
    <div
      className="absolute top-3 right-3 z-50 w-72 rounded-lg border shadow-2xl overflow-hidden"
      style={{
        background: "#0f0f1e",
        borderColor: `${color}55`,
        boxShadow: `0 0 24px ${color}22`,
      }}
      role="dialog"
      aria-label={`Details for ${data.label}`}
    >
      {/* Popup header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: `${color}33`, background: `${color}10` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{CAT_ICON[data.category]}</span>
          <div>
            <div className="text-white text-[11px] font-bold font-mono">{data.label}</div>
            {data.sub && (
              <div className="text-[9px] font-mono" style={{ color }}>{data.sub}</div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-terminal-muted hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popup body */}
      <div
        className="overflow-y-auto px-3 py-2 space-y-3 text-[11px] font-mono"
        style={{ maxHeight: "340px", scrollbarWidth: "thin", scrollbarColor: "#1e1e3a transparent" }}
      >
        {/* ── EXECUTIVE ── */}
        {data.category === "executive" && (() => {
          const exec = EXEC_DETAIL[data.label];
          if (!exec) return null;
          return (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-terminal-muted">Title</span>
                <span className="text-white">{exec.title}</span>
                <span className="text-terminal-muted">Born</span>
                <span className="text-white">{exec.yearBorn ?? "—"}</span>
                <span className="text-terminal-muted">Total Pay</span>
                <span className="text-terminal-positive font-bold">{formatPay(exec.pay)}</span>
              </div>
              <p className="text-white/60 text-[10px] leading-relaxed border-t border-terminal-border pt-2">
                {exec.bio}
              </p>
            </div>
          );
        })()}

        {/* ── INSTITUTION ── */}
        {data.category === "institution" && (() => {
          const inst = INST_DETAIL[data.label];
          if (!inst) return null;
          const up = inst.pctChange >= 0;
          return (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-terminal-muted">Full Name</span>
              <span className="text-white text-[10px]">{inst.fullName}</span>
              <span className="text-terminal-muted">% Held</span>
              <span className="text-white">{(inst.pctHeld * 100).toFixed(2)}%</span>
              <span className="text-terminal-muted">Shares</span>
              <span className="text-white">{formatShares(inst.shares)}</span>
              <span className="text-terminal-muted">Value</span>
              <span className="text-white">{formatValue(inst.value)}</span>
              <span className="text-terminal-muted">Qtr Change</span>
              <span className={up ? "text-terminal-positive" : "text-terminal-negative"}>
                {up ? "▲" : "▼"} {Math.abs(inst.pctChange * 100).toFixed(2)}%
              </span>
            </div>
          );
        })()}

        {/* ── COMPANY ── */}
        {data.category === "company" && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-terminal-muted">Sector</span>
            <span className="text-white">Technology</span>
            <span className="text-terminal-muted">Industry</span>
            <span className="text-white">Consumer Electronics</span>
            <span className="text-terminal-muted">Employees</span>
            <span className="text-white">150,000</span>
            <span className="text-terminal-muted">Market Cap</span>
            <span className="text-terminal-positive">~$4.0T</span>
            <span className="text-terminal-muted">Website</span>
            <a
              href="https://www.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-terminal-accent hover:underline flex items-center gap-1"
            >
              apple.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}

        {/* ── FILING ── */}
        {data.category === "filing" && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-terminal-muted">Type</span>
              <span className="text-white">{data.label}</span>
              <span className="text-terminal-muted">Date</span>
              <span className="text-white">{data.sub ?? "—"}</span>
            </div>
            <p className="text-white/50 text-[10px] pt-2 border-t border-terminal-border">
              {data.label === "10-K 2025"
                ? "Annual report covering Apple's full fiscal year 2025 financials, risk factors, and business overview."
                : data.label === "10-Q Q1"
                ? "Quarterly report for Q1 FY2026, showing record revenue of $124.3B and EPS of $2.40."
                : "Current report (8-K) filed with the SEC disclosing a material corporate event."}
            </p>
          </div>
        )}

        {/* ── NEWS NODE ── */}
        {data.category === "news" && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-terminal-muted">Sentiment</span>
              <span className={data.badge?.includes("POS") ? "text-terminal-positive" : "text-terminal-negative"}>
                {data.badge}
              </span>
              <span className="text-terminal-muted">Source</span>
              <span className="text-white">{data.sub?.split(" · ")[0] ?? "—"}</span>
              <span className="text-terminal-muted">Date</span>
              <span className="text-white">{data.sub?.split(" · ")[1] ?? "—"}</span>
            </div>
          </div>
        )}

        {/* ── PEER ── */}
        {data.category === "peer" && (
          <div className="text-white/60 text-[10px]">
            {data.label === "MSFT"
              ? "Microsoft Corp — Primary competitor in cloud, AI, and enterprise software. Azure vs. Apple iCloud."
              : data.label === "GOOGL"
              ? "Alphabet Inc — Competes in mobile OS (Android vs. iOS), AI assistants, and digital advertising."
              : data.label === "AAPL"
              ? "Apple Inc — Competes in hardware, software, and services. iPhone vs. Surface, macOS vs. Windows."
              : `${data.label} — ${data.sub}`}
          </div>
        )}

        {/* ── RELATED NEWS ARTICLES ── */}
        {relatedArticles.length > 0 && (
          <div className="border-t border-terminal-border pt-2 space-y-1.5">
            <div className="text-[9px] text-terminal-muted uppercase tracking-widest mb-1">
              Related News
            </div>
            {relatedArticles.slice(0, 3).map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-start gap-1.5 rounded px-1.5 py-1 hover:bg-white/5 transition-colors">
                  {a.sentiment === "positive"
                    ? <TrendingUp className="w-2.5 h-2.5 text-terminal-positive mt-0.5 shrink-0" />
                    : a.sentiment === "negative"
                    ? <TrendingDown className="w-2.5 h-2.5 text-terminal-negative mt-0.5 shrink-0" />
                    : <span className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                  }
                  <div className="min-w-0">
                    <div className="text-white/70 text-[10px] leading-snug group-hover:text-terminal-accent transition-colors line-clamp-2">
                      {a.headline}
                    </div>
                    <div className="text-terminal-muted text-[9px] mt-0.5 flex items-center gap-1">
                      {a.source}
                      <ExternalLink className="w-2 h-2" />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Build nodes + edges ──────────────────────────────────────────────────────

function buildGraph(ticker: string): { nodes: Node[]; edges: Edge[] } {
  const p1 = MOCK_P1[ticker] ?? MOCK_P1["AAPL"];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const edge = (
    id: string, source: string, target: string,
    label: string, color: string, dashed = false
  ): Edge => ({
    id, source, target, label,
    type: "smoothstep",
    animated: !dashed,
    style: { stroke: color, strokeWidth: 1, ...(dashed ? { strokeDasharray: "4 3" } : {}) },
    labelStyle: { fill: "#5a5a80", fontSize: 8 },
    labelBgStyle: { fill: "#080810", fillOpacity: 0.8 },
    labelBgPadding: [3, 2] as [number, number],
  });

  nodes.push({
    id: `co-${ticker}`, type: "graphNode",
    position: { x: 300, y: 180 },
    data: {
      category: "company", label: ticker,
      sub: p1.name,
      badge: `$${parseFloat(p1.metrics.market_cap_b).toFixed(0)}B mkt cap`,
    } as NodeData,
  });

  [
    { id: "ceo", name: "Timothy D. Cook", title: "CEO",  pay: "$16.8M", y: 40  },
    { id: "cfo", name: "Kevan Parekh",    title: "CFO",  pay: "$4.0M",  y: 170 },
    { id: "coo", name: "Sabih Khan",      title: "COO",  pay: "$5.0M",  y: 300 },
  ].forEach(({ id, name, title, pay, y }) => {
    const nid = `exec-${id}`;
    nodes.push({ id: nid, type: "graphNode", position: { x: 40, y },
      data: { category: "executive", label: name, sub: title, badge: pay } as NodeData });
    edges.push(edge(`e-${nid}`, nid, `co-${ticker}`, "leads", CAT_COLOR.executive));
  });

  [
    { id: "vanguard",  name: "Vanguard",  pct: "9.72%", y: 40  },
    { id: "blackrock", name: "BlackRock", pct: "7.86%", y: 170 },
    { id: "berkshire", name: "Berkshire", pct: "1.55%", y: 300 },
  ].forEach(({ id, name, pct, y }) => {
    const nid = `inst-${id}`;
    nodes.push({ id: nid, type: "graphNode", position: { x: 570, y },
      data: { category: "institution", label: name, badge: pct } as NodeData });
    edges.push(edge(`e-${nid}`, nid, `co-${ticker}`, pct, CAT_COLOR.institution));
  });

  [
    { id: "10k", label: "10-K 2025", date: "Oct 2025", x: 140 },
    { id: "10q", label: "10-Q Q1",   date: "Jan 2026", x: 300 },
    { id: "8k",  label: "8-K",       date: "Jan 2026", x: 460 },
  ].forEach(({ id, label, date, x }) => {
    const nid = `filing-${id}`;
    nodes.push({ id: nid, type: "graphNode", position: { x, y: 360 },
      data: { category: "filing", label, sub: date } as NodeData });
    edges.push(edge(`e-${nid}`, `co-${ticker}`, nid, "filed", CAT_COLOR.filing));
  });

  nodes.push({ id: "news-pos", type: "graphNode", position: { x: 30, y: 370 },
    data: { category: "news", label: "Q1 Beat", sub: "Reuters · Jan 29", badge: "POS ▲" } as NodeData });
  edges.push(edge("e-news-pos", "news-pos", `co-${ticker}`, "impacts", CAT_COLOR.news));

  nodes.push({ id: "news-neg", type: "graphNode", position: { x: 570, y: 370 },
    data: { category: "news", label: "Tariff Risk", sub: "Reuters · Feb 24", badge: "NEG ▼" } as NodeData });
  edges.push(edge("e-news-neg", "news-neg", `co-${ticker}`, "impacts", "#f87171"));

  const peers = ticker === "AAPL"
    ? [{ id: "MSFT", name: "Microsoft", x: 170 }, { id: "GOOGL", name: "Alphabet", x: 430 }]
    : [{ id: "AAPL", name: "Apple",     x: 170 }, { id: "MSFT",  name: "Microsoft", x: 430 }];

  peers.forEach(({ id, name, x }) => {
    const nid = `peer-${id}`;
    nodes.push({ id: nid, type: "graphNode", position: { x, y: -30 },
      data: { category: "peer", label: id, sub: name } as NodeData });
    edges.push(edge(`e-${nid}`, `co-${ticker}`, nid, "competes", CAT_COLOR.peer, true));
  });

  return { nodes, edges };
}

// ─── Main component ───────────────────────────────────────────────────────────

const ALL_CATS: NodeCategory[] = ["company", "executive", "institution", "filing", "news", "peer"];

export default function KnowledgeGraph() {
  const ticker = useTerminalStore((s) => s.ticker);
  const { data: newsArticles } = useNews(ticker);

  const { nodes: initNodes, edges: initEdges } = useMemo(() => buildGraph(ticker), [ticker]);
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  const [hidden, setHidden] = useState<Set<NodeCategory>>(new Set());
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: NodeData } | null>(null);

  const toggle = useCallback((cat: NodeCategory) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const d = node.data as NodeData;
    setSelectedNode((prev) =>
      prev?.id === node.id ? null : { id: node.id, data: d }
    );
  }, []);

  // Find news articles related to the selected node
  const relatedArticles = useMemo(() => {
    if (!selectedNode || !newsArticles) return [];
    const keywords = NODE_NEWS_KEYWORDS[selectedNode.id] ?? [];
    if (keywords.length === 0) return newsArticles.slice(0, 3);
    return newsArticles.filter((a) =>
      keywords.some((kw) => a.headline.toLowerCase().includes(kw))
    );
  }, [selectedNode, newsArticles]);

  const visibleNodes = nodes.filter((n) => !hidden.has((n.data as NodeData).category));
  const visibleIds   = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  return (
    <section
      className="flex flex-col h-full bg-terminal-bg border border-terminal-border rounded-lg overflow-hidden"
      aria-label={`${ticker} knowledge graph`}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-terminal-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-3.5 h-3.5 text-terminal-info" aria-hidden="true" />
            <span className="text-white text-xs font-semibold tracking-widest">KNOWLEDGE GRAPH</span>
          </div>
          <span className="text-terminal-muted text-[10px] font-mono">{ticker}</span>
        </div>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Toggle node types">
          {ALL_CATS.map((cat) => {
            const on = !hidden.has(cat);
            const color = CAT_COLOR[cat];
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                aria-pressed={on}
                className={clsx(
                  "text-[9px] px-2 py-0.5 rounded border capitalize transition-all duration-150",
                  !on && "opacity-35 border-terminal-border text-terminal-muted"
                )}
                style={on ? { color, borderColor: `${color}55`, backgroundColor: `${color}12` } : undefined}
              >
                {CAT_ICON[cat]} {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flow canvas — relative so popup can be absolutely positioned inside */}
      <div className="flex-1 relative" role="img" aria-label={`Relationship graph for ${ticker}`}>
        <ReactFlow
          key={ticker}
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.25}
          maxZoom={2}
          style={{ background: "#080810" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#1e1e3a" />
          <Controls style={{ background: "#0f0f1e", border: "1px solid #1e1e3a", borderRadius: 6 }} />
          <MiniMap
            style={{ background: "#0a0a18", border: "1px solid #1e1e3a" }}
            nodeColor={(n) => CAT_COLOR[(n.data as NodeData).category] ?? "#5a5a80"}
            maskColor="#08081088"
          />
        </ReactFlow>

        {/* Node detail popup — overlays inside the canvas */}
        {selectedNode && (
          <NodeDetailPopup
            nodeId={selectedNode.id}
            data={selectedNode.data}
            relatedArticles={relatedArticles}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </section>
  );
}
