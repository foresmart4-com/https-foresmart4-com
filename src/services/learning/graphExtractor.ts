/**
 * Graph Extractor — Phase 9
 * Extracts semantic nodes and edges from a Genesis AI reply and writes them
 * to the intelligence graph. Pure side-effect function.
 *
 * Rules:
 * - Only processes AI replies (heuristic replies have no semantic content)
 * - No network calls, no server persistence
 * - Each node type is capped to prevent unbounded growth
 * - Node labels are capped at 40 chars; content at 200 chars
 */
import type { GenesisReply } from "@/lib/genesis.functions";
import type { WatchlistAsset } from "@/lib/watchlistStore";
import { intelligenceGraph } from "./intelligenceGraph";

const KNOWN_TICKERS = [
  "BTC", "ETH", "GOLD", "XAU", "SPX", "SPY", "QQQ",
  "OIL", "WTI", "USD", "EUR", "GBP", "JPY",
  "ARAMCO", "2222", "SABIC", "STC",
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META",
];

function short(text: string, max = 40): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function extractAsset(reply: GenesisReply, question: string, watchlistItems: WatchlistAsset[]): string | null {
  // 1. Explicit action symbol
  if (reply.suggestedAction?.symbol) return reply.suggestedAction.symbol.toUpperCase();
  // 2. Watchlist asset mentioned in question
  const upper = question.toUpperCase();
  for (const item of watchlistItems) {
    if (upper.includes(item.symbol)) return item.symbol.toUpperCase();
  }
  // 3. Known tickers mentioned in question
  for (const t of KNOWN_TICKERS) {
    if (upper.includes(t)) return t;
  }
  return null;
}

export function extractGraphFromReply(
  reply: GenesisReply,
  question: string,
  engine: "ai" | "heuristic",
  watchlistItems: WatchlistAsset[],
): void {
  // Only extract from AI replies
  if (engine !== "ai") return;

  const assetSymbol = extractAsset(reply, question, watchlistItems);

  // ── 1. Asset node ────────────────────────────────────────────────────────
  let assetId: string | null = null;
  if (assetSymbol) {
    assetId = intelligenceGraph.upsertNode({
      type: "asset",
      label: assetSymbol,
      content: assetSymbol,
      asset: assetSymbol,
      confidence: reply.confidence,
      regime: reply.regime,
    });
  }

  // ── 2. Regime node ───────────────────────────────────────────────────────
  let regimeId: string | null = null;
  if (reply.regime) {
    regimeId = intelligenceGraph.upsertNode({
      type: "regime",
      label: short(reply.regime.replace(/_/g, " "), 30),
      content: reply.regime,
      confidence: reply.confidence,
    });
    if (assetId) intelligenceGraph.addEdge(assetId, regimeId, "observed_in");
  }

  // ── 3. Thesis node ───────────────────────────────────────────────────────
  let thesisId: string | null = null;
  if (reply.thesis) {
    thesisId = intelligenceGraph.upsertNode({
      type: "thesis",
      label: short(reply.thesis),
      content: reply.thesis.slice(0, 200),
      asset: assetSymbol ?? undefined,
      confidence: reply.confidence,
      regime: reply.regime,
    });
    if (assetId)  intelligenceGraph.addEdge(thesisId, assetId,  "relates_to");
    if (regimeId) intelligenceGraph.addEdge(thesisId, regimeId, "observed_in");
  }

  // ── 4. Catalyst nodes (max 3) ────────────────────────────────────────────
  for (const cat of (reply.catalysts ?? []).slice(0, 3)) {
    const catId = intelligenceGraph.upsertNode({
      type: "catalyst",
      label: short(cat, 38),
      content: cat.slice(0, 200),
      asset: assetSymbol ?? undefined,
      confidence: reply.confidence,
      regime: reply.regime,
    });
    if (thesisId) intelligenceGraph.addEdge(catId, thesisId, "supports");
    if (assetId)  intelligenceGraph.addEdge(catId, assetId,  "relates_to");
  }

  // ── 5. Risk nodes (max 3) ────────────────────────────────────────────────
  for (const risk of (reply.risks ?? []).slice(0, 3)) {
    const riskId = intelligenceGraph.upsertNode({
      type: "risk",
      label: short(risk, 38),
      content: risk.slice(0, 200),
      asset: assetSymbol ?? undefined,
      confidence: Math.min(reply.confidence, 70),
      regime: reply.regime,
    });
    if (assetId)  intelligenceGraph.addEdge(riskId, assetId,  "impacted_by");
    if (thesisId) intelligenceGraph.addEdge(riskId, thesisId, "contradicts");
  }

  // ── 6. Invalidation condition ────────────────────────────────────────────
  if (reply.invalidation && thesisId) {
    const invId = intelligenceGraph.upsertNode({
      type: "risk",
      label: short(reply.invalidation, 38),
      content: reply.invalidation.slice(0, 200),
      asset: assetSymbol ?? undefined,
      confidence: 50,
      regime: reply.regime,
    });
    intelligenceGraph.addEdge(thesisId, invId, "invalidated_by");
  }

  // ── 7. Scenario nodes (top 2) ────────────────────────────────────────────
  for (const sc of (reply.scenarios ?? []).slice(0, 2)) {
    const conf = parseInt(sc.probability) || 33; // parseInt("35%") → 35
    const scId = intelligenceGraph.upsertNode({
      type: "scenario",
      label: short(sc.label, 30),
      content: `${sc.label} (${sc.probability}): ${sc.impact}`.slice(0, 200),
      confidence: conf,
      regime: reply.regime,
    });
    if (assetId) intelligenceGraph.addEdge(scId, assetId, "impacted_by");
  }

  // ── 8. Portfolio context node ────────────────────────────────────────────
  if (reply.portfolioImpact && watchlistItems.length > 0) {
    const pcId = intelligenceGraph.upsertNode({
      type: "portfolio_context",
      label: short(reply.portfolioImpact, 38),
      content: reply.portfolioImpact.slice(0, 200),
      confidence: reply.confidence,
    });
    if (assetId) intelligenceGraph.addEdge(pcId, assetId, "affects_portfolio");
  }

  // ── 9. Research report node (Phase 8) ────────────────────────────────────
  if (reply.researchType) {
    const rrLabel = assetSymbol
      ? `Research: ${assetSymbol}`
      : `Research: ${reply.researchType}`;
    const rrContent = reply.executiveSummary ?? reply.headline;
    const rrId = intelligenceGraph.upsertNode({
      type: "research_report",
      label: short(rrLabel, 30),
      content: rrContent.slice(0, 200),
      asset: assetSymbol ?? undefined,
      confidence: reply.confidence,
    });
    if (assetId)  intelligenceGraph.addEdge(rrId, assetId,  "relates_to");
    if (thesisId) intelligenceGraph.addEdge(rrId, thesisId, "supports");
  }

  // ── 10. Key drivers from research terminal → catalyst nodes (Phase 8+9) ──
  for (const driver of (reply.keyDrivers ?? []).slice(0, 2)) {
    const dId = intelligenceGraph.upsertNode({
      type: "catalyst",
      label: short(driver, 38),
      content: driver.slice(0, 200),
      asset: assetSymbol ?? undefined,
      confidence: reply.confidence,
      regime: reply.regime,
    });
    if (thesisId) intelligenceGraph.addEdge(dId, thesisId, "reinforced_by");
    if (assetId)  intelligenceGraph.addEdge(dId, assetId,  "relates_to");
  }
}
