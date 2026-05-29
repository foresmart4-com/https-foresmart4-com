// Phase-83B Risk Closure: Genesis Quality Validation Harness
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Purpose: Fixed validation prompts and scoring for verifying Genesis answer quality
// across canonical investment question types. No dashboard required — this is a
// testing utility callable from tests or diagnostics.
//
// 7 canonical prompt categories with expected quality signals.
// 8 scoring dimensions:
//   1. knowledge_activation   — does the reply use grounded facts (numbers, names)?
//   2. causal_depth           — does it show X→Y→Z chains?
//   3. allocator_realism      — does it have a concrete allocator stance?
//   4. policy_linkage         — does it connect CB/SAMA to market outcomes?
//   5. historical_use         — does it reference relevant historical episodes?
//   6. thesis_clarity         — is there a directional, non-neutral thesis?
//   7. non_repetition         — no generic/repeated phrases?
//   8. usefulness             — is the answer actionable for an institutional allocator?
//
// Minimum passing threshold: 75/100 weighted.

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Canonical prompt types ────────────────────────────────────────────────────

export type ValidationPromptType =
  | "saudi_conservative_allocator"   // "conservative allocator, 12-24M, Saudi market"
  | "saudi_sector_winners_losers"    // "which Saudi sectors win/lose in current regime"
  | "us_market_outlook"              // "US market state and direction"
  | "oil_fed_linkage"                // "how does oil + Fed interact for equities"
  | "recession_vs_rate_cuts"         // "which sectors benefit from recession vs rate cuts"
  | "broad_vs_selective_exposure"    // "should I use broad ETF or selective names"
  | "valuation_vs_earnings";         // "is upside from multiple expansion or earnings growth"

export type ValidationDimensionId =
  | "knowledge_activation"
  | "causal_depth"
  | "allocator_realism"
  | "policy_linkage"
  | "historical_use"
  | "thesis_clarity"
  | "non_repetition"
  | "usefulness";

export interface ValidationDimension {
  id: ValidationDimensionId;
  score: number;     // 0-100
  weight: number;
  signals: string[];
  gaps: string[];
}

export interface ValidationResult {
  promptType: ValidationPromptType;
  totalScore: number;  // 0-100 weighted
  passed: boolean;     // total >= 75
  dimensions: ValidationDimension[];
  failedDimensions: ValidationDimensionId[];
  summary: string;
}

// ─── Canonical prompts ────────────────────────────────────────────────────────

export const CANONICAL_PROMPTS: Record<ValidationPromptType, { ar: string; en: string }> = {
  saudi_conservative_allocator: {
    ar: "إذا كنت مدير استثمار محافظ ولديك أفق 12–24 شهراً، كيف ستنظر إلى السوق السعودي حالياً؟",
    en: "As a conservative investment manager with a 12-24 month horizon, how would you view the Saudi market today?",
  },
  saudi_sector_winners_losers: {
    ar: "ما القطاعات السعودية التي تتفوق والأخرى التي تتراجع في النظام الاقتصادي الحالي؟",
    en: "Which Saudi market sectors are winning and which are losing in the current economic regime?",
  },
  us_market_outlook: {
    ar: "ما التوقعات للسوق الأمريكي والاتجاه المرجح للأشهر القادمة؟",
    en: "What is the US market outlook and likely direction for the coming months?",
  },
  oil_fed_linkage: {
    ar: "كيف يتفاعل سعر النفط مع سياسة الفيدرالي وما أثرهما المشترك على الأسواق؟",
    en: "How do oil prices and Fed policy interact, and what is their combined effect on equity markets?",
  },
  recession_vs_rate_cuts: {
    ar: "ما القطاعات التي تستفيد أكثر في سيناريو الركود مقابل سيناريو خفض الأسعار؟",
    en: "Which sectors benefit most in a recession scenario versus a rate-cut scenario?",
  },
  broad_vs_selective_exposure: {
    ar: "هل الأفضل استخدام تعرض واسع عبر مؤشر أم الانتقائية في النظام الحالي؟",
    en: "Is broad index exposure or selective positioning better in the current regime?",
  },
  valuation_vs_earnings: {
    ar: "هل الصعود المتوقع في السوق مدفوع بتوسع المضاعفات أم نمو الأرباح الفعلي؟",
    en: "Is the expected market upside driven by valuation multiple expansion or actual earnings growth?",
  },
};

