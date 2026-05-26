/**
 * Portfolio Brain Intelligence Engine
 *
 * Pure cross-asset analysis from WatchlistAsset[] + MarketIntelSummary + ThesisEntry[].
 * No network calls. No fake data. No trading logic.
 *
 * Computes:
 *  1. Category exposure breakdown (count + weight %)
 *  2. Concentration risk (Herfindahl-style, 0-100)
 *  3. Risk overlap warnings (single-class dominance, high-beta overweight)
 *  4. Regime alignment (watchlist vs current market regime)
 *  5. Thesis relevance (which active theses match watchlist assets)
 *  6. Compact context string (≤200 chars) for Genesis injection
 */

import type { WatchlistAsset } from "@/lib/watchlistStore";
import type { MarketIntelSummary } from "@/services/market/marketIntelEngine";
import type { ThesisEntry } from "@/services/learning/thesisMemory";

export type WatchlistCategory = WatchlistAsset["category"];

export interface CategoryExposure {
  category: WatchlistCategory;
  count: number;
  weightPct: number;  // 0-100
}

export interface ThesisRelevance {
  asset: string;
  direction: ThesisEntry["direction"];
  relevantToWatchlist: boolean;
}

export interface PortfolioIntelSummary {
  categoryExposure: CategoryExposure[];
  concentrationScore: number;        // 0-100 (HHI × 100)
  dominantCategory: WatchlistCategory | null;
  riskOverlap: {
    detected: boolean;
    description: string;             // "" when not detected
  };
  regimeAlignment: {
    aligned: boolean;                // false = watchlist misaligned with current regime
    note: string;                    // "" when neutral/no issue
  };
  thesisRelevance: ThesisRelevance[];
  relevantThesisCount: number;       // theses that match a watched symbol
  compactContext: string;            // ≤200 chars — injected into Genesis context
}

// ─── Internal constants ────────────────────────────────────────────────────────

// Categories that are high-beta / risk-on sensitive
const RISK_ON_CATS = new Set<WatchlistCategory>(["crypto", "us"]);
// Categories with defensive or safe-haven properties
const DEFENSIVE_CATS = new Set<WatchlistCategory>(["commodities", "fx"]);

// ─── Empty sentinel ────────────────────────────────────────────────────────────

const EMPTY: PortfolioIntelSummary = {
  categoryExposure: [],
  concentrationScore: 0,
  dominantCategory: null,
  riskOverlap: { detected: false, description: "" },
  regimeAlignment: { aligned: true, note: "" },
  thesisRelevance: [],
  relevantThesisCount: 0,
  compactContext: "",
};

// ─── 1. Category exposure ──────────────────────────────────────────────────────

