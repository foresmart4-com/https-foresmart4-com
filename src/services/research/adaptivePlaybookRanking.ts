// Phase-85D: Adaptive Playbook Ranking
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Replaces binary playbook preference (from allocatorPlaybookLibrary.ts) with
// multi-dimensional scored ranking. Each playbook is scored across five axes:
//
//   regimeFit:     how well this playbook's scenario matches the current regime label
//   signalFit:     how many of the playbook's activation signals are present in context
//   thesisFit:     how well the playbook's logic aligns with the investment question
//   saudiBonus:    Saudi question + Saudi-relevant playbook → bonus
//   macroSignal:   live market data triggers (oil extreme, rate moves, equity drawdown)
//
// Returns: { dominant, secondary, allScores }
//   dominant:  highest-scoring playbook (mandatory — always returned if any match)
//   secondary: second-highest if score ≥ 60% of dominant (optional complement)
//
// Builds on ALLOCATOR_PLAYBOOKS from allocatorPlaybookLibrary.ts.
// ExpertWeights from expertLearningGovernor.ts applied as multipliers.
//
// No autonomous execution. Educational reasoning only.

import { ALLOCATOR_PLAYBOOKS, type AllocatorPlaybook, type PlaybookId } from "./allocatorPlaybookLibrary";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlaybookScore {
  id: PlaybookId;
  playbook: AllocatorPlaybook;
  regimeFit:   number;  // 0-30
  signalFit:   number;  // 0-25
  thesisFit:   number;  // 0-20
  saudiBonus:  number;  // 0-15
  macroSignal: number;  // 0-10
  weightedTotal: number; // 0-100, after applying expertWeight
}

export interface AdaptivePlaybookResult {
  dominant:   AllocatorPlaybook | null;
  secondary:  AllocatorPlaybook | null;
  allScores:  PlaybookScore[];
}

// ─── Regime fit table ─────────────────────────────────────────────────────────
// Maps normalised regime labels to per-playbook fit scores (0-30).

const REGIME_FIT: Partial<Record<string, Partial<Record<PlaybookId, number>>>> = {
  bear_ranging:       { recession: 25, preservation: 20, tightening: 15, credit: 15 },
  macro_transition:   { regime_transition: 28, preservation: 20, inflation: 15, recession: 15 },
  high_vol_risk_off:  { preservation: 28, liquidity_crisis: 25, recession: 20 },
  bull_trending:      { easing: 20, em_allocation: 18, oil_shock: 15 },
  low_vol_risk_on:    { easing: 22, em_allocation: 20 },
  stagflation:        { inflation: 30, preservation: 20, oil_shock: 18 },
  inflation_shock:    { inflation: 30, oil_shock: 22, tightening: 18 },
  tightening_cycle:   { tightening: 30, preservation: 18, recession: 12 },
  easing_cycle:       { easing: 30, em_allocation: 20 },
  oil_fiscal_stress:  { oil_shock: 30, preservation: 18, recession: 15 },
};

// ─── Signal-fit keyword rules ─────────────────────────────────────────────────
// Per-playbook: keywords that indicate their activation signals are present.

const SIGNAL_KEYWORDS: Partial<Record<PlaybookId, RegExp[]>> = {
  preservation:       [/\b(uncertain|risk.off|defensive|wait|volatility|unclear)\b/i, /\b(caution|hesitant|protect)\b/i],
  recession:          [/\b(recession|slowdown|contraction|negative gdp|unemployment)\b/i, /\b(pmi|leading indicators|inversion)\b/i],
  inflation:          [/\b(inflation|cpi|pce|tips|real rate|commodity prices|wage)\b/i, /\b(above target|persistent|price pressure)\b/i],
  tightening:         [/\b(tighten|rate hike|hawkish|restrictive|rate rise|fomc hike)\b/i, /\b(terminal rate|short duration|bear flattener)\b/i],
  easing:             [/\b(ease|rate cut|dovish|pivot|accommodative|qe)\b/i, /\b(lower for longer|forward guidance|balance sheet)\b/i],
  oil_shock:          [/\b(oil|crude|brent|wti|opec|breakeven|energy prices)\b/i, /\b(supply disruption|fiscal|aramco|petrodollar)\b/i],
  liquidity_crisis:   [/\b(liquidity|repo|collateral|money market|dollar shortage|spread spike)\b/i, /\b(credit crunch|funding stress|contagion)\b/i],
  regime_transition:  [/\b(regime|transition|shift|quadrant|uncertainty|conflicting signals)\b/i, /\b(unclear|macro change|regime break)\b/i],
  em_allocation:      [/\b(emerging market|em |dxy|dollar weak|commodity boom)\b/i, /\b(capital flows|growth differential)\b/i],
};

// ─── Thesis-fit patterns ──────────────────────────────────────────────────────
// Keywords in the question that indicate this playbook is thesis-relevant.

const THESIS_FIT: Partial<Record<PlaybookId, RegExp>> = {
  preservation:    /\b(preserve|protect|defensive|safe|capital|downside)\b/i,
  recession:       /\b(recession|downturn|slowdown|contraction|negative|bear)\b/i,
  inflation:       /\b(inflation|hedge|real assets|tips|commodit|purchasing power)\b/i,
  tightening:      /\b(tighten|duration|rate sensitivity|hike|restrictive)\b/i,
  easing:          /\b(ease|cut|growth|risk assets|duration extension)\b/i,
  oil_shock:       /\b(oil|energy|fiscal|aramco|breakeven|opec|saudi fiscal)\b/i,
  liquidity_crisis:/\b(liquidity|crisis|contagion|systemic|funding|collateral)\b/i,
  regime_transition: /\b(regime|transition|uncertain|macro shift|conflicting)\b/i,
  em_allocation:   /\b(emerging|em|frontier|dxy|country allocation|capital flows)\b/i,
};