// ─── Expected signals per prompt type ────────────────────────────────────────
// Patterns that SHOULD appear in a high-quality answer for each prompt type.

const EXPECTED_SIGNALS: Record<ValidationPromptType, { patterns: RegExp[]; critical: RegExp[] }> = {
  saudi_conservative_allocator: {
    patterns: [
      /aramco|أرامكو/i,
      /breakeven|نقطة\s*التعادل/i,
      /SAMA|sama|ربط/i,
      /→/g,
      /allocat|mخصص|wait|تدريجي|انتظار/i,
      /vision\s*2030|رؤية\s*2030/i,
    ],
    critical: [/aramco|أرامكو/i, /breakeven|نقطة\s*التعادل/i, /allocat|مخصص|stance|موقف/i],
  },
  saudi_sector_winners_losers: {
    patterns: [
      /aramco|أرامكو/i,
      /sabic|سابك|petrochem|بتروكيماوي/i,
      /bank|بنك|مصرف/i,
      /→|leads?\s+to|يؤدي/i,
      /winner|loser|outperform|رابح|خاسر|تفوق/i,
      /china|صين|oil\s+regime|نظام\s+النفط/i,
    ],
    critical: [/aramco|أرامكو/i, /sector|قطاع/i, /→|يؤدي|leads?\s+to/i],
  },
  us_market_outlook: {
    patterns: [
      /fed|federal|الفيدرالي/i,
      /rate|أسعار\s+الفائدة/i,
      /pe\s+ratio|mضاعف|earnings|أرباح/i,
      /→|transmission|يؤدي/i,
      /credit|spread|ائتمان/i,
      /regime|نظام/i,
    ],
    critical: [/fed|الفيدرالي/i, /→|يؤدي|transmission/i, /regime|نظام/i],
  },
  oil_fed_linkage: {
    patterns: [
      /→/g,
      /SAMA|saudi|سعود/i,
      /fiscal|مالي|breakeven|نقطة\s*التعادل/i,
      /dxy|dollar|دولار/i,
      /EM|emerging|ناشئة/i,
      /reaction\s+function|دالة\s+رد/i,
    ],
    critical: [/→/g, /fiscal|مالي/i, /fed|الفيدرالي/i],
  },
  recession_vs_rate_cuts: {
    patterns: [
      /defensive|دفاعي/i,
      /cyclical|دوري/i,
      /sector|قطاع/i,
      /rate\s+cut|خفض\s+الأسعار/i,
      /recession|ركود/i,
      /→|because|لأن|يؤدي/i,
    ],
    critical: [/defensive|دفاعي/i, /sector|قطاع/i, /→|because|لأن/i],
  },
  broad_vs_selective_exposure: {
    patterns: [
      /selective|انتقائي/i,
      /broad\s+index|ETF|واسع|مؤشر/i,
      /allocat|مخصص/i,
      /sector\s+differentiat|تمييز\s+قطاعي/i,
      /regime|نظام/i,
      /conviction|قناعة/i,
    ],
    critical: [/selective|انتقائي/i, /allocat|مخصص/i, /regime|نظام/i],
  },
  valuation_vs_earnings: {
    patterns: [
      /PE\s+expansion|multiple\s+expansion|توسع\s+المضاعف/i,
      /EPS|earnings\s+growth|نمو\s+الأرباح/i,
      /fragile|هش/i,
      /durable|مستدام/i,
      /→/g,
      /policy|سياسة\s+نقدية/i,
    ],
    critical: [/PE.*expansion|توسع.*مضاعف/i, /EPS|earnings\s+growth|نمو\s+الأرباح/i, /→|يؤدي/i],
  },
};

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreKnowledgeActivation(reply: GenesisReply, promptType: ValidationPromptType): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const allText = [reply.macroChain, reply.sectorLens, reply.outlook, reply.activatedKnowledge].filter(Boolean).join(" ");

  // Check for specific numbers (grounded facts)
  if (/\$\d+|\d+%|\d+x\b|\d+\s*bbl/i.test(allText)) { score += 35; signals.push("specific numbers found"); }
  else { gaps.push("no specific numbers or measurable thresholds"); }

  // activatedKnowledge field set
  if (reply.activatedKnowledge) { score += 30; signals.push("activatedKnowledge field set"); }
  else { gaps.push("activatedKnowledge absent"); }

  // Named entities
  const namedCount = (allText.match(/aramco|أرامكو|sabic|سابك|SAMA|الفيدرالي|vision\s*2030|رؤية\s*2030/gi) ?? []).length;
  if (namedCount >= 2) { score += 35; signals.push(`${namedCount} named entities`); }
  else if (namedCount === 1) { score += 18; signals.push("1 named entity"); gaps.push("more named entities needed"); }
  else { gaps.push("no named institutional entities"); }

  return { id: "knowledge_activation", score: Math.min(100, score), weight: 0.15, signals, gaps };
}

