/**
 * Intelligence Graph — Phase 9
 * localStorage-only knowledge graph connecting assets, theses, catalysts, risks,
 * regimes, scenarios, and outcomes extracted from Genesis conversations.
 *
 * No server persistence. No hidden profiling. User-visible and clearable.
 * Max 80 nodes / 150 edges — oldest pruned when exceeded.
 * Edges referencing pruned nodes are garbage-collected on each persist.
 */
import type { WatchlistAsset } from "@/lib/watchlistStore";

const KEY = "foresmart.genesis.graph.v1";
const MAX_NODES = 80;
const MAX_EDGES = 150;

export type NodeType =
  | "asset" | "thesis" | "catalyst" | "risk"
  | "regime" | "scenario" | "portfolio_context"
  | "research_report" | "outcome";

export type EdgeType =
  | "relates_to" | "supports" | "contradicts" | "impacted_by"
  | "invalidated_by" | "reinforced_by" | "observed_in" | "affects_portfolio";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;       // ≤40 chars, display name
  content: string;     // full text
  ts: number;
  asset?: string;      // associated ticker symbol
  confidence: number;  // 0-100
  regime?: string;
}

export interface GraphEdge {
  id: string;
  from: string;        // node id
  to: string;          // node id
  type: EdgeType;
  ts: number;
}

interface IntelGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  topAssets: string[];
  activeTheses: number;
  activeRisks: number;
  hasContradictions: boolean;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function read(): IntelGraph {
  if (typeof localStorage === "undefined") return { nodes: [], edges: [] };
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? { nodes: [], edges: [] };
  } catch { return { nodes: [], edges: [] }; }
}

function persist(g: IntelGraph): void {
  if (typeof localStorage === "undefined") return;
  // Prune oldest nodes / edges if over limit
  if (g.nodes.length > MAX_NODES) g.nodes = g.nodes.slice(-MAX_NODES);
  if (g.edges.length > MAX_EDGES) g.edges = g.edges.slice(-MAX_EDGES);
  // GC: drop edges that reference pruned nodes
  const nodeIds = new Set(g.nodes.map((n) => n.id));
  g.edges = g.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch {}
}

// ─── Weights ─────────────────────────────────────────────────────────────────

// Age-decay: fresh nodes score higher
function ageWeight(ts: number): number {
  const ageH = (Date.now() - ts) / 3_600_000;
  if (ageH < 6) return 1.0;
  if (ageH < 24) return 0.8;
  if (ageH < 72) return 0.5;
  if (ageH < 168) return 0.25;
  return 0.1;
}