function buildCategoryExposure(items: WatchlistAsset[]): CategoryExposure[] {
  const total = items.length;
  if (!total) return [];
  const counts = new Map<WatchlistCategory, number>();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      weightPct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── 2. Concentration score (Herfindahl) ──────────────────────────────────────

function computeConcentration(exposures: CategoryExposure[]): number {
  const total = exposures.reduce((s, e) => s + e.count, 0);
  if (!total) return 0;
  const hhi = exposures.reduce((s, e) => s + (e.count / total) ** 2, 0);
  return Math.round(hhi * 100);
}

// ─── 3. Risk overlap detection ────────────────────────────────────────────────

function detectRiskOverlap(
  items: WatchlistAsset[],
  exposures: CategoryExposure[],
): PortfolioIntelSummary["riskOverlap"] {
  const total = items.length;
  if (!total) return { detected: false, description: "" };

  const top = exposures[0];
  // Single category dominates >60%
  if (top && top.count / total >= 0.6) {
    return {
      detected: true,
      description: `${top.weightPct}% watchlist in ${top.category} — single-class risk`,
    };
  }

  // Combined high-beta (crypto + us) dominates >70%
  const riskOnCount = items.filter((a) => RISK_ON_CATS.has(a.category)).length;
  if (riskOnCount / total >= 0.70) {
    return {
      detected: true,
      description: `${Math.round((riskOnCount / total) * 100)}% high-beta — no defensive hedge`,
    };
  }

  return { detected: false, description: "" };
}

// ─── 4. Regime alignment ──────────────────────────────────────────────────────

function detectRegimeAlignment(
  items: WatchlistAsset[],
  intel: MarketIntelSummary,
): PortfolioIntelSummary["regimeAlignment"] {
  // Nothing actionable in neutral or mixed regimes
  if (!items.length || intel.regime === "neutral" || intel.regime === "mixed") {
    return { aligned: true, note: "" };
  }

  const total = items.length;
  const riskOnPct = items.filter((a) => RISK_ON_CATS.has(a.category)).length / total;
  const defensivePct = items.filter((a) => DEFENSIVE_CATS.has(a.category)).length / total;

  if (intel.regime === "risk_on") {
    if (riskOnPct >= 0.4) return { aligned: true, note: `Risk-on watchlist aligned with regime` };
    if (defensivePct >= 0.6) return { aligned: false, note: `Defensive watchlist in risk-on regime — rotation gap` };
  }

  if (intel.regime === "risk_off") {
    if (defensivePct >= 0.4) return { aligned: true, note: `Defensive coverage aligned with risk-off regime` };
    if (riskOnPct >= 0.6) return { aligned: false, note: `Risk-on watchlist exposed to risk-off regime — hedge gap` };
  }

  if (intel.regime === "volatile") {
    if (riskOnPct >= 0.7) return { aligned: false, note: `High-beta watchlist in volatile regime — elevated drawdown risk` };
  }

  return { aligned: true, note: "" };
}

// ─── 5. Thesis relevance ──────────────────────────────────────────────────────

function computeThesisRelevance(
  theses: ThesisEntry[],
  watchlistSymbols: Set<string>,
): ThesisRelevance[] {
  return theses.map((t) => ({
    asset: t.asset,
    direction: t.direction,
    relevantToWatchlist: watchlistSymbols.has(t.asset),
  }));
}

// ─── 6. Compact context string (≤200 chars) ───────────────────────────────────

function buildCompactContext(s: PortfolioIntelSummary, itemCount: number): string {
  if (!itemCount) return "";
  const parts: string[] = [];

  // Portfolio category breakdown (top 3 categories)
  const expStr = s.categoryExposure.slice(0, 3)
    .map((e) => `${e.category}:${e.weightPct}%`)
    .join(" ");
  parts.push(`Portfolio (${itemCount}): ${expStr}`);

  // Concentration signal
  if (s.concentrationScore > 50) parts.push(`conc:${s.concentrationScore}/100`);

  // Risk overlap warning
  if (s.riskOverlap.detected) parts.push(`⚠ ${s.riskOverlap.description}`);

  // Regime alignment warning / confirmation
  if (s.regimeAlignment.note) {
    parts.push(s.regimeAlignment.aligned ? s.regimeAlignment.note : `⚠ ${s.regimeAlignment.note}`);
  }

  // Thesis match count
  if (s.relevantThesisCount > 0) {
    parts.push(`${s.relevantThesisCount} thesis match${s.relevantThesisCount > 1 ? "es" : ""}`);
  }

  return parts.join(" | ").slice(0, 200);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computePortfolioIntel(
  items: WatchlistAsset[],
  intel: MarketIntelSummary,
  theses: ThesisEntry[],
): PortfolioIntelSummary {
  if (!items.length) return EMPTY;

  const categoryExposure = buildCategoryExposure(items);
  const concentrationScore = computeConcentration(categoryExposure);
  const dominantCategory = categoryExposure[0]?.category ?? null;
  const riskOverlap = detectRiskOverlap(items, categoryExposure);
  const regimeAlignment = detectRegimeAlignment(items, intel);

  const watchlistSymbols = new Set(items.map((a) => a.symbol));
  const thesisRelevance = computeThesisRelevance(theses, watchlistSymbols);
  const relevantThesisCount = thesisRelevance.filter((t) => t.relevantToWatchlist).length;

  const summary: PortfolioIntelSummary = {
    categoryExposure,
    concentrationScore,
    dominantCategory,
    riskOverlap,
    regimeAlignment,
    thesisRelevance,
    relevantThesisCount,
    compactContext: "",
  };

  summary.compactContext = buildCompactContext(summary, items.length);
  return summary;
}