function scoreCausalDepth(reply: GenesisReply): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  const text = [reply.macroChain, reply.outlook, reply.bullCase, reply.bearCase, reply.secondOrderRisks].filter(Boolean).join(" ");

  const arrowCount = (text.match(/→/g) ?? []).length;
  const causalWords = (text.match(/leads?\s+to|يؤدي|because|لأن|therefore|من\s+خلال\s+قناة/gi) ?? []).length;
  const total = arrowCount + causalWords;

  let score = 0;
  if (total >= 6) { score = 100; signals.push(`strong causal density (${total} hits)`); }
  else if (total >= 3) { score = 70; signals.push(`moderate causal density (${total} hits)`); }
  else if (total >= 1) { score = 40; gaps.push(`weak causal density (${total} hits)`); }
  else { gaps.push("no causal language found"); }

  if (reply.secondOrderRisks) { score = Math.min(100, score + 10); signals.push("secondOrderRisks present"); }
  else { gaps.push("no second-order effects"); }

  return { id: "causal_depth", score, weight: 0.15, signals, gaps };
}

function scoreAllocatorRealism(reply: GenesisReply): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (reply.committeeStance) { score += 30; signals.push(`committeeStance=${reply.committeeStance}`); }
  else { gaps.push("committeeStance absent"); }

  if (reply.committeeSynthesis?.finalStance) { score += 30; signals.push("final committee stance present"); }
  else { gaps.push("no final committee stance"); }

  const allocText = reply.voiceReasoning?.allocator ?? "";
  if (allocText.length > 60) { score += 25; signals.push("allocator voice has substantive content"); }
  else { gaps.push("allocator voice absent or thin"); }

  if (reply.valuationEarningsView) { score += 15; signals.push("valuationEarningsView present"); }
  else { gaps.push("valuationEarningsView absent"); }

  return { id: "allocator_realism", score: Math.min(100, score), weight: 0.15, signals, gaps };
}

function scorePolicyLinkage(reply: GenesisReply): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  const text = [reply.macroChain, reply.voiceReasoning?.policy, reply.outlook, reply.bullCase].filter(Boolean).join(" ");
  let score = 0;

  const hasCB = /fed|federal|sama|الفيدرالي|المركزي|central\s+bank/i.test(text);
  if (hasCB) { score += 30; signals.push("central bank referenced"); }
  else { gaps.push("no central bank reference"); }

  const hasMechanism = /reaction\s+function|دالة\s+رد|peg|ربط|mirrors?\s+fed|تتبع\s+الفيدرالي|if.{0,40}(fed|rate)|→.*rate|أسعار.*→/i.test(text);
  if (hasMechanism) { score += 40; signals.push("policy mechanism or reaction function present"); }
  else { gaps.push("no policy transmission mechanism"); }

  const hasTransmission = /→/.test(text) && hasCB;
  if (hasTransmission) { score += 30; signals.push("policy transmission chain detected"); }
  else if (!hasTransmission && hasCB) { gaps.push("CB mentioned but no transmission chain"); }

  return { id: "policy_linkage", score: Math.min(100, score), weight: 0.12, signals, gaps };
}

function scoreHistoricalUse(reply: GenesisReply): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  const text = [
    reply.voiceReasoning?.historical,
    reply.perspectiveMap,
    reply.macroChain,
  ].filter(Boolean).join(" ");
  let score = 0;

  const hasHistorical = /\b(1986|2008|2014|2016|2020|2022|covid|gfc|stagflat|1970|volcker|analog|prior\s+cycle|تاريخي|أنالوغ|دورة\s+سابقة)/i.test(text);
  if (hasHistorical) { score += 50; signals.push("historical reference found"); }
  else { gaps.push("no historical analog or cycle reference"); }

  const hasDifferentiator = /different\s+this\s+time|what\s+is\s+different|ما\s+يختلف\s+هذه\s+المرة|unlike|unlike\s+the/i.test(text);
  if (hasDifferentiator) { score += 30; signals.push("what-is-different this time acknowledged"); }
  else if (hasHistorical) { gaps.push("historical used but no 'what is different this time' caveat"); }

  if (reply.voiceReasoning?.historical) { score += 20; signals.push("historical voice reasoning set"); }
  else { gaps.push("no historical voice reasoning"); }

  return { id: "historical_use", score: Math.min(100, score), weight: 0.10, signals, gaps };
}

