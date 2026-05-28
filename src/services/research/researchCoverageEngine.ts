/**
 * Research Coverage Intelligence — Phase 31
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Determines which research topics deserve analytical attention and classifies
 * their relevance given the current question, regime, and portfolio context.
 *
 * Design rules:
 * - Deterministic: keyword matching only, no randomness
 * - Bounded: operates on call inputs only, no external state
 * - Advisory only: relevance labels are informational, not directives
 * - honest default: uncertain_relevance when nothing is detected
 * - No urgency language: must react / urgent / guaranteed are forbidden
 * - No polling: synchronous pure function
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RelevanceState =
  | "high_relevance"       // multiple macro factors + regime fit + portfolio link
  | "medium_relevance"     // meaningful topic match, partial portfolio link
  | "low_relevance"        // weak match, limited portfolio connection
  | "uncertain_relevance"; // no clear topic detected; coverage undetermined

export type ResearchTopic =
  | "monetary_policy"
  | "inflation_cpi"
  | "interest_rates"
  | "oil_commodities"
  | "macro_growth"
  | "labor_employment"
  | "liquidity_credit"
  | "market_stress"
  | "policy_regulatory"
  | "earnings_relevance"
  | "watchlist_relevance";

export interface CoverageTopic {
  topic: ResearchTopic;
  labelEn: string;
  labelAr: string;
  score: number;
}

export interface ResearchCoverageInput {
  question: string;
  regime: string;
  watchlistSymbols: string[];
  watchlistCategories: string[];
  ar: boolean;
}

export interface ResearchCoverageResult {
  relevanceState: RelevanceState;
  topicCount: number;
  topTopics: CoverageTopic[];
  primaryTopic: CoverageTopic | null;
  primaryReason: string;
  narrative: string;
  contextString: string;
  hasHighRelevance: boolean;
  hasMeaningfulCoverage: boolean;
}

// ─── Topic definitions ────────────────────────────────────────────────────────

interface TopicDef {
  topic: ResearchTopic;
  labelEn: string;
  labelAr: string;
  pattern: RegExp;
  baseScore: number;
  macroSensitiveCategories: string[];
}

const TOPIC_DEFS: TopicDef[] = [
  {
    topic: "monetary_policy",
    labelEn: "Monetary Policy",
    labelAr: "السياسة النقدية",
    pattern: /\b(fed|fomc|federal reserve|ecb|boe|boj|central bank|rate decision|rate meeting|monetary policy|policy decision|السياسة النقدية|البنك المركزي|الفيدرالي)\b/i,
    baseScore: 3,
    macroSensitiveCategories: ["equity", "crypto", "commodity", "forex", "macro", "us_stock", "saudi_stock"],
  },
  {
    topic: "inflation_cpi",
    labelEn: "Inflation / CPI",
    labelAr: "التضخم / مؤشر أسعار المستهلك",
    pattern: /\b(cpi|inflation|consumer price|pce|price level|deflation|stagflation|inflation data|التضخم|أسعار المستهلك)\b/i,
    baseScore: 2,
    macroSensitiveCategories: ["equity", "commodity", "macro", "us_stock", "saudi_stock"],
  },
  {
    topic: "interest_rates",
    labelEn: "Interest Rates / Yields",
    labelAr: "أسعار الفائدة / العوائد",
    pattern: /\b(interest rate|rate hike|rate cut|yield|treasury yield|bond yield|10y|2y yield|أسعار الفائدة|عوائد|سندات)\b/i,
    baseScore: 2,
    macroSensitiveCategories: ["equity", "macro", "forex", "us_stock", "saudi_stock"],
  },
  {
    topic: "oil_commodities",
    labelEn: "Oil & Commodities",
    labelAr: "النفط والسلع",
    pattern: /\b(oil|crude|wti|brent|opec|energy|commodity|commodities|نفط|خام|أوبك|سلع)\b/i,
    baseScore: 2,
    macroSensitiveCategories: ["commodity", "saudi_stock"],
  },
  {
    topic: "macro_growth",
    labelEn: "Macro Growth / PMI",
    labelAr: "النمو الكلي / مؤشرات الأعمال",
    pattern: /\b(gdp|pmi|growth|recession|contraction|manufacturing data|services pmi|economic growth|ناتج محلي|مؤشر مديري المشتريات|نمو|ركود)\b/i,
    baseScore: 2,
    macroSensitiveCategories: ["equity", "macro", "us_stock", "saudi_stock"],
  },
  {
    topic: "labor_employment",
    labelEn: "Labor / Employment",
    labelAr: "سوق العمل",
    pattern: /\b(employment|jobs|nfp|payroll|unemployment|labor market|jobs report|hiring|توظيف|وظائف|بطالة|سوق العمل)\b/i,
    baseScore: 1,
    macroSensitiveCategories: ["equity", "us_stock"],
  },
  {
    topic: "liquidity_credit",
    labelEn: "Liquidity / Credit",
    labelAr: "السيولة وأسواق الائتمان",
    pattern: /\b(liquidity|credit spread|hy spread|investment grade|ig spread|balance sheet|quantitative|m2|money supply|funding stress|سيولة|فروقات الائتمان)\b/i,
    baseScore: 2,
    macroSensitiveCategories: ["equity", "crypto", "macro", "us_stock", "saudi_stock"],
  },
  {
    topic: "market_stress",
    labelEn: "Market Stress",
    labelAr: "ضغط السوق",
    pattern: /\b(vix|volatility|stress|fear index|greed|financial stress|systemic|contagion|market stress|تقلب|ضغط السوق|مؤشر الخوف)\b/i,
    baseScore: 2,
    macroSensitiveCategories: ["equity", "crypto", "commodity", "us_stock"],
  },
  {
    topic: "policy_regulatory",
    labelEn: "Policy / Regulatory",
    labelAr: "السياسة والتنظيم",
    pattern: /\b(policy|regulation|sanction|tariff|fiscal|budget|tax|trade policy|سياسة|تنظيم|عقوبات|رسوم جمركية|ميزانية)\b/i,
    baseScore: 1,
    macroSensitiveCategories: ["equity", "us_stock", "saudi_stock"],
  },
  {
    topic: "earnings_relevance",
    labelEn: "Earnings",
    labelAr: "الأرباح",
    pattern: /\b(earnings|revenue|profit|quarterly|q1|q2|q3|q4|guidance|eps|أرباح|إيرادات|ربع سنوي)\b/i,
    baseScore: 1,
    macroSensitiveCategories: ["equity", "us_stock", "saudi_stock"],
  },
];

// ─── Regime sensitivity helper ────────────────────────────────────────────────

const MACRO_SENSITIVE_REGIMES = new Set([
  "risk_off", "macro_transition", "high_vol_risk-off", "bear_ranging",
  "defensive", "mixed",
]);

function isRegimeMacroSensitive(regime: string): boolean {
  return MACRO_SENSITIVE_REGIMES.has(regime);
}

// ─── Watchlist relevance detection ───────────────────────────────────────────

function detectWatchlistRelevance(
  question: string,
  symbols: string[],
  categories: string[],
): CoverageTopic | null {
  if (!symbols.length && !categories.length) return null;
  const q = question.toUpperCase();
  const symbolHit = symbols.some((s) => q.includes(s.toUpperCase()));
  const catHit = categories.length > 0 &&
    /\b(portfolio|watchlist|my holdings|my assets|my positions|محفظة|قائمة المراقبة|أصولي)\b/i.test(question);
  if (!symbolHit && !catHit) return null;
  return {
    topic: "watchlist_relevance",
    labelEn: "Watchlist Assets",
    labelAr: "أصول قائمة المراقبة",
    score: symbolHit ? 2 : 1,
  };
}

// ─── Relevance state from total score ─────────────────────────────────────────

function stateFromScore(score: number): RelevanceState {
  if (score >= 4) return "high_relevance";
  if (score >= 2) return "medium_relevance";
  if (score >= 1) return "low_relevance";
  return "uncertain_relevance";
}

// ─── Narrative builders ────────────────────────────────────────────────────────

function buildNarrative(
  state: RelevanceState,
  primaryTopic: CoverageTopic | null,
  ar: boolean,
): string {
  const topLabel = primaryTopic ? (ar ? primaryTopic.labelAr : primaryTopic.labelEn) : "";
  switch (state) {
    case "high_relevance":
      return ar
        ? `موضوعات بحثية متعددة ذات صلة (أبرزها: ${topLabel}) — ملاءمة تحليلية مرتفعة مع السياق الحالي.`
        : `Multiple research topics align with current context${topLabel ? ` (led by ${topLabel})` : ""} — analytical coverage appears warranted.`;
    case "medium_relevance":
      return ar
        ? `موضوع${topLabel ? ` ${topLabel}` : ""} ذو صلة معقولة — مراقبة مناسبة في ظل النظام الحالي.`
        : `${topLabel ? `${topLabel} ` : "Topic "}has reasonable relevance to current context — monitoring may be appropriate.`;
    case "low_relevance":
      return ar
        ? `الصلة البحثية محدودة — الموضوع ثانوي بالنسبة للمحفظة والنظام الحاليين.`
        : "Research relevance appears limited — topic is secondary relative to current portfolio and regime.";
    case "uncertain_relevance":
    default:
      return ar
        ? "لا يمكن تحديد الصلة البحثية بشكل واضح من السياق المتاح."
        : "Research relevance cannot be clearly determined from available context.";
  }
}

// ─── Context string builder ────────────────────────────────────────────────────

function buildContextString(
  state: RelevanceState,
  topTopics: CoverageTopic[],
  regime: string,
): string {
  if (state === "uncertain_relevance" || !topTopics.length) return "";
  const topicStr = topTopics.slice(0, 2).map((t) => t.topic.replace(/_/g, " ")).join("/");
  const regimePart = regime ? `; regime: ${regime.replace(/_/g, " ")}` : "";
  return `Research coverage: ${topicStr} — ${state.replace(/_/g, " ")}${regimePart}`.slice(0, 140);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeResearchCoverage(input: ResearchCoverageInput): ResearchCoverageResult {
  const { question, regime, watchlistSymbols, watchlistCategories, ar } = input;

  const detectedTopics: CoverageTopic[] = [];

  for (const def of TOPIC_DEFS) {
    if (!def.pattern.test(question)) continue;

    let score = def.baseScore;

    // Portfolio sensitivity boost: topic is relevant to watchlist categories
    const hasPortfolioLink = def.macroSensitiveCategories.some((cat) =>
      watchlistCategories.includes(cat),
    );
    if (hasPortfolioLink) score += 1;

    // Regime boost: macro-sensitive topic in risk_off/transition regime
    if (isRegimeMacroSensitive(regime) && def.baseScore >= 2) score += 1;

    detectedTopics.push({
      topic: def.topic,
      labelEn: def.labelEn,
      labelAr: def.labelAr,
      score,
    });
  }

  // Watchlist relevance detection (dynamic, based on actual symbols)
  const watchlistTopic = detectWatchlistRelevance(question, watchlistSymbols, watchlistCategories);
  if (watchlistTopic) detectedTopics.push(watchlistTopic);

  // Sort by score descending
  detectedTopics.sort((a, b) => b.score - a.score);

  const totalScore = detectedTopics.reduce((sum, t) => sum + t.score, 0);
  const relevanceState = stateFromScore(totalScore);
  const topTopics = detectedTopics.slice(0, 3);
  const primaryTopic = topTopics[0] ?? null;

  const primaryReason = primaryTopic
    ? (ar
        ? `${primaryTopic.labelAr} ذو الأولوية القصوى (نقاط: ${primaryTopic.score})`
        : `${primaryTopic.labelEn} is the highest-priority topic (score: ${primaryTopic.score})`)
    : (ar ? "لم يُكتشف موضوع محدد" : "No specific topic detected");

  const narrative = buildNarrative(relevanceState, primaryTopic, ar);
  const contextString = buildContextString(relevanceState, topTopics, regime);

  return {
    relevanceState,
    topicCount: detectedTopics.length,
    topTopics,
    primaryTopic,
    primaryReason,
    narrative,
    contextString,
    hasHighRelevance: relevanceState === "high_relevance",
    hasMeaningfulCoverage: relevanceState === "high_relevance" || relevanceState === "medium_relevance",
  };
}
