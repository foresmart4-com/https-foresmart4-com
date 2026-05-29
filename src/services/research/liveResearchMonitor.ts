// Phase-85B: Live Research Monitor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Research awareness layer: scores the RELEVANCE of each research dimension
// (policy, thesis, market, regime) based on live inputs — question content,
// live market signals, and macro regime label.
//
// This is NOT a polling/crawling system. It does not fetch external content.
// It scores WHAT IS ALREADY AVAILABLE in the current request context:
//   - Question language (keyword signals for each dimension)
//   - Live market data (magnitude of moves triggers research relevance)
//   - Regime label (regime type triggers specific frameworks)
//   - Saudi flag (enables Saudi-specific research relevance paths)
//
// Bounded refresh: module-level cache prevents recomputation for the same
// input signature within a short cooldown window (30s).
//
// Outputs:
//   policyRelevance:   0-100 (policy/CB language in question + regime signal)
//   thesisRelevance:   0-100 (investment/allocation language in question)
//   marketRelevance:   0-100 (live market moves + cross-asset signals)
//   regimeRelevance:   0-100 (regime uncertainty + transition signals)
//   activeResearchDomains: string[] (research domains activated by signals)
//   relevanceLabel:    summary label for logging

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LiveSignals {
  oilPrice?: number | null;
  oilChangePct?: number | null;
  spyChangePct?: number | null;
  tltChangePct?: number | null;
  goldChangePct?: number | null;
  btcChangePct?: number | null;
  eurUsd?: number | null;
}

export interface ResearchRelevanceResult {
  policyRelevance:  number;  // 0-100
  thesisRelevance:  number;  // 0-100
  marketRelevance:  number;  // 0-100
  regimeRelevance:  number;  // 0-100
  activeResearchDomains: string[];
  relevanceLabel: string;
  overallRelevance: number;  // 0-100: max of the four scores
}

// ─── Keyword scoring ──────────────────────────────────────────────────────────

type KeywordRule = { pattern: RegExp; score: number };

const POLICY_KEYWORDS: KeywordRule[] = [
  { pattern: /\b(fed|fomc|ecb|sama|central bank|rate|monetary policy|بنك مركزي|سياسة نقدية|فائدة)\b/i, score: 20 },
  { pattern: /\b(hike|cut|pause|pivot|tighten|ease|forward guidance|dot plot|تشديد|تيسير|تخفيض|رفع)\b/i, score: 20 },
  { pattern: /\b(inflation|deflation|cpi|pce|target|2%|تضخم|هدف التضخم)\b/i, score: 15 },
  { pattern: /\b(balance sheet|qe|qt|quantitative|reserve|الميزانية العمومية)\b/i, score: 15 },
  { pattern: /\b(yield curve|inverted|2s10s|treasury|بند|منحنى العائد)\b/i, score: 10 },
];

const THESIS_KEYWORDS: KeywordRule[] = [
  { pattern: /\b(invest|investment|investing|allocation|portfolio|position|buy|sell|overweight|underweight|allocator|stance|محفظة|شراء|بيع|تخصيص)\b/i, score: 20 },
  { pattern: /\b(thesis|conviction|framework|hypothesis|أطروحة|قناعة|إطار)\b/i, score: 20 },
  { pattern: /\b(sector|stock|equity|equities|bond|bonds|asset class|قطاع|أسهم|سندات|أصول)\b/i, score: 15 },
  { pattern: /\b(outlook|forecast|target|price target|هدف سعري|توقعات)\b/i, score: 15 },
  { pattern: /\b(saudi|tasi|aramco|sama|vision 2030|تاسي|أرامكو|رؤية)\b/i, score: 15 },
  { pattern: /\b(breakeven|transmission|peg|fiscal|mechanism)\b/i, score: 12 },
  { pattern: /\b(risk|reward|return|yield|عائد|مخاطرة)\b/i, score: 10 },
];

const REGIME_KEYWORDS: KeywordRule[] = [
  { pattern: /\b(regime|cycle|transition|macro|نظام|دورة|تحول)\b/i, score: 20 },
  { pattern: /\b(stagflation|goldilocks|recession|expansion|ركود تضخمي|توسع|انكماش)\b/i, score: 25 },
  { pattern: /\b(growth|gdp|pmi|manufacturing|نمو|ناتج محلي|مؤشر مدراء)\b/i, score: 15 },
  { pattern: /\b(risk.on|risk.off|uncertainty|volatile|مخاطر|تقلب|غموض)\b/i, score: 15 },
  { pattern: /\b(historical|analog|precedent|تاريخي|سابقة|مثيل)\b/i, score: 10 },
];

function scoreKeywords(text: string, rules: KeywordRule[]): number {
  let total = 0;
  for (const { pattern, score } of rules) {
    if (pattern.test(text)) total += score;
  }
  return Math.min(100, total);
}

// ─── Market signal scoring ────────────────────────────────────────────────────

