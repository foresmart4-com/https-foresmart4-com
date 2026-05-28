/**
 * Book Intelligence — Governed Economic Literature Layer
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Retrieves compressed institutional knowledge from the knowledge corpus,
 * matches historical analogs, surfaces competing school views, and
 * governs quality before injecting context.
 *
 * Design rules:
 * - No single-school dominance: diversity score penalizes same-school retrieval
 * - No popularity bias: relevance is scored on regime + signal match, not trend
 * - No blind ingestion: all cards have explicit quality labels
 * - No black-box output: every injected string is traceable to a corpus card
 * - Advisory only: "literature suggests", "historically associated with", never "proves"
 * - Phase-43 interaction: macroCycleState and activeThemes boost card relevance
 * - Phase-45 interaction: dominant transmission channel boosts matching cards
 */

import { CORPUS_CARDS, type CorpusCard, type FrameworkClass, type KnowledgeQualityLabel } from "@/services/knowledge/knowledgeCorpus";
import type { MacroCycleState, MacroRegion, MacroTheme } from "@/services/macro/globalMacroMemory";
import type { TransmissionChannel } from "@/services/intelligence/economicGraph";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookIntelligenceInput {
  question: string;
  marketRegime: string;                          // from marketIntel.regime
  macroCycleState: MacroCycleState;              // Phase-43
  dominantRegion: MacroRegion;                   // Phase-43
  activeThemes: MacroTheme[];                    // Phase-43
  dominantChannel: TransmissionChannel | null;   // Phase-45
  ar: boolean;
}

export interface BookIntelligenceResult {
  topCards: CorpusCard[];                        // top 1-2 matched cards
  historicalAnalog: string | null;               // compact analog label (no full text)
  historicalAnalogAr: string | null;             // Arabic equivalent
  institutionalLesson: string | null;            // compressed principle (≤100 chars)
  competingSchool: string | null;                // 1-phrase competing view
  frameworkClass: FrameworkClass | null;         // dominant matched framework class
  qualityLabel: KnowledgeQualityLabel | null;    // quality of top card
  diversityScore: number;                        // 0-100: school diversity of retrieval
  contextString: string;                         // compact ≤200 chars for AI injection
  hasKnowledge: boolean;
}

// ─── Historical analog rules ──────────────────────────────────────────────────

interface AnalogRule {
  analog: string;
  analogAr: string;
  macroCycles?: MacroCycleState[];
  themes?: MacroTheme[];
  channels?: TransmissionChannel[];
  regimes?: string[];
  keywords?: RegExp;
}

const ANALOG_RULES: AnalogRule[] = [
  {
    analog: "1970s stagflation analog",
    analogAr: "نظير التضخم الركودي 1970s",
    macroCycles: ["tightening_cycle"],
    themes: ["inflation", "oil_fiscal"],
    channels: ["inflation_to_rates", "oil_to_inflation"],
  },
  {
    analog: "2008 GFC transmission analog",
    analogAr: "نظير انتقال الأزمة المالية العالمية 2008",
    macroCycles: ["tightening_cycle"],
    themes: ["credit_stress", "liquidity"],
    channels: ["credit_to_risk_assets", "rates_to_credit", "liquidity_to_valuations"],
  },
  {
    analog: "1997 EM sudden-stop analog",
    analogAr: "نظير التوقف المفاجئ في الأسواق الناشئة 1997",
    macroCycles: ["tightening_cycle", "fragmented_cycle"],
    themes: ["em_flows", "usd_dynamics"],
    channels: ["policy_to_flows", "usd_to_commodities"],
    regimes: ["EM", "GCC"],
  },
  {
    analog: "Minsky-moment buildup analog",
    analogAr: "نظير تراكم لحظة مينسكي",
    macroCycles: ["transition_cycle", "easing_cycle"],
    themes: ["credit_stress", "liquidity"],
    channels: ["liquidity_to_valuations", "rates_to_credit"],
  },
  {
    analog: "2000-01 overvaluation correction analog",
    analogAr: "نظير تصحيح فقاعة 2000-2001",
    themes: ["risk_sentiment"],
    keywords: /\b(tech|growth|nasdaq|valuation|multiple|pe ratio|ai bubble|overvalued)\b/i,
    macroCycles: ["tightening_cycle", "transition_cycle"],
  },
  {
    analog: "1994 bond-market tantrum analog",
    analogAr: "نظير نوبة سوق السندات 1994",
    macroCycles: ["tightening_cycle"],
    channels: ["rates_to_liquidity", "inflation_to_rates"],
    keywords: /\b(bond.*sell.?off|rate.*shock|yield.*spike|rate.*surprise)\b/i,
  },
  {
    analog: "Post-2009 secular-stagnation analog",
    analogAr: "نظير الركود العلماني ما بعد 2009",
    macroCycles: ["easing_cycle"],
    themes: ["rate_policy", "liquidity"],
    keywords: /\b(low growth|low rates|deflation|secular|r\*|r-star|neutral rate)\b/i,
  },
];

