// src/components/graph/KnowledgeGraph.tsx
//
// Bottom-right panel. React Flow canvas showing company relationships:
//   Company ↔ Executives, Institutions, Filings, News events, Peers
//
// Reads ticker from Zustand, rebuilds graph on change.
// Filter buttons in header toggle node categories on/off.

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
import type { Node, Edge, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { clsx } from "clsx";
import { useTerminalStore } from "../../store/terminalStore";
import { MOCK_P1 } from "../../mocks/company";
import { Network } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeCategory = "company" | "executive" | "institution" | "filing" | "news" | "peer";

interface NodeData extends Record<string, unknown> {
  category: NodeCategory;
  label: string;
  sub?: string;
  badge?: string;
}

// ─── Per-category color + icon ────────────────────────────────────────────────

const CAT_COLOR: Record<NodeCategory, string> = {
  company:     "#a78bfa",  // light purple — replaces sky blue
  executive:   "#9333ea",  // deep purple
  institution: "#c084fc",  // lighter purple — replaces cyan
  filing:      "#c026d3",  // fuchsia — matches login accent
  news:        "#4ade80",  // green — semantic (kept)
  peer:        "#5a5a80",  // muted purple-gray
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
        }}
        className="bg-terminal-surface border border-terminal-border border-l-2 rounded px-3 py-2 min-w-[130px] max-w-[190px] font-mono"
      >
        {/* Category label */}
        <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-terminal-border">
          <span className="text-[10px]" aria-hidden="true">{CAT_ICON[d.category]}</span>
          <span className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color }}>
            {d.category}
          </span>
        </div>
        {/* Main label */}
        <div className="text-white text-[11px] font-semibold leading-snug">
          {d.label}
        </div>
        {/* Sub-label */}
        {d.sub && (
          <div className="text-terminal-muted text-[9px] mt-0.5 leading-snug">
            {d.sub}
          </div>
        )}
        {/* Badge */}
        {d.badge && (
          <div
            className="mt-1.5 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border"
            style={{ color, background: `${color}18`, borderColor: `${color}44` }}
          >
            {d.badge}
          </div>
        )}
      </div>
      <Handle
        type="source" position={Position.Bottom}
        style={{ background: color, width: 5, height: 5, border: "none" }}
      />
    </>
  );
}

const NODE_TYPES = { graphNode: GraphNode };

// ─── Build nodes + edges from ticker ─────────────────────────────────────────

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

  // Company (center)
  nodes.push({
    id: `co-${ticker}`, type: "graphNode",
    position: { x: 300, y: 180 },
    data: {
      category: "company", label: ticker,
      sub: p1.name,
      badge: `$${parseFloat(p1.metrics.market_cap_b).toFixed(0)}B mkt cap`,
    } as NodeData,
  });

  // Executives (left side)
  [
    { id: "ceo", name: "Timothy D. Cook",  title: "CEO",  pay: "$16.8M", y: 40  },
    { id: "cfo", name: "Kevan Parekh",     title: "CFO",  pay: "$4.0M",  y: 170 },
    { id: "coo", name: "Sabih Khan",       title: "COO",  pay: "$5.0M",  y: 300 },
  ].forEach(({ id, name, title, pay, y }) => {
    const nid = `exec-${id}`;
    nodes.push({ id: nid, type: "graphNode", position: { x: 40, y },
      data: { category: "executive", label: name, sub: title, badge: pay } as NodeData });
    edges.push(edge(`e-${nid}`, nid, `co-${ticker}`, "leads", CAT_COLOR.executive));
  });

  // Institutions (right side)
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

  // Filings (below center)
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

  // News (bottom corners)
  nodes.push({ id: "news-pos", type: "graphNode", position: { x: 30, y: 370 },
    data: { category: "news", label: "Q1 Beat", sub: "Reuters · Jan 29", badge: "POS ▲" } as NodeData });
  edges.push(edge("e-news-pos", "news-pos", `co-${ticker}`, "impacts", CAT_COLOR.news));

  nodes.push({ id: "news-neg", type: "graphNode", position: { x: 570, y: 370 },
    data: { category: "news", label: "Tariff Risk", sub: "Reuters · Feb 24", badge: "NEG ▼" } as NodeData });
  edges.push(edge("e-news-neg", "news-neg", `co-${ticker}`, "impacts", "#f87171"));

  // Peers (top)
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

  const { nodes: initNodes, edges: initEdges } = useMemo(() => buildGraph(ticker), [ticker]);
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  const [hidden, setHidden] = useState<Set<NodeCategory>>(new Set());

  const toggle = useCallback((cat: NodeCategory) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

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

        {/* Category filter toggles */}
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
                style={on ? {
                  color,
                  borderColor: `${color}55`,
                  backgroundColor: `${color}12`,
                } : undefined}
              >
                {CAT_ICON[cat]} {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flow canvas */}
      <div className="flex-1" role="img" aria-label={`Relationship graph for ${ticker}`}>
        <ReactFlow
          key={ticker}
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
      </div>
    </section>
  );
}