/**
 * Scenario Simulation Engine — Phase 7
 *
 * Pure cross-asset "if X then Y" simulation from MarketIntelSummary +
 * WatchlistAsset[] + ThesisEntry[].
 * No network calls. No fake data. No trading logic.
 *
 * Computes:
 *  1. Macro scenario template library (9 canonical scenarios)
 *  2. Relevance scoring per scenario (keyword + regime + stress signals)
 *  3. Portfolio / watchlist directional sensitivity per scenario
 *  4. Thesis alignment / conflict detection
 *  5. Compact context string (≤300 chars) for Genesis AI injection
 */

import type { WatchlistAsset } from "@/lib/watchlistStore";
import type { MarketIntelSummary, MarketRegime } from "@/services/market/marketIntelEngine";
import type { ThesisEntry } from "@/services/learning/thesisMemory";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ImpactLevel = -3 | -2 | -1 | 0 | 1 | 2 | 3;

// Uses AssetCategory naming from market-data.ts
export interface AssetImpacts {
  crypto: ImpactLevel;
  metals: ImpactLevel;
  oil: ImpactLevel;
  stocks: ImpactLevel;
  currencies: ImpactLevel;
  bonds: ImpactLevel;
}

export interface ScenarioTemplate {
  id: string;
  label: string;
  trigger: string;              // "If X occurs..."
  description: string;
  keywords: string[];
  impacts: AssetImpacts;
  regimeTriggers: MarketRegime[];  // regimes where scenario is more likely
  baseProbability: "low" | "moderate" | "high";
}

export interface WatchlistImpactEntry {
  symbol: string;
  category: WatchlistAsset["category"];
  impact: ImpactLevel;
  direction: "positive" | "negative" | "neutral";
}

export interface ScoredScenario {
  id: string;
  label: string;
  trigger: string;
  description: string;
  relevanceScore: number;          // 0-100
  probability: "low" | "moderate" | "high";
  impactSummary: string;           // compact arrow notation e.g. "crypto↓↓ metals↑ stocks↓"
  watchlistImpacts: WatchlistImpactEntry[];
  thesisConflicts: { asset: string; direction: ThesisEntry["direction"]; conflict: boolean }[];
}

export interface ScenarioSimResult {
  topScenarios: ScoredScenario[];  // top 2-3 by relevance
  compactContext: string;          // ≤300 chars for AI injection
  hasMeaningfulData: boolean;      // false when marketIntel is empty and question has no keywords
}

// ─── Scenario template library ─────────────────────────────────────────────────

