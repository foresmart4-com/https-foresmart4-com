// Phase-86A: Policy Intelligence Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM crossMarketFusion.ts (Phase-67):
//   crossMarketFusion: rate DIRECTION narrative (which way are rates going?)
//   policyIntelligenceEngine: CB language CLASSIFICATION and policy REGIME detection
//   — is the CB hawkish/dovish/data-dependent? Where are we in the policy cycle?
//
// Covers: Federal Reserve, SAMA (Saudi Arabian Monetary Authority), ECB
//
// Policy language tier:
//   hawkish_explicit:    "we must remain restrictive", "long enough"
//   hawkish_lean:        "data dependent", "sufficiently restrictive"
//   neutral:             "balanced", "monitor", "assess"
//   dovish_lean:         "flexible", "consider", "watching conditions"
//   dovish_explicit:     "will ease", "lower rates", "support growth"
//   pivot_signal:        "when confident", "conditions permitting", "appropriate to reduce"
//
// Policy regime:
//   tightening_cycle / easing_cycle / on_hold / pre_pivot / uncertain
//
// SAMA linkage: SAMA follows Fed via SAR peg — explicitly modelled.
//
// Policy surprise score (0-100): how much does the detected language deviate
// from what the prior question context expected?
//
// No polling. Operates on text already in the request context.
// Educational/advisory only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CBLanguageTier =
  | "hawkish_explicit"
  | "hawkish_lean"
  | "neutral"
  | "dovish_lean"
  | "dovish_explicit"
  | "pivot_signal";

export type PolicyRegime =
  | "tightening_cycle"
  | "easing_cycle"
  | "on_hold"
  | "pre_pivot"
  | "uncertain";

export type CBIdentity = "fed" | "ecb" | "sama" | "boe" | "boj" | "unknown";

export interface PolicySignal {
  cb:            CBIdentity;
  languageTier:  CBLanguageTier;
  policyRegime:  PolicyRegime;
  surpriseScore: number;    // 0-100: how unexpected is this signal?
  samaMechanism: string;    // compact SAMA-Fed linkage note (empty if not Saudi-relevant)
  rationale:     string;    // ≤100 chars: why this classification
}

export interface PolicyIntelligenceResult {
  signals:         PolicySignal[];
  dominantSignal:  PolicySignal | null;
  policyContext:   string;   // injectable ≤280 chars
  isSaudiRelevant: boolean;
}

// ─── CB detection patterns ────────────────────────────────────────────────────

const CB_PATTERNS: Array<{ cb: CBIdentity; pattern: RegExp }> = [
  { cb: "fed",  pattern: /\b(fed|federal reserve|fomc|jerome powell|fed chair)\b/i },
  { cb: "ecb",  pattern: /\b(ecb|european central bank|draghi|lagarde|ecb president)\b/i },
  { cb: "sama", pattern: /\b(sama|saudi arabian monetary|saudi central bank)\b/i },
  { cb: "boe",  pattern: /\b(bank of england|boe|mpc|bailey)\b/i },
  { cb: "boj",  pattern: /\b(bank of japan|boj|kuroda|ueda|boj governor)\b/i },
];

// ─── Policy language patterns ─────────────────────────────────────────────────

interface PolicyLangRule {
  tier: CBLanguageTier;
  patterns: RegExp[];
  score: number;  // contribution to language tier score
}