function nodeScore(n: GraphNode): number {
  return (n.confidence / 100) * ageWeight(n.ts);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const intelligenceGraph = {
  /**
   * Add a node or refresh its timestamp + confidence if an identical one already exists.
   * Returns the node id.
   */
  upsertNode(node: Omit<GraphNode, "id" | "ts">): string {
    const g = read();
    const key = node.label.toLowerCase().trim();
    const idx = g.nodes.findIndex(
      (n) => n.type === node.type && n.label.toLowerCase().trim() === key,
    );
    if (idx >= 0) {
      g.nodes[idx] = {
        ...g.nodes[idx],
        ts: Date.now(),
        confidence: Math.max(g.nodes[idx].confidence, node.confidence),
        content: node.content || g.nodes[idx].content,
        regime: node.regime ?? g.nodes[idx].regime,
        asset: node.asset ?? g.nodes[idx].asset,
      };
      persist(g);
      return g.nodes[idx].id;
    }
    const newNode: GraphNode = { ...node, id: makeId(node.type), ts: Date.now() };
    g.nodes.push(newNode);
    persist(g);
    return newNode.id;
  },

  /** Add an edge (deduplicated on from + to + type). Silently ignores self-edges. */
  addEdge(from: string, to: string, type: EdgeType): void {
    if (!from || !to || from === to) return;
    const g = read();
    if (!g.edges.some((e) => e.from === from && e.to === to && e.type === type)) {
      g.edges.push({ id: makeId("e"), from, to, type, ts: Date.now() });
      persist(g);
    }
  },

  /**
   * Build a compact context string (≤250 chars) surfacing the highest-relevance
   * historical nodes connected to the current question and watchlist.
   * Returns "" when there is nothing meaningful to inject.
   */
  compactContext(question: string, watchlistItems: WatchlistAsset[]): string {
    const g = read();
    if (!g.nodes.length) return "";

    const q = question.toLowerCase();
    const watchSymbols = watchlistItems.map((w) => w.symbol.toUpperCase());

    // Symbols likely relevant to this question
    const relevantSymbols = new Set([
      ...watchSymbols,
      ...["BTC", "ETH", "GOLD", "XAU", "SPX", "OIL", "USD", "GBP", "EUR"]
        .filter((t) => q.includes(t.toLowerCase())),
    ]);

    // Score each node for relevance
    const scored = g.nodes
      .map((n) => {
        let score = nodeScore(n);
        if (n.asset && relevantSymbols.has(n.asset)) score += 0.5;
        if (relevantSymbols.has(n.label.toUpperCase())) score += 0.3;
        if ([...relevantSymbols].some((s) => n.content.toUpperCase().includes(s))) score += 0.2;
        // Extra boost: content or label matches question keywords
        const qWords = q.split(/\s+/).filter((w) => w.length > 4);
        if (qWords.some((w) => n.content.toLowerCase().includes(w))) score += 0.15;
        return { n, score };
      })
      .filter((x) => x.score > 0.15)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return "";

    const parts: string[] = [];

    // Best thesis
    const bestThesis = scored.find((x) => x.n.type === "thesis");
    if (bestThesis) {
      const label = bestThesis.n.label.length > 30
        ? bestThesis.n.label.slice(0, 28) + "…"
        : bestThesis.n.label;
      parts.push(`thesis: ${label}(${bestThesis.n.confidence}%)`);
    }

    // Active risks (top 2, short labels)
    const risks = scored.filter((x) => x.n.type === "risk").slice(0, 2)
      .map((x) => x.n.label.length > 20 ? x.n.label.slice(0, 18) + "…" : x.n.label);
    if (risks.length) parts.push(`risks: ${risks.join(", ")}`);

    // Active catalysts (top 2)
    const catalysts = scored.filter((x) => x.n.type === "catalyst").slice(0, 2)
      .map((x) => x.n.label.length > 20 ? x.n.label.slice(0, 18) + "…" : x.n.label);
    if (catalysts.length) parts.push(`catalysts: ${catalysts.join(", ")}`);

    // First contradiction
    const nodeIdSet = new Set(scored.map((x) => x.n.id));
    const contraEdge = g.edges.find(
      (e) => e.type === "contradicts" && (nodeIdSet.has(e.from) || nodeIdSet.has(e.to)),
    );
    if (contraEdge) {
      const fromN = g.nodes.find((n) => n.id === contraEdge.from);
      const toN = g.nodes.find((n) => n.id === contraEdge.to);
      if (fromN && toN) {
        const cFrom = fromN.label.length > 15 ? fromN.label.slice(0, 13) + "…" : fromN.label;
        const cTo   = toN.label.length > 15   ? toN.label.slice(0, 13)   + "…" : toN.label;
        parts.push(`contradicts: ${cFrom}↔${cTo}`);
      }
    }

    if (!parts.length) return "";
    const result = `Graph: ${parts.join(" | ")}`;
    return result.length <= 250 ? result : result.slice(0, 247) + "…";
  },

  /** Summary for the Memory panel UI. */
  summary(): GraphSummary {
    const g = read();

    // Count how many edges touch each asset node
    const assetConnections = new Map<string, number>();
    for (const edge of g.edges) {
      const fromN = g.nodes.find((n) => n.id === edge.from);
      const toN   = g.nodes.find((n) => n.id === edge.to);
      if (fromN?.type === "asset") assetConnections.set(fromN.label, (assetConnections.get(fromN.label) ?? 0) + 1);
      if (toN?.type   === "asset") assetConnections.set(toN.label,   (assetConnections.get(toN.label)   ?? 0) + 1);
    }

    const topAssets = [...assetConnections.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label]) => label);

    // Fall back to plain asset nodes if no edges yet
    const fallbackAssets = g.nodes
      .filter((n) => n.type === "asset")
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3)
      .map((n) => n.label);

    const STALE_THRESHOLD = 0.2;
    return {
      nodeCount: g.nodes.length,
      edgeCount: g.edges.length,
      topAssets: topAssets.length ? topAssets : fallbackAssets,
      activeTheses: g.nodes.filter((n) => n.type === "thesis" && ageWeight(n.ts) > STALE_THRESHOLD).length,
      activeRisks:  g.nodes.filter((n) => n.type === "risk"   && ageWeight(n.ts) > STALE_THRESHOLD).length,
      hasContradictions: g.edges.some((e) => e.type === "contradicts"),
    };
  },

  clear(): void {
    if (typeof localStorage === "undefined") return;
    try { localStorage.removeItem(KEY); } catch {}
  },
};