function scoreThesisClarity(reply: GenesisReply): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const isNeutral = !reply.thesis ||
    /neutral|uncertain|unclear|mixed|غير\s+واضح|محايد|متذبذب/i.test(reply.thesis);

  if (reply.thesis && !isNeutral) { score += 35; signals.push("directional thesis present"); }
  else if (reply.thesis) { score += 10; gaps.push("thesis present but generic/neutral"); }
  else { gaps.push("thesis absent"); }

  if (reply.bullCase && reply.bearCase) { score += 25; signals.push("both bull and bear cases"); }
  else { gaps.push("missing one or both bull/bear cases"); }

  if (reply.thesisChanger) { score += 20; signals.push("thesisChanger present"); }
  else { gaps.push("thesisChanger absent"); }

  if (reply.baseCase) { score += 20; signals.push("baseCase present"); }
  else { gaps.push("baseCase absent"); }

  return { id: "thesis_clarity", score: Math.min(100, score), weight: 0.15, signals, gaps };
}

function scoreNonRepetition(reply: GenesisReply): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 100;

  const FILLER = [
    /monitor\s+the\s+market/gi, /significant\s+uncertainty/gi,
    /investors\s+should\s+watch/gi, /generally\s+(bullish|bearish)/gi,
    /conditions\s+remain/gi, /السوق\s+متذبذب(?!\s*→|\s*بسبب|\s*لأن)/gi,
    /النفط\s+يؤثر(?!\s*على\s+\w+\s+من\s+خلال|\s*→)/gi,
  ];

  const text = [reply.headline, reply.outlook, reply.macroChain].filter(Boolean).join(" ");
  let hits = 0;
  for (const p of FILLER) {
    if (new RegExp(p.source, p.flags.replace("g","")).test(text)) { hits++; score -= 15; }
  }

  if (hits === 0) signals.push("no generic filler phrases");
  else { gaps.push(`${hits} filler phrase(s) detected without causal follow-up`); }

  return { id: "non_repetition", score: Math.max(0, score), weight: 0.10, signals, gaps };
}

function scoreUsefulness(reply: GenesisReply, promptType: ValidationPromptType): ValidationDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const { patterns, critical } = EXPECTED_SIGNALS[promptType];
  const allText = [reply.headline, reply.outlook, reply.sectorLens, reply.macroChain,
    reply.bullCase, reply.bearCase, reply.baseCase, reply.thesis].filter(Boolean).join(" ");

  const patternHits = patterns.filter(p => { p.lastIndex = 0; return p.test(allText); }).length;
  score = Math.round((patternHits / patterns.length) * 60);
  signals.push(`${patternHits}/${patterns.length} expected signals present`);

  // Critical signals are mandatory
  const criticalMissing = critical.filter(p => { p.lastIndex = 0; return !p.test(allText); });
  if (criticalMissing.length === 0) { score += 40; signals.push("all critical signals present"); }
  else { score -= 20 * criticalMissing.length; gaps.push(`${criticalMissing.length} critical signal(s) absent`); }

  return { id: "usefulness", score: Math.max(0, Math.min(100, score)), weight: 0.08, signals, gaps };
}

// ─── Main harness function ────────────────────────────────────────────────────

const PASS_THRESHOLD = 75;

/**
 * Validates a GenesisReply against the canonical quality expectations for a given
 * prompt type. Returns a structured ValidationResult with per-dimension scores.
 * Pure O(1) — no AI calls, no network.
 */