function detectAnalog(input: BookIntelligenceInput): { analog: string; analogAr: string } | null {
  const { macroCycleState, activeThemes, dominantChannel, dominantRegion, question } = input;

  let bestMatch: AnalogRule | null = null;
  let bestScore = 0;

  for (const rule of ANALOG_RULES) {
    let score = 0;

    if (rule.macroCycles?.includes(macroCycleState)) score += 3;
    if (rule.themes?.some(t => activeThemes.includes(t))) score += 2;
    if (rule.channels?.some(c => c === dominantChannel)) score += 2;
    if (rule.regimes?.includes(dominantRegion)) score += 1;
    if (rule.keywords?.test(question)) score += 2;

    if (score >= 3 && score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  return bestMatch ? { analog: bestMatch.analog, analogAr: bestMatch.analogAr } : null;
}

// ─── Card scoring ─────────────────────────────────────────────────────────────

const THEME_TO_KEYWORD: Partial<Record<MacroTheme, string[]>> = {
  rate_policy:       ["rate", "taylor rule", "cb policy", "central bank", "rate hike", "rate cut"],
  inflation:         ["inflation", "cpi", "stagflation", "fisher", "price level"],
  liquidity:         ["liquidity", "qe", "endogenous money", "money supply"],
  credit_stress:     ["credit", "minsky", "deleveraging", "spread", "credit cycle"],
  commodity_cycle:   ["oil", "commodity", "gold"],
  usd_dynamics:      ["dollar", "dxy", "fisher", "usd"],
  china_demand:      ["china", "kondratiev", "industrial"],
  em_flows:          ["emerging market", "sudden stop", "capital flow"],
  oil_fiscal:        ["oil", "saudi", "stagflation"],
  risk_sentiment:    ["positioning", "narrative", "sentiment", "prospect theory"],
  policy_divergence: ["taylor rule", "endogenous money", "policy"],
  structural_shift:  ["kondratiev", "secular stagnation", "austrian"],
};

const CHANNEL_TO_KEYWORDS: Partial<Record<TransmissionChannel, string[]>> = {
  inflation_to_rates:      ["inflation", "fisher", "taylor rule"],
  rates_to_liquidity:      ["liquidity", "endogenous money", "taylor rule"],
  liquidity_to_valuations: ["liquidity premium", "minsky", "reflexivity"],
  usd_to_commodities:      ["dollar", "oil macro", "safe haven"],
  oil_to_inflation:        ["oil", "stagflation", "fisher"],
  china_to_demand:         ["china", "kondratiev"],
  policy_to_flows:         ["sudden stop", "austrian", "taylor rule"],
  sentiment_to_allocation: ["prospect theory", "narrative", "positioning", "tail risk"],
  rates_to_credit:         ["credit cycle", "minsky", "taylor rule"],
  credit_to_risk_assets:   ["credit cycle", "minsky", "liquidity premium", "tail risk"],
};

function scoreCorpusCard(
  card: CorpusCard,
  input: BookIntelligenceInput,
): number {
  const { question, marketRegime, macroCycleState, dominantRegion, activeThemes, dominantChannel } = input;
  const queryLower = question.toLowerCase();
  let score = 0;

  // Keyword match in question
  const kwMatches = card.keywords.filter(kw => queryLower.includes(kw)).length;
  score += kwMatches * 3;

  // Regime match
  if (card.regimeRelevance.includes(marketRegime)) score += 2;

  // MacroCycle alignment
  const cycleKeywords: Partial<Record<MacroCycleState, string[]>> = {
    tightening_cycle: ["tightening", "inflation", "rate", "credit cycle", "minsky", "stagflation", "tail risk", "1970s"],
    easing_cycle:     ["liquidity", "qe", "endogenous money", "liquidity premium", "kondratiev"],
    transition_cycle: ["kindleberger", "minsky", "kondratiev", "structural", "austrian"],
    fragmented_cycle: ["sudden stop", "emh", "limits to arbitrage", "volatile"],
    stable_cycle:     ["factor", "momentum", "positioning", "narrative"],
  };
  const cycleKws = cycleKeywords[macroCycleState] ?? [];
  if (cycleKws.some(kw => card.keywords.some(ck => ck.includes(kw)))) score += 2;

  // MacroRegion match
  if (card.macroRegions.length === 0 || card.macroRegions.includes(dominantRegion)) score += 1;

  // Active theme match
  for (const theme of activeThemes) {
    const themeKws = THEME_TO_KEYWORD[theme] ?? [];
    if (themeKws.some(kw => card.keywords.some(ck => ck.includes(kw)))) { score += 2; break; }
  }

  // Channel match
  if (dominantChannel) {
    const chanKws = CHANNEL_TO_KEYWORDS[dominantChannel] ?? [];
    if (chanKws.some(kw => card.title.toLowerCase().includes(kw) || card.keywords.some(ck => ck.includes(kw)))) {
      score += 2;
    }
  }

  // Historical analog bonus
  if (card.historicalAnalog) score += 1;

  return score;
}

// ─── Diversity calculation ─────────────────────────────────────────────────────

function computeDiversity(cards: CorpusCard[]): number {
  if (cards.length < 2) return 100;
  const schools = new Set(cards.map(c => c.thinkingSchool));
  const classes = new Set(cards.map(c => c.framework));
  const schoolDiversity = schools.size >= 2 ? 60 : 0;
  const classDiversity = classes.size >= 2 ? 40 : 0;
  return schoolDiversity + classDiversity;
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(
  topCards: CorpusCard[],
  analog: { analog: string; analogAr: string } | null,
  ar: boolean,
): string {
  if (topCards.length === 0 && !analog) return "";

  const parts: string[] = [];

  if (topCards.length > 0) {
    const card = topCards[0];
    const lesson = ar
      ? `Institutional lesson: ${card.compression.slice(0, 80)}`
      : `Institutional lesson: ${card.compression.slice(0, 80)}`;
    parts.push(lesson);
  }

  if (analog) {
    const analogStr = ar
      ? `Historical analog: ${analog.analogAr}`
      : `Historical analog: ${analog.analog}`;
    parts.push(analogStr);
  }

  if (topCards.length >= 2 && topCards[1].competingView) {
    parts.push(`Competing school: ${topCards[1].competingView.slice(0, 60)}`);
  }

  return parts.join(" | ").slice(0, 200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeBookIntelligence(input: BookIntelligenceInput): BookIntelligenceResult {
  const { ar } = input;

  // Score all corpus cards
  const scored = CORPUS_CARDS
    .map(card => ({ card, score: scoreCorpusCard(card, input) }))
    .filter(s => s.score >= 2);

  if (scored.length === 0) {
    return {
      topCards: [],
      historicalAnalog: null,
      historicalAnalogAr: null,
      institutionalLesson: null,
      competingSchool: null,
      frameworkClass: null,
      qualityLabel: null,
      diversityScore: 0,
      contextString: "",
      hasKnowledge: false,
    };
  }

  // Sort by score, then diversify by school
  const sorted = scored.sort((a, b) => b.score - a.score);
  const top: CorpusCard[] = [];
  const seenSchools = new Set<string>();

  for (const { card } of sorted) {
    if (top.length >= 2) break;
    // Prefer different schools for diversity
    if (top.length === 1 && seenSchools.has(card.thinkingSchool)) continue;
    top.push(card);
    seenSchools.add(card.thinkingSchool);
  }

  // If we couldn't get 2 diverse cards, allow same school for the second slot
  if (top.length < 2 && sorted.length >= 2) {
    const fallback = sorted.find(s => !top.some(c => c.id === s.card.id));
    if (fallback) top.push(fallback.card);
  }

  // Detect historical analog
  const analog = detectAnalog(input);

  // Build outputs
  const topCard = top[0];
  const contextString = buildContextString(top, analog, ar);
  const diversityScore = computeDiversity(top);

  return {
    topCards: top,
    historicalAnalog: analog?.analog ?? null,
    historicalAnalogAr: analog?.analogAr ?? null,
    institutionalLesson: topCard?.compression.slice(0, 100) ?? null,
    competingSchool: top.find(c => c.competingView)?.competingView?.slice(0, 80) ?? null,
    frameworkClass: topCard?.framework ?? null,
    qualityLabel: topCard?.qualityLabel ?? null,
    diversityScore,
    contextString,
    hasKnowledge: contextString.length > 0,
  };
}