function scoreMarketSignals(signals: LiveSignals): { score: number; domains: string[] } {
  let score = 0;
  const domains: string[] = [];

  const abs = (v?: number | null) => Math.abs(v ?? 0);

  // Significant moves elevate research relevance
  if (abs(signals.oilChangePct) >= 2) { score += 25; domains.push("commodity_economics"); }
  if (abs(signals.oilChangePct) >= 4) { score += 15; domains.push("macro_transmission"); }
  if (abs(signals.spyChangePct) >= 1.5) { score += 20; domains.push("market_structure"); }
  if (abs(signals.spyChangePct) >= 3) { score += 15; domains.push("behavioral_finance"); }
  if (abs(signals.tltChangePct) >= 1) { score += 20; domains.push("monetary_policy"); }
  if (abs(signals.goldChangePct) >= 1.5) { score += 15; domains.push("macro_cycles"); }
  if (abs(signals.btcChangePct) >= 5) { score += 10; domains.push("behavioral_finance"); }

  // Oil price level — Saudi fiscal relevance
  if (signals.oilPrice !== null && signals.oilPrice !== undefined) {
    if (signals.oilPrice < 70) { score += 20; domains.push("regional_economics"); }
    else if (signals.oilPrice > 90) { score += 15; domains.push("regional_economics"); }
  }

  // EUR/USD extreme moves signal DXY regime
  const eurUsdMove = abs((signals.eurUsd ?? 1.1) - 1.1) / 1.1 * 100;
  if (eurUsdMove > 3) { score += 10; domains.push("macro_transmission"); }

  return { score: Math.min(100, score), domains: [...new Set(domains)] };
}

// ─── Regime scoring ───────────────────────────────────────────────────────────

const REGIME_RESEARCH_RELEVANCE: Record<string, number> = {
  // High-research-relevance regimes (uncertainty is high, frameworks are contested)
  macro_transition:    80,
  high_vol_risk_off:   70,
  stagflation:         75,
  bear_ranging:        65,
  // Moderate relevance
  bull_trending:       40,
  low_vol_risk_on:     35,
  // Low relevance (stable, framework is clear)
  goldilocks:          30,
};

function scoreRegimeRelevance(regime?: string): number {
  if (!regime) return 30;
  const normalised = regime.toLowerCase().replace(/-/g, "_").replace(/\s/g, "_");
  return REGIME_RESEARCH_RELEVANCE[normalised] ?? 40;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

const COOLDOWN_MS = 30_000; // 30s — don't recompute for the same inputs within this window
let _cacheKey = "";
let _cacheTime = 0;
let _cachedResult: ResearchRelevanceResult | null = null;

function buildCacheKey(question: string, regime: string, signals: LiveSignals): string {
  // Coarse hash: first 40 chars of question + regime + oil rounded to nearest $2
  const oilRounded = signals.oilPrice ? Math.round(signals.oilPrice / 2) * 2 : 0;
  return `${question.slice(0, 40)}|${regime}|${oilRounded}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function assessResearchRelevance(
  question: string,
  ctx: string,
  isSaudi: boolean,
  regime: string = "unknown",
  signals: LiveSignals = {},
): ResearchRelevanceResult {
  const cacheKey = buildCacheKey(question, regime, signals);
  const now = Date.now();

  if (_cachedResult && cacheKey === _cacheKey && now - _cacheTime < COOLDOWN_MS) {
    return _cachedResult;
  }

  const text = `${question} ${ctx}`;
  const policyScore  = scoreKeywords(text, POLICY_KEYWORDS);
  const thesisScore  = scoreKeywords(text, THESIS_KEYWORDS);
  const regimeScore  = Math.max(
    scoreKeywords(text, REGIME_KEYWORDS),
    scoreRegimeRelevance(regime),
  );
  const { score: marketScore, domains: marketDomains } = scoreMarketSignals(signals);

  // Saudi amplification: research relevance is higher for Saudi-specific questions
  const saudiAmplifier = isSaudi ? 1.15 : 1.0;
  const policyFinal  = Math.min(100, Math.round(policyScore  * saudiAmplifier));
  const thesisFinal  = Math.min(100, Math.round(thesisScore  * saudiAmplifier));
  const regimeFinal  = Math.min(100, Math.round(regimeScore  * saudiAmplifier));

  // Active research domains: gather from keyword hits + market signals
  const activeDomains = new Set<string>(marketDomains);
  if (policyFinal >= 30) activeDomains.add("monetary_policy");
  if (thesisFinal >= 30) activeDomains.add("portfolio_theory");
  if (regimeFinal >= 40) activeDomains.add("macro_cycles");
  if (isSaudi && thesisFinal >= 20) activeDomains.add("regional_economics");

  const overall = Math.max(policyFinal, thesisFinal, marketScore, regimeFinal);

  const relevanceLabel = overall >= 70 ? "high_relevance"
    : overall >= 40 ? "moderate_relevance"
    : "low_relevance";

  const result: ResearchRelevanceResult = {
    policyRelevance:       policyFinal,
    thesisRelevance:       thesisFinal,
    marketRelevance:       marketScore,
    regimeRelevance:       regimeFinal,
    activeResearchDomains: [...activeDomains],
    relevanceLabel,
    overallRelevance:      overall,
  };

  _cacheKey = cacheKey;
  _cacheTime = now;
  _cachedResult = result;
  return result;
}

export function resetResearchRelevanceCache(): void {
  _cacheKey = "";
  _cacheTime = 0;
  _cachedResult = null;
}