export function validateGenesisReply(
  reply: GenesisReply,
  promptType: ValidationPromptType,
): ValidationResult {
  const dimensions: ValidationDimension[] = [
    scoreKnowledgeActivation(reply, promptType),
    scoreCausalDepth(reply),
    scoreAllocatorRealism(reply),
    scorePolicyLinkage(reply),
    scoreHistoricalUse(reply),
    scoreThesisClarity(reply),
    scoreNonRepetition(reply),
    scoreUsefulness(reply, promptType),
  ];

  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  const passed = totalScore >= PASS_THRESHOLD;
  const failedDimensions = dimensions
    .filter(d => d.score < 50)
    .map(d => d.id);

  const summary = passed
    ? `PASS (${totalScore}/100): ${promptType.replace(/_/g, " ")} answer meets institutional quality bar.`
    : `FAIL (${totalScore}/100): ${promptType.replace(/_/g, " ")} — ${failedDimensions.join(", ")} below threshold.`;

  return { promptType, totalScore, passed, dimensions, failedDimensions, summary };
}

/**
 * Runs the validation harness against all 7 canonical prompt types using a single reply.
 * Useful for batch quality assessment without live AI calls.
 */
export function runValidationSuite(
  reply: GenesisReply,
): Record<ValidationPromptType, ValidationResult> {
  const results = {} as Record<ValidationPromptType, ValidationResult>;
  const types: ValidationPromptType[] = [
    "saudi_conservative_allocator", "saudi_sector_winners_losers",
    "us_market_outlook", "oil_fed_linkage", "recession_vs_rate_cuts",
    "broad_vs_selective_exposure", "valuation_vs_earnings",
  ];
  for (const t of types) {
    results[t] = validateGenesisReply(reply, t);
  }
  return results;
}

/**
 * Returns the expected minimum per-dimension score for a passing answer.
 */
export function getPassingThreshold(): number {
  return PASS_THRESHOLD;
}

// ─── Phase-84A: Mandatory gate additions ─────────────────────────────────────

const MANDATORY_GATE_THRESHOLD = 80;
const INSUFFICIENT_EVIDENCE_THRESHOLD = 65;

/** Auto-detect the best matching ValidationPromptType for a question string. */
export function detectValidationPromptType(question: string): ValidationPromptType {
  const q = question.toLowerCase();
  if (/conservat|محافظ|12.{0,5}24|مدير\s+استثمار/.test(q) && /saudi|tasi|سعود|تاسي/.test(q)) return "saudi_conservative_allocator";
  if (/sector|قطاع|winner|loser|رابح|خاسر/.test(q) && /saudi|tasi|سعود|تاسي/.test(q)) return "saudi_sector_winners_losers";
  if (/\b(us|s&p|nasdaq|dow|american)\b/.test(q)) return "us_market_outlook";
  if (/oil.{0,20}fed|fed.{0,20}oil|نفط.{0,20}فائدة|فائدة.{0,20}نفط/.test(q)) return "oil_fed_linkage";
  if (/recession|rate\s+cut|ركود|خفض\s+الفائدة/.test(q)) return "recession_vs_rate_cuts";
  if (/broad|etf|واسع|مؤشر|selective|انتقائي/.test(q)) return "broad_vs_selective_exposure";
  if (/valuation|earning|تقييم|أرباح|PE|EPS|مضاعف/.test(q)) return "valuation_vs_earnings";
  return "saudi_conservative_allocator"; // default for unclassified investment questions
}

export type MandatoryGateLabel =
  | "pass"
  | "repair_required"
  | "insufficient_evidence";

export interface MandatoryGateResult {
  label: MandatoryGateLabel;
  score: number;
  passed: boolean;
  promptType: ValidationPromptType;
  failedDimensions: ValidationDimensionId[];
  repairNeeded: boolean;
}

/**
 * Mandatory governance gate for serious investment questions.
 * Score < 80 → repair_required.
 * Score < 65 after repair → insufficient_evidence.
 * Pure O(1) — no AI calls, no network.
 */
export function runMandatoryGate(
  reply: GenesisReply,
  question: string,
): MandatoryGateResult {
  const promptType = detectValidationPromptType(question);
  const result = validateGenesisReply(reply, promptType);

  let label: MandatoryGateLabel;
  if (result.totalScore >= MANDATORY_GATE_THRESHOLD) {
    label = "pass";
  } else if (result.totalScore >= INSUFFICIENT_EVIDENCE_THRESHOLD) {
    label = "repair_required";
  } else {
    label = "insufficient_evidence";
  }

  return {
    label,
    score: result.totalScore,
    passed: label === "pass",
    promptType,
    failedDimensions: result.failedDimensions,
    repairNeeded: label !== "pass",
  };
}
