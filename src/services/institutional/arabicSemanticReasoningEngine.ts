// Phase-85A: Arabic Semantic Reasoning Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Provides structured Arabic investment cognition beyond regex-only matching.
// Approach: weighted vocabulary scoring per semantic domain.
//   • Each domain has primary tokens (exact) + stem tokens (includes-match)
//   • Weights 1-3 per token; domain activates above configurable threshold
//   • Handles Arabic morphology: definite article (ال), common root forms,
//     Arabic-Indic numerals, and key compound terms
//
// Covers: direction, conviction, policy, oil/fiscal, allocation, regime,
//         uncertainty, sector differentiation, invalidation language.
//
// Educational/advisory only. No autonomous trading. No broker data.

import type {
  DirectionSemantic,
  ConvictionTier,
  PolicySemantic,
  OilSemantic,
  AllocationSemantic,
  SemanticProfile,
} from "./semanticOutcomeEngine";

// ─── Vocabulary infrastructure ────────────────────────────────────────────────

interface TokenRule {
  token: string;
  weight: number;
  stem?: boolean; // if true, use includes(); if false (default), use word-boundary match
}

function scoreText(text: string, rules: TokenRule[]): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const { token, weight, stem } of rules) {
    const tok = token.toLowerCase();
    if (stem) {
      if (t.includes(tok)) score += weight;
    } else {
      // Word-boundary: check space/start/end/punctuation around token
      const re = new RegExp(`(^|[\\s،,؛;.!?])${tok}([\\s،,؛;.!?]|$)`, "u");
      if (re.test(t) || t.startsWith(tok) || t.endsWith(tok) || t.includes(tok)) score += weight;
    }
  }
  return score;
}

// ─── Direction ────────────────────────────────────────────────────────────────

const BULLISH_TOKENS: TokenRule[] = [
  { token: "صاعد",         weight: 3 },
  { token: "إيجابي",       weight: 2 },
  { token: "تفاؤل",        weight: 2 },
  { token: "بنّاء",        weight: 2, stem: true },
  { token: "بناء",         weight: 2, stem: true },
  { token: "فرصة شراء",   weight: 3, stem: true },
  { token: "انتعاش",       weight: 2, stem: true },
  { token: "ارتفاع",       weight: 1, stem: true },
  { token: "نمو",          weight: 1 },
  { token: "تعافي",        weight: 2, stem: true },
  { token: "زيادة التعرض", weight: 3, stem: true },
  { token: "شراء تدريجي", weight: 3, stem: true },
  { token: "قوي",          weight: 1 },
  { token: "مرتفع",        weight: 1 },
  { token: "إضافة",        weight: 1, stem: true },
  { token: "فرصة",         weight: 1, stem: true },
];

const BEARISH_TOKENS: TokenRule[] = [
  { token: "هابط",         weight: 3 },
  { token: "سلبي",         weight: 2 },
  { token: "تراجع",        weight: 2, stem: true },
  { token: "مخاوف",        weight: 1, stem: true },
  { token: "ضغط",          weight: 1, stem: true },
  { token: "انخفاض",       weight: 1, stem: true },
  { token: "بيع",          weight: 2, stem: true },
  { token: "تجنب",         weight: 3, stem: true },
  { token: "حذر",          weight: 2, stem: true },
  { token: "مخاطر",        weight: 1, stem: true },
  { token: "دفاعي",        weight: 2, stem: true },
  { token: "ضعف",          weight: 1, stem: true },
  { token: "خفض التعرض",  weight: 3, stem: true },
  { token: "تخفيض",        weight: 2, stem: true },
];

const NEUTRAL_TOKENS: TokenRule[] = [
  { token: "محايد",         weight: 3 },
  { token: "انتظار",        weight: 2, stem: true },
  { token: "تقييم",         weight: 1, stem: true },
  { token: "متذبذب",        weight: 2, stem: true },
  { token: "غير واضح",     weight: 2, stem: true },
  { token: "توازن",         weight: 1, stem: true },
  { token: "مراقبة",        weight: 1, stem: true },
];

