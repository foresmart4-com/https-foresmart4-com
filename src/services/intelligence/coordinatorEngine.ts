/**
 * Intelligence Coordination Layer — Phase 11
 * Orchestrates all Genesis reasoning layers: routes, prioritizes, arbitrates conflicts,
 * and coordinates context budget allocation across all intelligence subsystems.
 *
 * Design rules:
 * - Pure function — no network calls, no side effects, no AI calls, no localStorage
 * - Never replaces existing layers — only re-weights and coordinates them
 * - Falls back gracefully to static weights if it throws
 * - Produces a compact coordination note (≤150 chars) for AI context injection
 * - Stays within the 2800-char AI budget via the existing pruneContext utility
 */
import type { MetaReasoningResult } from "@/services/reasoning/metaReasoning";
import type { MarketIntelSummary } from "@/services/market/marketIntelEngine";
import type { PortfolioIntelSummary } from "@/services/portfolio/portfolioIntelEngine";

export type PrioritySignal =
  | "safety"
  | "contradiction"
  | "confidence_warning"
  | "thesis"
  | "portfolio"
  | "regime"
  | "standard";

export interface ConflictDetail {
  type: "thesis_regime" | "scenario_regime" | "agent_disagreement" | "stale_memory" | "graph_contradiction";
  description: string;
  severity: "high" | "medium" | "low";
}

export interface CoordinationLayer {
  key: string;
  content: string;
  weight: number;
}

export interface CoordinationResult {
  layers: CoordinationLayer[];
  prioritySignal: PrioritySignal;
  conflicts: ConflictDetail[];
  coordinationNote: string;
  routingDecision: Record<string, "boosted" | "suppressed" | "standard">;
}

export interface CoordinatorInputLayers {
  mem: string;         // memory agent context
  decision: string;    // decision calibration context
  research: string;    // research terminal hint
  watchlist: string;   // watchlist context
  thesis: string;      // thesis memory context
  session: string;     // session intelligence context
  portfolio: string;   // portfolio brain context
  bus: string;         // cross-surface session bus
  signal: string;      // signal history context
  marketIntel: string; // market intelligence context
  scenario: string;    // scenario simulation context
  graph: string;       // intelligence graph recall
  meta: string;        // meta-reasoning hint
  top3: string;        // top 3 movers
  bot3: string;        // worst 3 movers
  market: string;      // raw market price context
}

// ─── Base Weights (mirrors static pruneContext weights from genesis.tsx) ──────

const BASE_WEIGHTS: Record<string, number> = {
  coord:       0.93, // coordination note — always near-top when present
  mem:         0.95,
  decision:    0.90,
  research:    0.88,
  watchlist:   0.85,
  thesis:      0.85,
  session:     0.80,
  portfolio:   0.78,
  bus:         0.75,
  signal:      0.65,
  marketIntel: 0.62,
  scenario:    0.58,
  graph:       0.56,
  meta:        0.53,
  top3:        0.50,
  bot3:        0.50,
  market:      0.40,
};

// ─── Intent Detection ─────────────────────────────────────────────────────────

interface QueryIntent {
  isResearch:  boolean;
  isPortfolio: boolean;
  isScenario:  boolean;
  isThesis:    boolean;
  isRegime:    boolean;
  isAsset:     boolean;
  isSafety:    boolean;
}

const ASSET_TICKERS = /\b(BTC|ETH|GOLD|XAU|SPX|SPY|QQQ|OIL|WTI|USD|EUR|GBP|JPY|ARAMCO|2222|SABIC|AAPL|TSLA|NVDA|MSFT|AMZN|META)\b/i;

function detectIntent(q: string): QueryIntent {
  const l = q.toLowerCase();
  return {
    isResearch:  /analyze|analyse|research|deep.?dive|report|study|investigate|حلل|تحليل|بحث|تقرير/.test(l),
    isPortfolio: /portfolio|watchlist|my assets|my holdings|exposure|allocation|محفظة|قائمة المراقبة|تعرض/.test(l),
    isScenario:  /if |what if|scenario|impact of|suppose|assuming|ماذا لو|سيناريو|إذا /.test(l),
    isThesis:    /thesis|my view|my position|conviction|my case|أطروحة|موقفي|قناعة/.test(l),
    isRegime:    /regime|market structure|bull|bear|risk.?on|risk.?off|نظام السوق/.test(l),
    isAsset:     ASSET_TICKERS.test(q),
    isSafety:    /safe|risk|danger|warning|caution|hedge|protect|خطر|تحذير|أمان|تحوط/.test(l),
  };
}