// ─── Scoring functions ────────────────────────────────────────────────────────

function computeRegimeFit(id: PlaybookId, regime: string): number {
  const key = regime.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  // Try exact match, then partial match
  for (const [rk, fits] of Object.entries(REGIME_FIT)) {
    if (key === rk || key.includes(rk.replace(/_/g, "")) || rk.includes(key)) {
      return fits[id] ?? 0;
    }
  }
  return 0;
}

function computeSignalFit(id: PlaybookId, text: string): number {
  const rules = SIGNAL_KEYWORDS[id];
  if (!rules) return 0;
  const hits = rules.filter(r => r.test(text)).length;
  return Math.round((hits / rules.length) * 25);
}

function computeThesisFit(id: PlaybookId, question: string): number {
  const pattern = THESIS_FIT[id];
  if (!pattern) return 0;
  const matchCount = (question.match(new RegExp(pattern.source, "gi")) ?? []).length;
  return Math.min(20, matchCount * 8);
}

function computeMacroSignal(
  id: PlaybookId,
  oilPrice?: number | null,
  oilChangePct?: number | null,
  spyChangePct?: number | null,
  tltChangePct?: number | null,
): number {
  let score = 0;
  const absOilChg = Math.abs(oilChangePct ?? 0);
  const absSpy    = Math.abs(spyChangePct ?? 0);
  const absTlt    = Math.abs(tltChangePct ?? 0);

  if (id === "oil_shock" && (absOilChg >= 2 || (oilPrice ?? 80) < 68 || (oilPrice ?? 80) > 95)) score += 10;
  if (id === "inflation" && absOilChg >= 2) score += 7;
  if (id === "tightening" && absTlt >= 0.8) score += 8;
  if (id === "easing" && absTlt >= 0.8 && (tltChangePct ?? 0) > 0) score += 8;
  if (id === "preservation" && absSpy >= 1.5) score += 8;
  if (id === "recession" && absSpy >= 2) score += 8;
  if (id === "liquidity_crisis" && absSpy >= 3) score += 10;
  return Math.min(10, score);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function rankPlaybooks(
  question: string,
  ctx: string,
  regime = "unknown",
  isSaudi = false,
  oilPrice?: number | null,
  oilChangePct?: number | null,
  spyChangePct?: number | null,
  tltChangePct?: number | null,
  expertWeights: Record<string, number> = {},
): AdaptivePlaybookResult {
  const text = `${question} ${ctx}`;
  const allScores: PlaybookScore[] = [];

  for (const pb of ALLOCATOR_PLAYBOOKS) {
    // Gate: keyword must match OR score must be high enough from other axes
    const keywordHit = pb.keywords.test(text);
    const regimeFit  = computeRegimeFit(pb.id, regime);
    const signalFit  = computeSignalFit(pb.id, text);
    const thesisFit  = computeThesisFit(pb.id, question);
    const macroSig   = computeMacroSignal(pb.id, oilPrice, oilChangePct, spyChangePct, tltChangePct);
    const saudiBonus = isSaudi && pb.saudiConsideration ? 12 : 0;

    // Minimum activation: keyword hit OR (regime fit + signal fit) ≥ 20
    const rawTotal = regimeFit + signalFit + thesisFit + saudiBonus + macroSig;
    if (!keywordHit && rawTotal < 20) continue;

    // Apply expert weight (bounded 0.8-1.2)
    const weight = Math.min(1.2, Math.max(0.8, expertWeights[pb.id] ?? 1.0));
    const weightedTotal = Math.min(100, Math.round(rawTotal * weight + (keywordHit ? 5 : 0)));

    allScores.push({ id: pb.id, playbook: pb, regimeFit, signalFit, thesisFit, saudiBonus, macroSignal: macroSig, weightedTotal });
  }

  allScores.sort((a, b) => b.weightedTotal - a.weightedTotal);

  if (allScores.length === 0) {
    return { dominant: null, secondary: null, allScores };
  }

  const dominant  = allScores[0].playbook;
  const threshold = allScores[0].weightedTotal * 0.60;
  const secondary = allScores.length > 1 && allScores[1].weightedTotal >= threshold
    ? allScores[1].playbook
    : null;

  return { dominant, secondary, allScores };
}

export function buildAdaptivePlaybookContext(
  result: AdaptivePlaybookResult,
  isSaudi = false,
): string {
  if (!result.dominant) return "";

  const pb = result.dominant;
  const favoured = pb.historicallyFavoured.slice(0, 3).join(", ");
  const avoided  = pb.historicallyAvoided.slice(0, 2).join(", ");
  let entry = `${pb.name}: ${pb.institutionalLogic} | Favoured: ${favoured} | Avoided: ${avoided}`;
  if (isSaudi && pb.saudiConsideration) {
    entry += ` | Saudi: ${pb.saudiConsideration}`;
  }
  entry = entry.slice(0, 320);

  let secondary = "";
  if (result.secondary) {
    const sp = result.secondary;
    secondary = ` || Secondary: ${sp.name}: ${sp.institutionalLogic.slice(0, 80)}`;
  }

  const scoreNote = result.allScores[0]
    ? ` [score=${result.allScores[0].weightedTotal}]`
    : "";

  return [
    `Adaptive playbook [${pb.id}${result.secondary ? "+" + result.secondary.id : ""}${scoreNote}]:`,
    entry + secondary,
    "Educational reasoning only — no execution implication.",
  ].join(" ").slice(0, 500);
}