export function detectArabicDirection(text: string): DirectionSemantic {
  if (!text || !/[؀-ۿ]/.test(text)) return "unknown";
  const bull = scoreText(text, BULLISH_TOKENS);
  const bear = scoreText(text, BEARISH_TOKENS);
  const neut = scoreText(text, NEUTRAL_TOKENS);

  if (bull === 0 && bear === 0 && neut === 0) return "unknown";
  if (bull > bear + neut && bull >= 3) return "bullish";
  if (bear > bull + neut && bear >= 3) return "bearish";
  if (bull >= 2 && bear >= 2) return "conflicted";
  if (neut >= 3) return "neutral";
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

// ─── Conviction ───────────────────────────────────────────────────────────────

const HIGH_CONVICTION_TOKENS: TokenRule[] = [
  { token: "قناعة عالية",   weight: 3, stem: true },
  { token: "واثق",          weight: 2 },
  { token: "حاسم",          weight: 2, stem: true },
  { token: "مؤكد",          weight: 2, stem: true },
  { token: "واضح",          weight: 1 },
  { token: "قوي",           weight: 1 },
  { token: "راسخ",          weight: 2, stem: true },
];

const LOW_CONVICTION_TOKENS: TokenRule[] = [
  { token: "قناعة منخفضة", weight: 3, stem: true },
  { token: "غير مؤكد",     weight: 2, stem: true },
  { token: "تحفظ",          weight: 2, stem: true },
  { token: "تردد",          weight: 2, stem: true },
  { token: "ضعيف",          weight: 2, stem: true },
  { token: "محدود",         weight: 1, stem: true },
];

export function detectArabicConviction(text: string, confidenceScore?: number): ConvictionTier {
  if (!text || !/[؀-ۿ]/.test(text)) {
    if (confidenceScore !== undefined) {
      if (confidenceScore >= 68) return "high";
      if (confidenceScore >= 50) return "moderate";
      if (confidenceScore >= 35) return "low";
      return "insufficient";
    }
    return "unknown" as ConvictionTier;
  }

  const high = scoreText(text, HIGH_CONVICTION_TOKENS);
  const low  = scoreText(text, LOW_CONVICTION_TOKENS);

  if (high >= 3 && high > low) return "high";
  if (low  >= 3 && low  > high) return "low";
  if (high >= 2 || low >= 2) return "moderate";

  // Fall back to confidence score if vocabulary is thin
  if (confidenceScore !== undefined) {
    if (confidenceScore >= 68) return "high";
    if (confidenceScore >= 50) return "moderate";
    if (confidenceScore >= 35) return "low";
    return "insufficient";
  }

  return "moderate";
}

// ─── Policy stance ────────────────────────────────────────────────────────────

const EASING_TOKENS: TokenRule[] = [
  { token: "تيسير",         weight: 3, stem: true },
  { token: "تخفيف",         weight: 2, stem: true },
  { token: "خفض الفائدة",  weight: 3, stem: true },
  { token: "تخفيض الأسعار",weight: 3, stem: true },
  { token: "تحفيز",         weight: 2, stem: true },
  { token: "ميسّر",         weight: 2, stem: true },
  { token: "تيسيرية",       weight: 3, stem: true },
];

const TIGHTENING_TOKENS: TokenRule[] = [
  { token: "تشديد",         weight: 3, stem: true },
  { token: "رفع الفائدة",  weight: 3, stem: true },
  { token: "تقييد",         weight: 2, stem: true },
  { token: "تضييق",         weight: 2, stem: true },
  { token: "انكماشية",      weight: 3, stem: true },
  { token: "رفع الأسعار",  weight: 2, stem: true },
];

const HOLDING_TOKENS: TokenRule[] = [
  { token: "ثبات",          weight: 3, stem: true },
  { token: "استقرار",       weight: 2, stem: true },
  { token: "التثبيت",       weight: 3, stem: true },
  { token: "لم يتغير",     weight: 3, stem: true },
  { token: "الإبقاء على",  weight: 2, stem: true },
  { token: "بلا تغيير",   weight: 2, stem: true },
];

const PIVOT_TOKENS: TokenRule[] = [
  { token: "تحوّل",         weight: 3, stem: true },
  { token: "تحول",          weight: 2, stem: true },
  { token: "انعطاف",        weight: 3, stem: true },
  { token: "مفترق طرق",    weight: 2, stem: true },
  { token: "إشارة التحول", weight: 3, stem: true },
];

export function detectArabicPolicyStance(text: string): PolicySemantic {
  if (!text || !/[؀-ۿ]/.test(text)) return "unknown";
  const pivot = scoreText(text, PIVOT_TOKENS);
  const ease  = scoreText(text, EASING_TOKENS);
  const tight = scoreText(text, TIGHTENING_TOKENS);
  const hold  = scoreText(text, HOLDING_TOKENS);

  const max = Math.max(pivot, ease, tight, hold);
  if (max === 0) return "unknown";
  if (max === pivot && pivot >= 2) return "pivot_expected";
  if (max === ease  && ease  >= 2) return "easing_expected";
  if (max === tight && tight >= 2) return "tightening_expected";
  if (max === hold  && hold  >= 2) return "holding";
  return "unknown";
}

// ─── Oil / fiscal signal ──────────────────────────────────────────────────────

const ABOVE_BREAKEVEN_TOKENS: TokenRule[] = [
  { token: "فوق نقطة التعادل",   weight: 3, stem: true },
  { token: "أعلى من نقطة التعادل",weight: 3, stem: true },
  { token: "فائض",                weight: 2, stem: true },
  { token: "يتجاوز التعادل",     weight: 3, stem: true },
  { token: "نفط مرتفع",          weight: 2, stem: true },
  { token: "أرامكو",              weight: 1, stem: true }, // presence = base signal
  { token: "فوق 80",              weight: 2, stem: true },
  { token: "فوق ٨٠",              weight: 2, stem: true },
  { token: "فوق 75",              weight: 2, stem: true },
];

const BELOW_BREAKEVEN_TOKENS: TokenRule[] = [
  { token: "دون نقطة التعادل",   weight: 3, stem: true },
  { token: "أقل من نقطة التعادل",weight: 3, stem: true },
  { token: "عجز",                 weight: 2, stem: true },
  { token: "نفط منخفض",          weight: 2, stem: true },
  { token: "ضغط مالي",           weight: 2, stem: true },
  { token: "أقل من 70",          weight: 2, stem: true },
  { token: "دون 70",              weight: 2, stem: true },
];

const NEAR_BREAKEVEN_TOKENS: TokenRule[] = [
  { token: "قرب نقطة التعادل",  weight: 3, stem: true },
  { token: "بالقرب من التعادل",  weight: 3, stem: true },
  { token: "عند نقطة التعادل",   weight: 3, stem: true },
  { token: "حول 75",             weight: 2, stem: true },
  { token: "حول 78",             weight: 2, stem: true },
  { token: "حول 80",             weight: 2, stem: true },
];

export function detectArabicOilSignal(text: string): OilSemantic {
  if (!text || !/[؀-ۿ]/.test(text)) return "unknown";
  const above = scoreText(text, ABOVE_BREAKEVEN_TOKENS);
  const below = scoreText(text, BELOW_BREAKEVEN_TOKENS);
  const near  = scoreText(text, NEAR_BREAKEVEN_TOKENS);

  const max = Math.max(above, below, near);
  if (max === 0) return "unknown";
  if (max === above && above >= 2) return "above_breakeven";
  if (max === below && below >= 2) return "below_breakeven";
  if (max === near  && near  >= 2) return "near_breakeven";
  return "unknown";
}

// ─── Allocation stance ────────────────────────────────────────────────────────

const SCALE_IN_TOKENS: TokenRule[] = [
  { token: "شراء تدريجي",    weight: 3, stem: true },
  { token: "انتهاز الفرصة",  weight: 3, stem: true },
  { token: "زيادة التعرض",   weight: 3, stem: true },
  { token: "بناء مركز",      weight: 2, stem: true },
  { token: "دخول تدريجي",   weight: 3, stem: true },
];

const WAIT_TOKENS: TokenRule[] = [
  { token: "انتظار تأكيد",   weight: 3, stem: true },
  { token: "انتظار",          weight: 2, stem: true },
  { token: "تحفظ",            weight: 2, stem: true },
  { token: "مراقبة",          weight: 1, stem: true },
  { token: "قبل الدخول",    weight: 2, stem: true },
  { token: "ترقب",            weight: 2, stem: true },
];

const DEFENSIVE_TOKENS: TokenRule[] = [
  { token: "دفاعي",           weight: 3, stem: true },
  { token: "حفظ رأس المال",  weight: 3, stem: true },
  { token: "حماية",           weight: 2, stem: true },
  { token: "تحوط",            weight: 2, stem: true },
  { token: "أصول آمنة",      weight: 2, stem: true },
];

const AVOID_TOKENS: TokenRule[] = [
  { token: "تجنب",            weight: 3, stem: true },
  { token: "خفض التعرض",     weight: 3, stem: true },
  { token: "ابتعد",           weight: 2, stem: true },
  { token: "خروج",            weight: 2, stem: true },
  { token: "بيع",             weight: 2, stem: true },
];

const SELECTIVE_TOKENS: TokenRule[] = [
  { token: "انتقائي",         weight: 3, stem: true },
  { token: "الانتقائية",      weight: 3, stem: true },
  { token: "أسماء محددة",    weight: 2, stem: true },
  { token: "اختيارية",        weight: 2, stem: true },
  { token: "تفضيل الجودة",   weight: 2, stem: true },
];

export function detectArabicAllocationStance(text: string): AllocationSemantic {
  if (!text || !/[؀-ۿ]/.test(text)) return "unknown";
  const scaleIn   = scoreText(text, SCALE_IN_TOKENS);
  const wait      = scoreText(text, WAIT_TOKENS);
  const defensive = scoreText(text, DEFENSIVE_TOKENS);
  const avoid     = scoreText(text, AVOID_TOKENS);
  const selective = scoreText(text, SELECTIVE_TOKENS);

  const max = Math.max(scaleIn, wait, defensive, avoid, selective);
  if (max === 0) return "unknown";
  if (max === scaleIn   && scaleIn   >= 2) return "scale_in";
  if (max === selective && selective >= 2) return "selective";
  if (max === wait      && wait      >= 2) return "wait";
  if (max === defensive && defensive >= 2) return "defensive";
  if (max === avoid     && avoid     >= 2) return "avoid";
  return "unknown";
}

// ─── Regime language ─────────────────────────────────────────────────────────

export interface ArabicRegimeSignal {
  detected: boolean;
  label: string;    // human-readable regime label if detected
  confidence: number;
}

const REGIME_TOKENS: Record<string, TokenRule[]> = {
  risk_on: [
    { token: "شهية المخاطرة", weight: 3, stem: true },
    { token: "نظام صعود",     weight: 2, stem: true },
    { token: "توسعي",          weight: 2, stem: true },
  ],
  risk_off: [
    { token: "تجنب المخاطرة", weight: 3, stem: true },
    { token: "نظام هبوط",     weight: 2, stem: true },
    { token: "ملاذ آمن",      weight: 2, stem: true },
  ],
  stagflation: [
    { token: "ركود تضخمي",   weight: 3, stem: true },
    { token: "تضخم مع ركود", weight: 3, stem: true },
    { token: "ضغوط تضخمية",  weight: 2, stem: true },
  ],
  rate_transition: [
    { token: "دورة أسعار الفائدة", weight: 3, stem: true },
    { token: "تحول في الفائدة",   weight: 3, stem: true },
    { token: "نقطة تحول",         weight: 2, stem: true },
  ],
  saudi_fiscal: [
    { token: "إصلاح مالي",   weight: 3, stem: true },
    { token: "رؤية 2030",     weight: 2, stem: true },
    { token: "تنويع اقتصادي",weight: 2, stem: true },
  ],
};

export function detectArabicRegime(text: string): ArabicRegimeSignal {
  if (!text || !/[؀-ۿ]/.test(text)) {
    return { detected: false, label: "", confidence: 0 };
  }
  let best = { regime: "", score: 0 };
  for (const [regime, rules] of Object.entries(REGIME_TOKENS)) {
    const score = scoreText(text, rules);
    if (score > best.score) best = { regime, score };
  }
  if (best.score < 2) return { detected: false, label: "", confidence: 0 };
  return {
    detected: true,
    label: best.regime,
    confidence: Math.min(100, best.score * 20),
  };
}

// ─── Uncertainty language ─────────────────────────────────────────────────────

const UNCERTAINTY_TOKENS: TokenRule[] = [
  { token: "عدم اليقين",    weight: 3, stem: true },
  { token: "غامض",          weight: 2, stem: true },
  { token: "غير محدد",     weight: 2, stem: true },
  { token: "يصعب التنبؤ",  weight: 2, stem: true },
  { token: "توقعات متباينة",weight: 2, stem: true },
  { token: "مخاطر متعددة", weight: 1, stem: true },
  { token: "سيناريوهات متعددة",weight: 1, stem: true },
];

export function detectArabicUncertainty(text: string): number {
  if (!text || !/[؀-ۿ]/.test(text)) return 0;
  return Math.min(100, scoreText(text, UNCERTAINTY_TOKENS) * 15);
}

// ─── Invalidation language ────────────────────────────────────────────────────

const INVALIDATION_TOKENS: TokenRule[] = [
  { token: "شرط الإلغاء",   weight: 3, stem: true },
  { token: "يُلغي الأطروحة",weight: 3, stem: true },
  { token: "يُبطل الرأي",   weight: 3, stem: true },
  { token: "إذا تجاوز",     weight: 2, stem: true },
  { token: "إذا انخفض",     weight: 2, stem: true },
  { token: "خرق المستوى",   weight: 2, stem: true },
  { token: "تغيير جذري",   weight: 2, stem: true },
];

export function detectArabicInvalidationActive(text: string, priorInvalidation?: string): boolean {
  if (!text || !priorInvalidation) return false;
  if (!/[؀-ۿ]/.test(text)) return false;
  // Check if priorInvalidation content words appear in current text
  const invWords = priorInvalidation.split(/\s+/).filter(w => w.length > 3);
  const hits = invWords.filter(w => text.includes(w)).length;
  return hits >= 2 || scoreText(text, INVALIDATION_TOKENS) >= 2;
}

// ─── Language detection ───────────────────────────────────────────────────────

/**
 * Returns true if the text is predominantly Arabic (>40% Arabic codepoints).
 */
export function isArabicDominant(text: string): boolean {
  if (!text) return false;
  const arabicChars = (text.match(/[؀-ۿ]/g) ?? []).length;
  const letterChars = (text.match(/[a-zA-Z؀-ۿ]/g) ?? []).length;
  return letterChars > 0 && arabicChars / letterChars > 0.40;
}

// ─── Full semantic profile extraction ────────────────────────────────────────

/**
 * Extracts a full SemanticProfile from Arabic text using vocabulary-weighted scoring.
 * Called when the text is Arabic-dominant (isArabicDominant returns true).
 */
export function extractArabicSemanticProfile(
  text: string,
  confidenceScore?: number,
  priorInvalidation?: string,
): Omit<SemanticProfile, "hasCausalChain" | "hasSecondOrder"> {
  return {
    direction:         detectArabicDirection(text),
    convictionTier:    detectArabicConviction(text, confidenceScore),
    confidence:        confidenceScore ?? 50,
    policyStance:      detectArabicPolicyStance(text),
    oilSignal:         detectArabicOilSignal(text),
    allocationStance:  detectArabicAllocationStance(text),
    sectorLeader:      extractArabicSectorLeader(text),
    invalidationActive: detectArabicInvalidationActive(text, priorInvalidation),
  };
}

// ─── Sector leader ────────────────────────────────────────────────────────────

export function extractArabicSectorLeader(text: string): string {
  if (!text || !/[؀-ۿ]/.test(text)) return "";
  if (/أرامكو.*أول|أرامكو.*محور|أرامكو.*رئيسي/i.test(text)) return "aramco";
  if (/بنوك.*تقود|المصارف.*تقود|قطاع\s+المصرفي.*رائد/i.test(text)) return "banks";
  if (/سابك.*يقود|بتروكيماويات.*تتفوق/i.test(text)) return "sabic";
  if (/دفاعيات.*تقود|أسهم.*الدفاعية.*مفضل/i.test(text)) return "defensives";
  if (/تقنية.*تقود|قطاع.*التكنولوجيا.*رائد/i.test(text)) return "technology";
  return "";
}

// ─── Validation ───────────────────────────────────────────────────────────────
// Built-in test cases — callable in diagnostics, not in hot path.

interface ArabicValidationCase {
  id: string;
  text: string;
  expected: Record<string, string | boolean | number>;
  category: string;
}

const VALIDATION_CASES: ArabicValidationCase[] = [
  {
    id: "ar-direction-bullish",
    text: "السوق السعودي صاعد في النظام الحالي مع فرصة شراء تدريجي في أرامكو.",
    expected: { direction: "bullish" },
    category: "direction",
  },
  {
    id: "ar-direction-bearish",
    text: "ننصح بتجنب التعرض للقطاع المصرفي في ظل الضغط الهابط على أسعار الأسهم.",
    expected: { direction: "bearish" },
    category: "direction",
  },
  {
    id: "ar-policy-easing",
    text: "الفيدرالي يتجه نحو التيسير النقدي مع توقعات خفض الفائدة في النصف الثاني.",
    expected: { policy: "easing_expected" },
    category: "policy",
  },
  {
    id: "ar-policy-tightening",
    text: "ساما مستمرة في سياسة التشديد النقدي برفع أسعار الفائدة للحد من التضخم.",
    expected: { policy: "tightening_expected" },
    category: "policy",
  },
  {
    id: "ar-oil-above",
    text: "النفط فوق نقطة التعادل للميزانية السعودية عند 80 دولاراً مما يدعم الفائض.",
    expected: { oil: "above_breakeven" },
    category: "oil",
  },
  {
    id: "ar-allocation-wait",
    text: "نوصي بانتظار تأكيد الاتجاه قبل بناء أي مراكز جديدة في هذه المرحلة.",
    expected: { allocation: "wait" },
    category: "allocation",
  },
  {
    id: "ar-allocation-defensive",
    text: "الموقف الدفاعي هو الأنسب حالياً مع التركيز على حفظ رأس المال والتحوط.",
    expected: { allocation: "defensive" },
    category: "allocation",
  },
  {
    id: "ar-saudi-allocator",
    text: "المدير المحافظ يُفضّل شراء تدريجي في أرامكو مع ثبات الفائدة ودعم النفط للفائض السعودي.",
    expected: { direction: "bullish", allocation: "scale_in" },
    category: "saudi_allocator",
  },
];

export interface ArabicValidationResult {
  passed: number;
  failed: number;
  cases: Array<{ id: string; passed: boolean; actual: Record<string, string | boolean | number> }>;
}

export function runArabicValidation(): ArabicValidationResult {
  let passed = 0;
  let failed = 0;
  const cases = [];

  for (const c of VALIDATION_CASES) {
    const actual: Record<string, string | boolean | number> = {};

    if (c.expected.direction !== undefined) {
      actual.direction = detectArabicDirection(c.text);
    }
    if (c.expected.policy !== undefined) {
      actual.policy = detectArabicPolicyStance(c.text);
    }
    if (c.expected.oil !== undefined) {
      actual.oil = detectArabicOilSignal(c.text);
    }
    if (c.expected.allocation !== undefined) {
      actual.allocation = detectArabicAllocationStance(c.text);
    }

    const pass = Object.keys(c.expected).every(k => actual[k] === c.expected[k]);
    if (pass) passed++;
    else failed++;

    cases.push({ id: c.id, passed: pass, actual });
  }

  return { passed, failed, cases };
}