const TEMPLATES: ScenarioTemplate[] = [
  {
    id: "rates_up",
    label: "Rates rise",
    trigger: "If interest rates rise (hawkish pivot / rate hike)",
    description: "Rate hikes compress equity multiples, pressure gold via real yields, and invert bond prices",
    keywords: ["rate", "hike", "hawkish", "fed", "inflation", "yield", "tighten", "boe", "ecb", "central bank"],
    impacts: { crypto: -2, metals: -1, oil: 0, stocks: -2, currencies: 1, bonds: -3 },
    regimeTriggers: ["risk_on"],
    baseProbability: "moderate",
  },
  {
    id: "rates_down",
    label: "Rates fall",
    trigger: "If interest rates fall (dovish pivot / rate cut)",
    description: "Rate cuts expand multiples, lift gold via lower real yields, and rally bonds",
    keywords: ["rate", "cut", "dovish", "easing", "recession", "pivot", "pause", "fed cut"],
    impacts: { crypto: 2, metals: 2, oil: 1, stocks: 2, currencies: -1, bonds: 3 },
    regimeTriggers: ["risk_off"],
    baseProbability: "moderate",
  },
  {
    id: "oil_spike",
    label: "Oil spikes",
    trigger: "If oil prices surge (supply shock / geopolitical disruption)",
    description: "Oil shock pressures consumers, benefits energy exporters, and stokes inflation",
    keywords: ["oil", "energy", "opec", "crude", "wti", "brent", "petroleum", "supply shock"],
    impacts: { crypto: -1, metals: 1, oil: 3, stocks: -1, currencies: 1, bonds: -1 },
    regimeTriggers: [],
    baseProbability: "low",
  },
  {
    id: "oil_collapse",
    label: "Oil collapses",
    trigger: "If oil prices collapse (demand destruction / supply glut)",
    description: "Oil collapse relieves inflation and benefits consumers but severely hurts energy exporters",
    keywords: ["oil", "energy", "demand", "collapse", "glut", "surplus"],
    impacts: { crypto: 0, metals: 0, oil: -3, stocks: 1, currencies: -1, bonds: 1 },
    regimeTriggers: [],
    baseProbability: "low",
  },
  {
    id: "usd_strength",
    label: "USD strengthens",
    trigger: "If the US dollar strengthens significantly (DXY rally)",
    description: "USD strength pressures all dollar-denominated commodities and emerging markets",
    keywords: ["dollar", "usd", "dxy", "strong dollar", "dollar strength", "dxy"],
    impacts: { crypto: -1, metals: -2, oil: -1, stocks: -1, currencies: -2, bonds: 0 },
    regimeTriggers: ["risk_off"],
    baseProbability: "moderate",
  },
  {
    id: "usd_weakness",
    label: "USD weakens",
    trigger: "If the US dollar weakens (DXY decline)",
    description: "USD weakness lifts commodities, crypto, and international assets priced in dollars",
    keywords: ["dollar", "usd", "dxy", "weak dollar", "dollar weakness", "dollar decline"],
    impacts: { crypto: 1, metals: 2, oil: 1, stocks: 1, currencies: 2, bonds: 0 },
    regimeTriggers: ["risk_on"],
    baseProbability: "moderate",
  },
  {
    id: "risk_on",
    label: "Risk-on surge",
    trigger: "If a risk-on surge materialises (macro positive surprise / policy pivot)",
    description: "Risk appetite surge benefits high-beta assets: crypto, growth equities, cyclicals",
    keywords: ["rally", "risk on", "bull", "recovery", "rebound", "breakout", "positive surprise"],
    impacts: { crypto: 3, metals: 0, oil: 1, stocks: 2, currencies: -1, bonds: -1 },
    regimeTriggers: ["risk_off", "mixed", "volatile"],
    baseProbability: "moderate",
  },
  {
    id: "risk_off",
    label: "Risk-off shock",
    trigger: "If a risk-off shock hits (macro surprise / credit event / geopolitical)",
    description: "Risk-off events trigger flight to gold, bonds, and USD; crypto and equities sell sharply",
    keywords: ["crash", "selloff", "risk off", "shock", "crisis", "fear", "contagion", "geopolitical"],
    impacts: { crypto: -3, metals: 2, oil: -2, stocks: -2, currencies: 1, bonds: 2 },
    regimeTriggers: ["risk_on", "mixed"],
    baseProbability: "low",
  },
  {
    id: "vol_spike",
    label: "Volatility spike",
    trigger: "If a volatility spike forces deleveraging (VIX surge)",
    description: "Vol spikes trigger forced deleveraging across all leveraged positions; high-beta suffers most",
    keywords: ["vix", "volatility", "vol", "spike", "leverage", "deleveraging", "margin"],
    impacts: { crypto: -3, metals: -1, oil: -2, stocks: -3, currencies: 0, bonds: 1 },
    regimeTriggers: ["volatile"],
    baseProbability: "low",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function impactArrow(lvl: ImpactLevel): string {
  if (lvl >= 3) return "↑↑↑";
  if (lvl === 2) return "↑↑";
  if (lvl === 1) return "↑";
  if (lvl === 0) return "—";
  if (lvl === -1) return "↓";
  if (lvl === -2) return "↓↓";
  return "↓↓↓";
}

function impactDirection(lvl: ImpactLevel): "positive" | "negative" | "neutral" {
  if (lvl > 0) return "positive";
  if (lvl < 0) return "negative";
  return "neutral";
}

// Maps WatchlistAsset category to an equivalent impact from AssetImpacts.
// Saudi market correlates to stocks + oil blend (energy exporter).
// Commodities watchlist = blend of metals + oil.
function watchlistCatImpact(
  category: WatchlistAsset["category"],
  impacts: AssetImpacts,
): ImpactLevel {
  switch (category) {
    case "crypto": return impacts.crypto;
    case "us":     return impacts.stocks;
    case "saudi":  return Math.max(-3, Math.min(3, Math.round((impacts.stocks + impacts.oil) / 2))) as ImpactLevel;
    case "commodities": return Math.max(-3, Math.min(3, Math.round((impacts.metals + impacts.oil) / 2))) as ImpactLevel;
    case "fx":     return impacts.currencies;
    case "other":  return 0;
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreTemplate(
  template: ScenarioTemplate,
  question: string,
  intel: MarketIntelSummary,
): number {
  let score = 10; // base

  // Keyword match — heaviest signal when user is asking about this scenario
  const q = question.toLowerCase();
  if (template.keywords.some((kw) => q.includes(kw))) score += 40;

  // Regime trigger — scenario is more likely under current regime
  if (template.regimeTriggers.includes(intel.regime)) score += 30;

  // Stress amplifiers — high stress makes vol_spike and risk_off more likely
  if (intel.stressScore > 55 && (template.id === "vol_spike" || template.id === "risk_off")) score += 20;

  // Risk-on/off directional alignment
  if (intel.riskOnScore > 20 && template.id === "risk_on") score += 15;
  if (intel.riskOnScore < -20 && template.id === "risk_off") score += 15;

  // Regime transition warning boosts shock scenarios
  if (intel.regimeTransition && (template.id === "risk_off" || template.id === "vol_spike")) score += 10;

  return Math.min(100, score);
}

function adjustedProbability(
  base: ScenarioTemplate["baseProbability"],
  score: number,
): ScoredScenario["probability"] {
  if (score > 80 && base === "low") return "moderate";
  if (score > 80 && base === "moderate") return "high";
  return base;
}

function buildImpactSummary(impacts: AssetImpacts): string {
  const entries: string[] = [];
  const cats: Array<{ key: keyof AssetImpacts; label: string }> = [
    { key: "crypto", label: "crypto" },
    { key: "stocks", label: "stocks" },
    { key: "metals", label: "metals" },
    { key: "oil", label: "oil" },
    { key: "bonds", label: "bonds" },
  ];
  for (const { key, label } of cats) {
    const lvl = impacts[key];
    if (lvl !== 0) entries.push(`${label}${impactArrow(lvl)}`);
  }
  return entries.join(" ").slice(0, 60);
}

// ─── Main export ──────────────────────────────────────────────────────────────

const EMPTY_RESULT: ScenarioSimResult = {
  topScenarios: [],
  compactContext: "",
  hasMeaningfulData: false,
};

export function computeScenarioSim(
  question: string,
  intel: MarketIntelSummary,
  watchlistItems: WatchlistAsset[],
  theses: ThesisEntry[],
): ScenarioSimResult {
  // Score all templates
  const scored = TEMPLATES.map((t) => ({
    template: t,
    score: scoreTemplate(t, question, intel),
  })).sort((a, b) => b.score - a.score);

  // Only meaningful if at least one template has a non-trivial score
  const hasMeaningfulData = scored[0]?.score > 10;
  if (!hasMeaningfulData) return EMPTY_RESULT;

  // Take top 3
  const top3 = scored.slice(0, 3);

  const topScenarios: ScoredScenario[] = top3.map(({ template, score }) => {
    // Portfolio/watchlist sensitivity
    const watchlistImpacts: WatchlistImpactEntry[] = watchlistItems.slice(0, 6).map((item) => {
      const impact = watchlistCatImpact(item.category, template.impacts);
      return {
        symbol: item.symbol,
        category: item.category,
        impact,
        direction: impactDirection(impact),
      };
    });

    // Thesis alignment — check if thesis direction conflicts with scenario impact on that asset
    const thesisConflicts = theses.map((th) => {
      const watchlistItem = watchlistItems.find((w) => w.symbol === th.asset);
      const impact = watchlistItem
        ? watchlistCatImpact(watchlistItem.category, template.impacts)
        : template.impacts.stocks; // fallback to stocks impact for unknown assets

      // Thesis is bullish but scenario is negative → conflict
      // Thesis is bearish but scenario is positive → conflict
      const conflict =
        (th.direction === "bullish" && impact < -1) ||
        (th.direction === "bearish" && impact > 1);

      return { asset: th.asset, direction: th.direction, conflict };
    });

    return {
      id: template.id,
      label: template.label,
      trigger: template.trigger,
      description: template.description,
      relevanceScore: score,
      probability: adjustedProbability(template.baseProbability, score),
      impactSummary: buildImpactSummary(template.impacts),
      watchlistImpacts,
      thesisConflicts,
    };
  });

  // ─── Compact context string (≤300 chars) ──────────────────────────────────

  const parts: string[] = [];

  // Top 2 scenarios with impact summary
  const scenarioParts = topScenarios.slice(0, 2).map(
    (s) => `${s.label}(${s.probability}): ${s.impactSummary}`,
  );
  parts.push(`Macro scenarios: ${scenarioParts.join(" | ")}`);

  // Watchlist sensitivity for top scenario
  if (watchlistItems.length > 0 && topScenarios[0]) {
    const topSim = topScenarios[0];
    const sensitive = topSim.watchlistImpacts
      .filter((w) => w.impact !== 0)
      .map((w) => `${w.symbol}${impactArrow(w.impact)}`)
      .join(" ");
    if (sensitive) parts.push(`Watchlist(${topSim.label}): ${sensitive}`);
  }

  // Thesis conflicts
  const conflicts = topScenarios
    .flatMap((s) => s.thesisConflicts.filter((tc) => tc.conflict))
    .map((tc) => tc.asset);
  const uniqueConflicts = [...new Set(conflicts)];
  if (uniqueConflicts.length > 0) {
    parts.push(`Thesis conflict: ${uniqueConflicts.slice(0, 2).join(", ")} vs top scenario`);
  }

  const compactContext = parts.join(" | ").slice(0, 300);

  return { topScenarios, compactContext, hasMeaningfulData: true };
}