// ─── Conflict Arbitration ─────────────────────────────────────────────────────

function detectConflicts(
  meta: MetaReasoningResult | null,
  marketIntel: MarketIntelSummary,
  portfolioIntel: PortfolioIntelSummary,
  layers: CoordinatorInputLayers,
): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];

  // 1. Graph store contains contradiction edges (Phase 9 flagged them)
  if (layers.graph.toLowerCase().includes("contradicts")) {
    conflicts.push({
      type: "graph_contradiction",
      description: "Knowledge graph contains contradicting thesis or risk nodes",
      severity: "medium",
    });
  }

  // 2. Scenario top direction vs current regime
  const scLow = layers.scenario.toLowerCase();
  const scenarioBull = /rally|recovery|upside|bullish/.test(scLow);
  const scenarioBear = /correction|selloff|downside|bearish|crash/.test(scLow);
  const riskOff = marketIntel.regime === "risk_off" || marketIntel.regime === "volatile";
  const riskOn  = marketIntel.regime === "risk_on";
  if (scenarioBull && riskOff) {
    conflicts.push({
      type: "scenario_regime",
      description: `Top scenario is bullish but regime is ${marketIntel.regime} — directional tension`,
      severity: "medium",
    });
  } else if (scenarioBear && riskOn) {
    conflicts.push({
      type: "scenario_regime",
      description: `Top scenario is bearish but regime is risk-on — counter-trend signal`,
      severity: "medium",
    });
  }

  // 3. Meta-reasoning contradiction (Phase 10 — thesis vs regime, overconfidence)
  if (meta?.contradiction.detected) {
    const detail = meta.contradiction.details[0] ?? "Reasoning contradiction detected";
    conflicts.push({
      type: "agent_disagreement",
      description: detail.length > 80 ? `${detail.slice(0, 77)}…` : detail,
      severity: meta.overconfidenceRisk ? "high" : "medium",
    });
  }

  // 4. Portfolio regime misalignment
  if (!portfolioIntel.regimeAlignment.aligned && portfolioIntel.compactContext) {
    conflicts.push({
      type: "thesis_regime",
      description: portfolioIntel.regimeAlignment.note || "Portfolio not aligned with current market regime",
      severity: "low",
    });
  }

  // 5. Stale cross-surface session bus vs current regime
  if (layers.bus) {
    const busLow = layers.bus.toLowerCase();
    const busBull = /bull|risk_on|accumulation/.test(busLow);
    const busBear = /bear|risk.?off/.test(busLow);
    if ((busBull && riskOff) || (busBear && riskOn)) {
      conflicts.push({
        type: "stale_memory",
        description: "Cross-surface session regime differs from current market intelligence",
        severity: "low",
      });
    }
  }

  return conflicts;
}

// ─── Priority Engine ──────────────────────────────────────────────────────────

function computePriority(
  meta: MetaReasoningResult | null,
  conflicts: ConflictDetail[],
  intent: QueryIntent,
  thesisCount: number,
): PrioritySignal {
  // Level 1 — critical safety / contradiction / overconfidence
  if (meta?.overconfidenceRisk && (meta.reasoningScore ?? 100) < 45) return "safety";
  if (conflicts.some((c) => c.severity === "high") || (meta?.contradiction.detected && conflicts.length > 1)) return "contradiction";
  if (meta?.overconfidenceRisk) return "confidence_warning";

  // Level 2 — thesis > portfolio > regime
  if (intent.isThesis || thesisCount > 2) return "thesis";
  if (intent.isPortfolio) return "portfolio";
  if (intent.isRegime) return "regime";

  return "standard";
}

// ─── Weight Adjuster ──────────────────────────────────────────────────────────