const LANG_RULES: PolicyLangRule[] = [
  {
    tier: "hawkish_explicit",
    patterns: [
      /\b(remain restrictive|sufficiently restrictive|keep rates high|no cuts|no easing|long enough|must stay tight)\b/i,
      /\b(رافعون|تشديد واضح|لا خفض|السياسة المقيدة)\b/i,
    ],
    score: 30,
  },
  {
    tier: "hawkish_lean",
    patterns: [
      /\b(data dependent|watching inflation|inflation not beaten|need more evidence|still elevated|patient|more work to do)\b/i,
      /\b(بيانات|انتظار|تضخم لم يُهزم|بيانات قبل الخفض)\b/i,
    ],
    score: 20,
  },
  {
    tier: "pivot_signal",
    patterns: [
      /\b(when confident|confidence that inflation|conditions permitting|appropriate to reduce|time to cut|beginning to ease|cuts likely|pivot signal|signals? rate cuts?|rate cuts? ahead|rate cuts? expected|approaching 2%)\b/i,
      /\b(عند الثقة|شروط السماح|التحول|وقت الخفض|الخفض قريب|تحول السياسة)\b/i,
    ],
    score: 25,
  },
  {
    tier: "dovish_lean",
    patterns: [
      /\b(flexible|watching labor|financial conditions|adjust policy|consider cut|ready to ease|supportive|approaching target|inflation at target|inflation near target|inflation goal|inflation target met)\b/i,
      /\b(مرن|يراقب|يدرس|مستعد للتيسير|يقترب من الهدف)\b/i,
    ],
    score: 20,
  },
  {
    tier: "dovish_explicit",
    patterns: [
      /\b(will ease|will lower|will cut|rate cut confirmed|easing begins|rate reduction|cutting rates|rate cuts? signal|signals? easing|signals? cut)\b/i,
      /\b(سيخفض|التيسير بدأ|خفض مؤكد|تخفيض الفائدة)\b/i,
    ],
    score: 30,
  },
  {
    tier: "neutral",
    patterns: [
      /\b(balanced risk|monitor developments|assess|watch|maintain|hold rates|pause)\b/i,
      /\b(متوازن|مراقبة|تقييم|الإبقاء|ثبات)\b/i,
    ],
    score: 15,
  },
];

function classifyLanguageTier(text: string): { tier: CBLanguageTier; score: number } {
  const tierScores: Partial<Record<CBLanguageTier, number>> = {};

  for (const rule of LANG_RULES) {
    const hits = rule.patterns.filter(p => p.test(text)).length;
    if (hits > 0) {
      tierScores[rule.tier] = (tierScores[rule.tier] ?? 0) + hits * rule.score;
    }
  }

  const best = Object.entries(tierScores)
    .sort(([, a], [, b]) => b - a)[0];

  return best
    ? { tier: best[0] as CBLanguageTier, score: best[1] }
    : { tier: "neutral", score: 0 };
}

// ─── Policy regime detection ──────────────────────────────────────────────────

const REGIME_PATTERNS: Array<{ regime: PolicyRegime; pattern: RegExp; score: number }> = [
  { regime: "tightening_cycle", pattern: /\b(tighten|hiking|raised rates|hike cycle|restrictive|rate rise cycle|tightening)\b/i, score: 25 },
  { regime: "easing_cycle",     pattern: /\b(cutting|easing|lowered rates|cut cycle|rate cut cycle|easing cycle)\b/i,           score: 25 },
  { regime: "on_hold",          pattern: /\b(on hold|pause|hold rates|no change|steady|unchanged rates)\b/i,                    score: 20 },
  { regime: "pre_pivot",        pattern: /\b(pivot|approaching pivot|near pivot|end of cycle|last hike|first cut)\b/i,          score: 22 },
];

function detectPolicyRegime(text: string, langTier: CBLanguageTier): PolicyRegime {
  const scores: Partial<Record<PolicyRegime, number>> = {};

  for (const { regime, pattern, score } of REGIME_PATTERNS) {
    if (pattern.test(text)) {
      scores[regime] = (scores[regime] ?? 0) + score;
    }
  }

  // Language tier informs regime
  if (langTier === "hawkish_explicit" || langTier === "hawkish_lean") {
    scores.tightening_cycle = (scores.tightening_cycle ?? 0) + 10;
  } else if (langTier === "dovish_explicit" || langTier === "dovish_lean") {
    scores.easing_cycle = (scores.easing_cycle ?? 0) + 10;
  } else if (langTier === "pivot_signal") {
    scores.pre_pivot = (scores.pre_pivot ?? 0) + 15;
  } else if (langTier === "neutral") {
    scores.on_hold = (scores.on_hold ?? 0) + 8;
  }

  const best = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return (best?.[0] as PolicyRegime) ?? "uncertain";
}

// ─── Surprise score ───────────────────────────────────────────────────────────

function computeSurpriseScore(text: string, detectedTier: CBLanguageTier): number {
  // Surprise = discrepancy between "expected" (prior context) and "detected" (actual language)
  const expectedHawkish = /\b(expected to ease|expected to cut|market pricing cut|rate cut priced|cut expected)\b/i.test(text);
  const expectedDovish  = /\b(expected to hike|expected to raise|more hikes|hike expected|tightening priced)\b/i.test(text);

  if (expectedHawkish && (detectedTier === "hawkish_explicit" || detectedTier === "hawkish_lean")) return 60;
  if (expectedDovish  && (detectedTier === "dovish_explicit"  || detectedTier === "dovish_lean"))  return 60;
  if (expectedHawkish && (detectedTier === "dovish_explicit"  || detectedTier === "dovish_lean"))  return 30;
  if (expectedDovish  && (detectedTier === "hawkish_explicit" || detectedTier === "hawkish_lean")) return 30;
  if (detectedTier === "pivot_signal") return 40;  // pivots are inherently surprising
  return 0;
}

// ─── SAMA linkage ─────────────────────────────────────────────────────────────

const SAMA_NOTE: Record<CBLanguageTier, string> = {
  hawkish_explicit:  "SAMA follows Fed via SAR peg — rate hike transmits mechanically; Saudi mortgage cost rises, real estate softens.",
  hawkish_lean:      "SAMA likely follows Fed higher; Saudi banks NIM expands short-term; mortgage demand cools.",
  neutral:           "SAMA on hold following Fed; SAR peg stable; Saudi banks NIM relatively stable.",
  dovish_lean:       "SAMA poised to follow Fed lower; Saudi banks NIM at risk of compression; mortgage demand may recover.",
  dovish_explicit:   "SAMA cuts follow Fed; Saudi bank NIM compresses; real estate demand likely recovers; SAR peg secure.",
  pivot_signal:      "SAMA pivot follows Fed; transition from NIM expansion to compression; Saudi mortgage inflection ahead.",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildPolicyIntelligence(
  question: string,
  ctx: string,
  regime?: string,
): PolicyIntelligenceResult {
  const text = `${question} ${ctx}`;
  const signals: PolicySignal[] = [];
  const isSaudiRelevant = /\b(saudi|tasi|sama|aramco|sar|riyal|خليج|سعودي|أرامكو)\b/i.test(text);

  for (const { cb, pattern } of CB_PATTERNS) {
    if (!pattern.test(text)) continue;

    const { tier, score } = classifyLanguageTier(text);
    // Allow tier-1 CBs (fed, ecb) through even with low score — presence alone is signal
    if (score === 0 && !["fed","ecb","sama"].includes(cb)) continue;

    const policyRegime = detectPolicyRegime(text, tier);
    const surpriseScore = computeSurpriseScore(text, tier);
    const samaMechanism = (cb === "fed" || cb === "sama") && isSaudiRelevant
      ? SAMA_NOTE[tier]
      : "";

    const rationale = `${cb.toUpperCase()} language: ${tier.replace(/_/g, " ")} | regime: ${policyRegime.replace(/_/g, " ")}`.slice(0, 100);

    signals.push({ cb, languageTier: tier, policyRegime, surpriseScore, samaMechanism, rationale });
  }

  // If no CB detected but policy language found, add generic
  if (signals.length === 0) {
    const { tier, score } = classifyLanguageTier(text);
    if (score > 0) {
      const policyRegime = detectPolicyRegime(text, tier);
      signals.push({
        cb: "unknown", languageTier: tier, policyRegime, surpriseScore: computeSurpriseScore(text, tier),
        samaMechanism: isSaudiRelevant ? SAMA_NOTE[tier] : "",
        rationale: `Policy language detected: ${tier.replace(/_/g, " ")} | ${policyRegime.replace(/_/g, " ")}`,
      });
    }
  }

  if (signals.length === 0) {
    return { signals: [], dominantSignal: null, policyContext: "", isSaudiRelevant };
  }

  const dominant = signals[0];
  const samaSuffix = dominant.samaMechanism
    ? ` | SAMA: ${dominant.samaMechanism.slice(0, 80)}`
    : "";
  const surpriseSuffix = dominant.surpriseScore >= 40
    ? ` | Policy surprise: ${dominant.surpriseScore}/100`
    : "";

  const policyContext = [
    `Policy intelligence [${signals.map(s => s.cb).join("+")}]:`,
    `${dominant.cb.toUpperCase()} ${dominant.languageTier.replace(/_/g, " ")} → ${dominant.policyRegime.replace(/_/g, " ")}`,
    samaSuffix,
    surpriseSuffix,
  ].filter(Boolean).join(" ").slice(0, 280);

  return { signals, dominantSignal: dominant, policyContext, isSaudiRelevant };
}