function adjustWeights(
  intent: QueryIntent,
  priority: PrioritySignal,
  conflicts: ConflictDetail[],
  meta: MetaReasoningResult | null,
  hasResearch: boolean,
  thesisCount: number,
  watchlistCount: number,
): Record<string, number> {
  const w = { ...BASE_WEIGHTS };
  const cap = (v: number, max: number) => Math.min(max, v);

  // ── Intent-driven boosts ──
  if (intent.isPortfolio && watchlistCount > 0) w.portfolio = cap(w.portfolio * 1.20, 0.97);
  if (intent.isThesis || thesisCount > 0)       w.thesis    = cap(w.thesis    * 1.15, 0.97);
  if (intent.isScenario)                        w.scenario  = cap(w.scenario  * 1.25, 0.80);
  if (intent.isRegime)                          w.marketIntel = cap(w.marketIntel * 1.20, 0.86);
  if (intent.isAsset)                           w.graph     = cap(w.graph     * 1.30, 0.77);
  if (intent.isSafety)                          w.meta      = cap(w.meta      * 1.20, 0.72);
  if (hasResearch)                              w.research  = cap(w.research  * 1.10, 0.97);

  // ── Conflict and meta boosts ──
  if (meta?.contradiction.detected || conflicts.length > 0) {
    w.meta     = cap(w.meta * 1.40, 0.77);
    w.decision = cap(w.decision * 1.05, 0.97);
  }
  if (priority === "contradiction" || priority === "safety") {
    w.meta     = cap(w.meta * 1.20, 0.80);
    w.decision = cap(w.decision * 1.05, 0.97);
  }
  if (priority === "thesis") {
    w.thesis = cap(w.thesis * 1.08, 0.97);
    w.graph  = cap(w.graph  * 1.12, 0.77);
  }

  // ── Suppression of low-relevance layers ──
  if (!intent.isPortfolio && watchlistCount === 0) w.portfolio = w.portfolio * 0.70;
  if (!intent.isScenario && !intent.isRegime)      w.scenario  = w.scenario  * 0.85;
  if (conflicts.some((c) => c.type === "stale_memory")) w.bus = w.bus * 0.65;

  return w;
}

// ─── Routing Decision (for UI display) ───────────────────────────────────────

function buildRoutingDecision(
  adjusted: Record<string, number>,
): Record<string, "boosted" | "suppressed" | "standard"> {
  const out: Record<string, "boosted" | "suppressed" | "standard"> = {};
  for (const [key, weight] of Object.entries(adjusted)) {
    const base = BASE_WEIGHTS[key] ?? weight;
    out[key] = weight > base * 1.07 ? "boosted" : weight < base * 0.86 ? "suppressed" : "standard";
  }
  return out;
}

// ─── Coordination Note ────────────────────────────────────────────────────────

function buildCoordinationNote(
  priority: PrioritySignal,
  conflicts: ConflictDetail[],
  routing: Record<string, "boosted" | "suppressed" | "standard">,
): string {
  const parts: string[] = [];

  // Surface highest-severity conflict first
  const high = conflicts.find((c) => c.severity === "high");
  const med  = conflicts.find((c) => c.severity === "medium");
  const top  = high ?? med;
  if (top && (priority === "contradiction" || priority === "safety" || priority === "confidence_warning")) {
    parts.push(top.description.slice(0, 60));
  }

  // List boosted layers for AI transparency
  const boosted = Object.entries(routing)
    .filter(([, v]) => v === "boosted")
    .map(([k]) => k)
    .slice(0, 3);
  if (boosted.length) parts.push(`boosted: ${boosted.join(", ")}`);

  // Conflict count when multiple
  if (conflicts.length > 1) parts.push(`${conflicts.length} conflicts arbitrated`);

  if (!parts.length) return "";
  const note = `Coord[${priority}]: ${parts.join(" | ")}`;
  return note.length <= 150 ? note : `${note.slice(0, 147)}…`;
}

// ─── Fallback Layers (static — used when coordinator throws) ─────────────────

function fallbackLayers(layers: CoordinatorInputLayers): CoordinationLayer[] {
  return [
    { key: "mem",        content: layers.mem,        weight: 0.95 },
    { key: "decision",   content: layers.decision,   weight: 0.90 },
    { key: "research",   content: layers.research,   weight: 0.88 },
    { key: "watchlist",  content: layers.watchlist,  weight: 0.85 },
    { key: "thesis",     content: layers.thesis,     weight: 0.85 },
    { key: "session",    content: layers.session,    weight: 0.80 },
    { key: "portfolio",  content: layers.portfolio,  weight: 0.78 },
    { key: "bus",        content: layers.bus,        weight: 0.75 },
    { key: "signal",     content: layers.signal,     weight: 0.65 },
    { key: "marketIntel",content: layers.marketIntel,weight: 0.62 },
    { key: "scenario",   content: layers.scenario,   weight: 0.58 },
    { key: "graph",      content: layers.graph,      weight: 0.56 },
    { key: "meta",       content: layers.meta,       weight: 0.53 },
    { key: "top3",       content: layers.top3,       weight: 0.50 },
    { key: "bot3",       content: layers.bot3,       weight: 0.50 },
    { key: "market",     content: layers.market,     weight: 0.40 },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function coordinateIntelligence(
  question: string,
  layers: CoordinatorInputLayers,
  metaResult: MetaReasoningResult | null,
  marketIntel: MarketIntelSummary,
  portfolioIntel: PortfolioIntelSummary,
  hasResearch: boolean,
  thesisCount: number,
  watchlistCount: number,
): CoordinationResult {
  try {
    const intent    = detectIntent(question);
    const conflicts = detectConflicts(metaResult, marketIntel, portfolioIntel, layers);
    const priority  = computePriority(metaResult, conflicts, intent, thesisCount);
    const adjusted  = adjustWeights(intent, priority, conflicts, metaResult, hasResearch, thesisCount, watchlistCount);
    const routing   = buildRoutingDecision(adjusted);
    const coordinationNote = buildCoordinationNote(priority, conflicts, routing);

    // Coordination note injected as a near-top-priority layer (present only when non-empty)
    const coordLayers: CoordinationLayer[] = coordinationNote
      ? [{ key: "coord", content: coordinationNote, weight: adjusted.coord ?? 0.93 }]
      : [];

    const orderedLayers: CoordinationLayer[] = [
      ...coordLayers,
      { key: "mem",        content: layers.mem,        weight: adjusted.mem         ?? 0.95 },
      { key: "decision",   content: layers.decision,   weight: adjusted.decision    ?? 0.90 },
      { key: "research",   content: layers.research,   weight: adjusted.research    ?? 0.88 },
      { key: "watchlist",  content: layers.watchlist,  weight: adjusted.watchlist   ?? 0.85 },
      { key: "thesis",     content: layers.thesis,     weight: adjusted.thesis      ?? 0.85 },
      { key: "session",    content: layers.session,    weight: adjusted.session     ?? 0.80 },
      { key: "portfolio",  content: layers.portfolio,  weight: adjusted.portfolio   ?? 0.78 },
      { key: "bus",        content: layers.bus,        weight: adjusted.bus         ?? 0.75 },
      { key: "signal",     content: layers.signal,     weight: adjusted.signal      ?? 0.65 },
      { key: "marketIntel",content: layers.marketIntel,weight: adjusted.marketIntel ?? 0.62 },
      { key: "scenario",   content: layers.scenario,   weight: adjusted.scenario    ?? 0.58 },
      { key: "graph",      content: layers.graph,      weight: adjusted.graph       ?? 0.56 },
      { key: "meta",       content: layers.meta,       weight: adjusted.meta        ?? 0.53 },
      { key: "top3",       content: layers.top3,       weight: adjusted.top3        ?? 0.50 },
      { key: "bot3",       content: layers.bot3,       weight: adjusted.bot3        ?? 0.50 },
      { key: "market",     content: layers.market,     weight: adjusted.market      ?? 0.40 },
    ];

    return { layers: orderedLayers, prioritySignal: priority, conflicts, coordinationNote, routingDecision: routing };

  } catch {
    // Graceful fallback — static weights, no coordination note, no conflicts surfaced
    return {
      layers: fallbackLayers(layers),
      prioritySignal: "standard",
      conflicts: [],
      coordinationNote: "",
      routingDecision: {},
    };
  }
}
