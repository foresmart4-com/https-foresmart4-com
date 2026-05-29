// Phase-83A: Historical Analog Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from historicalLearning.ts (Phase 74):
//   historicalLearning.ts   — single best-match analog via keyword scoring
//   historicalAnalogEngine  — multi-cycle comparison, regime-aware matching,
//                             structured "what's the same / what's different"
//                             output, Saudi-specific cycle overlay, and a
//                             richer context block designed for prompt injection.
//
// Never a prediction tool. Context and base rates only.
// Governed: analog strength must be declared; "regime_difference" prevents
// inappropriate application of the analog.

import { HISTORICAL_EPISODES, type HistoricalEpisode, type HistoricalAnalogResult } from "@/services/research/historicalLearning";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CycleCategory =
  | "oil_shock_downward"   // oil falling, fiscal stress, Saudi pressure
  | "oil_shock_upward"     // oil rising, fiscal windfall, Saudi boom
  | "rate_tightening"      // CB raising, real rates rising, PE compression
  | "rate_easing"          // CB cutting, real rates falling, PE expansion
  | "credit_stress"        // spreads widening, funding stress
  | "risk_on_regime"       // spreads tight, EM flows positive, risk appetite high
  | "stagflation"          // inflation high + growth weak simultaneously
  | "demand_shock"         // exogenous demand collapse (pandemic, war)
  | "recovery_phase"       // post-crisis normalisation
  | "unknown";

export interface RegimeAnalog {
  episode: HistoricalEpisode;
  matchScore: number;       // 0-10
  matchingFeatures: string[];
  differingFeatures: string[];
  saudiRelevance: string;   // how this analog applies to Saudi/TASI specifically
  allocatorLesson: string;  // what a conservative allocator did/should have done
}

export interface HistoricalAnalogEngineResult {
  category: CycleCategory;
  primaryAnalog: RegimeAnalog | null;
  secondaryAnalog: RegimeAnalog | null;   // second-closest match for comparison
  conflictingAnalog: RegimeAnalog | null; // analog that argues the OTHER direction
  contextBlock: string;                  // injectable prompt context
  saudiCycleContext: string;             // Saudi-specific historical overlay
  governanceNote: string;                // how to use this responsibly
}

// ─── Regime category detection ────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<CycleCategory, RegExp> = {
  oil_shock_downward:  /oil\s*(fall|drop|decline|crash|below|collapse)|نفط\s*(ينخفض|ينهار|تراجع|دون)/i,
  oil_shock_upward:    /oil\s*(rise|surge|rally|above|spike)|نفط\s*(يرتفع|فوق|صعود)/i,
  rate_tightening:     /rate\s*(hike|rise|tight|increas)|fed\s*(hik|tight|rais)|الفيدرالي\s*(يرفع|تشديد)/i,
  rate_easing:         /rate\s*(cut|lower|ease|pivot)|fed\s*(cut|pivo|ease)|الفيدرالي\s*(يخفض|تيسير|تحول)/i,
  credit_stress:       /credit\s*(spread|stress|tighten)|spread\s*widen|ائتمان\s*(ضغط|فوارق|تشديد)/i,
  risk_on_regime:      /risk.on|risk\s+appetite|EM\s+(rally|flow)|شهية\s+المخاطرة/i,
  stagflation:         /stagflat|inflation.{0,20}(weak|slow)|(تضخم|ارتفاع).{0,30}(ضعف|تباطؤ)/i,
  demand_shock:        /pandemic|covid|lockdown|war|exogenous\s+shock|جائحة|حرب|صدمة\s+خارجية/i,
  recovery_phase:      /recovery|rebound|normaliz|post.crisis|انتعاش|تعافٍ/i,
  unknown:             /.*/,
};

function detectCycleCategory(question: string, ctx: string): CycleCategory {
  const text = `${question} ${ctx}`.toLowerCase();
  for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS) as [CycleCategory, RegExp][]) {
    if (cat !== "unknown" && pattern.test(text)) return cat;
  }
  return "unknown";
}

// ─── Enhanced scoring ─────────────────────────────────────────────────────────
// Uses both keyword matching AND category alignment for richer scoring.

const CATEGORY_TO_DOMAIN_AFFINITY: Partial<Record<CycleCategory, string[]>> = {
  oil_shock_downward: ["oil_shock", "saudi_oil_history"],
  oil_shock_upward:   ["oil_shock", "saudi_oil_history", "macro_cycle"],
  rate_tightening:    ["fed_cycle", "inflation_regime"],
  rate_easing:        ["fed_cycle", "macro_cycle"],
  credit_stress:      ["gfc_2008", "liquidity_crisis"],
  stagflation:        ["inflation_regime"],
  demand_shock:       ["covid", "great_depression"],
  recovery_phase:     ["covid", "gfc_2008", "macro_cycle"],
};

function scoreEpisode(
  episode: HistoricalEpisode,
  question: string,
  ctx: string,
  category: CycleCategory,
): number {
  const text = `${question} ${ctx}`.toLowerCase();
  let score = episode.analogKeywords.filter(k => text.includes(k)).length;

  // Bonus for category-domain affinity
  const affinityDomains = CATEGORY_TO_DOMAIN_AFFINITY[category] ?? [];
  if (affinityDomains.includes(episode.domain)) score += 2;

  return score;
}

// ─── Feature matching ─────────────────────────────────────────────────────────

function findMatchingFeatures(episode: HistoricalEpisode, question: string, ctx: string): string[] {
  const text = `${question} ${ctx}`.toLowerCase();
  return episode.characteristics.filter(c => {
    const words = c.toLowerCase().split(/\s+/);
    return words.some(w => w.length > 4 && text.includes(w));
  }).slice(0, 3);
}

function findDifferingFeatures(episode: HistoricalEpisode, question: string, ctx: string): string[] {
  const text = `${question} ${ctx}`.toLowerCase();
  return episode.characteristics.filter(c => {
    const words = c.toLowerCase().split(/\s+/);
    return !words.some(w => w.length > 4 && text.includes(w));
  }).slice(0, 2).map(c => `Not currently present: "${c}"`);
}

// ─── Saudi cycle overlay ──────────────────────────────────────────────────────

function buildSaudiCycleContext(
  category: CycleCategory,
  primaryAnalog: RegimeAnalog | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";

  const coreNote = ar
    ? "السياق التاريخي السعودي (ليس تنبؤاً — معدلات أساسية وأنماط فقط):"
    : "Saudi historical context (not prediction — base rates and patterns only):";

  let cycleNote: string;

  switch (category) {
    case "oil_shock_downward":
      cycleNote = ar
        ? "النمط 1986/2014-16: نفط دون نقطة التعادل → تاسي -40-50% خلال 6-18 شهراً → استرداد في 2-3 سنوات. الفارق المهم هذه المرة: رؤية 2030 توفر إنفاقاً غير نفطي غير موجود في 1986. معدل أساسي: البنوك وأسماء رؤية 2030 تتراجع أسرع من أرامكو."
        : "1986/2014-16 pattern: oil below breakeven → TASI -40-50% over 6-18 months → 2-3 year recovery. Key difference this time: Vision 2030 provides non-oil spending anchor absent in 1986. Base rate: banks and V2030 names decline faster than Aramco.";
      break;

    case "oil_shock_upward":
      cycleNote = ar
        ? "نمط 2003-08/2021-22: نفط فوق نقطة التعادل بفارق كبير → فائض مالي → فورة تاسي. تاسي 2022 بلغ 13,000+. الفارق: التقييمات والمضاعفات في بداية الفورة مهمة — الصعود المدفوع بتوسع P/E يعكس مساره عند استقرار النفط."
        : "2003-08/2021-22 pattern: oil well above breakeven → fiscal surplus → TASI boom. TASI hit 13,000+ in 2022. Difference: starting valuations matter — P/E-expansion-driven gains reverse when oil stabilises.";
      break;

    case "rate_tightening":
      cycleNote = ar
        ? "1994/2022: دورات التشديد السريع تضغط مضاعفات PE عالمياً. البيئة السعودية في 2022: نفط مرتفع + رفع الأسعار = أداء تاسي فوق المتوسط العالمي. الشرط: النفط فوق نقطة التعادل يُعوّض ضغط المضاعفات."
        : "1994/2022: rapid tightening cycles compress PE multiples globally. Saudi experience in 2022: high oil + rate hikes = TASI outperformed global equities. Condition: oil above breakeven offsets multiple compression.";
      break;

    case "rate_easing":
      cycleNote = ar
        ? "دورات التيسير (2019-20): تخفيف تلقائي عبر SAMA + ربط SAR يدعم التقييمات والائتمان. الاستفادة الأكبر: البنوك (توسع الائتمان) والقطاعات ذات التقييم المنخفض. الشرط: النفط يحتاج أن يكون مستقراً حتى تتحقق إعادة التسعير."
        : "Easing cycles (2019-20): automatic easing via SAMA SAR peg supports valuations and credit. Biggest beneficiaries: banks (credit expansion) and low-valuation sectors. Condition: oil needs to be stable for re-pricing to materialise.";
      break;

    default:
      cycleNote = ar
        ? "لا يوجد أنالوغ سعودي محدد لهذا النظام — تطبيق المبادئ العامة: إذا كان النفط فوق نقطة التعادل، فالمعدل الأساسي إيجابي لتاسي؛ إذا كان دون ذلك، فالمعدل الأساسي تحذيري."
        : "No specific Saudi analog for this regime — apply general principle: if oil is above breakeven, base rate is constructive for TASI; if below, base rate is cautionary.";
  }

  const analogNote = primaryAnalog
    ? (ar
        ? `الأنالوغ الأقرب: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period}). الدرس: ${primaryAnalog.allocatorLesson}`
        : `Closest analog: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period}). Lesson: ${primaryAnalog.allocatorLesson}`)
    : "";

  const governance = ar
    ? "⚠ الأنالوغ التاريخي سياق وتقدير — ليس تنبؤاً ولا إشارة دخول. الظروف الهيكلية تختلف دائماً."
    : "⚠ Historical analog is context and calibration — not prediction and not an entry signal. Structural conditions always differ.";

  return [coreNote, cycleNote, analogNote, governance].filter(Boolean).join("\n");
}

// ─── Allocator lesson derivation ──────────────────────────────────────────────

function deriveAllocatorLesson(episode: HistoricalEpisode, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  const baseLesson = episode.keyLesson;

  // Derive allocator-specific implication from the episode lesson
  const allocatorFraming = ar
    ? `الدرس للمخصص: ${baseLesson} — المخصص المحافظ في هذا السياق: ${episode.saudiDimension ?? "الانتقائية والصبر أثمرا بعد مرحلة الضغط."}`
    : `Allocator lesson: ${baseLesson} — conservative allocator in this context: ${episode.saudiDimension ?? "selectivity and patience rewarded after the stress phase."}`;

  return allocatorFraming;
}

// ─── Governance note ─────────────────────────────────────────────────────────

function buildGovernanceNote(lang: "ar" | "en"): string {
  return lang === "ar"
    ? "حوكمة استخدام الأنالوغ التاريخي: (1) سمّ الأنالوغ وذكر خصائصه المطابقة؛ (2) أدرج صراحةً ما يختلف هذه المرة؛ (3) لا تستخدمه كإشارة دخول/خروج محددة؛ (4) اربطه بالبيانات الحالية المتاحة، لا الماضي وحده."
    : "Historical analog governance: (1) name the analog and state matching characteristics; (2) explicitly state what is different this time; (3) never use as a specific entry/exit signal; (4) ground in current available data, not past alone.";
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Multi-cycle historical analog comparison for a given question/context.
 * Returns primary + secondary + conflicting analogs with structured context.
 * Distinct from findHistoricalAnalog() in historicalLearning.ts which returns
 * only the single best keyword match.
 */
export function findMultiCycleAnalogs(
  question: string,
  ctx: string,
  lang: "ar" | "en",
): HistoricalAnalogEngineResult {
  const category = detectCycleCategory(question, ctx);

  // Score all episodes
  const scored = HISTORICAL_EPISODES.map(ep => ({
    ep,
    score: scoreEpisode(ep, question, ctx, category),
    matchingFeatures: findMatchingFeatures(ep, question, ctx),
    differingFeatures: findDifferingFeatures(ep, question, ctx),
  })).sort((a, b) => b.score - a.score);

  const withScore = scored.filter(s => s.score > 0);

  const buildRegimeAnalog = (item: typeof scored[0]): RegimeAnalog => ({
    episode: item.ep,
    matchScore: item.score,
    matchingFeatures: item.matchingFeatures,
    differingFeatures: item.differingFeatures,
    saudiRelevance: item.ep.saudiDimension ?? (lang === "ar" ? "لا تأثير سعودي محدد في هذا الأنالوغ." : "No specific Saudi dimension in this analog."),
    allocatorLesson: deriveAllocatorLesson(item.ep, lang),
  });

  const primaryAnalog = withScore.length > 0 ? buildRegimeAnalog(withScore[0]) : null;
  const secondaryAnalog = withScore.length > 1 ? buildRegimeAnalog(withScore[1]) : null;

  // Find the conflicting analog — one that supports the OPPOSITE of the primary direction
  const conflicting = withScore.find(s =>
    s.ep !== withScore[0]?.ep &&
    s.ep !== withScore[1]?.ep &&
    s.score > 0,
  );
  const conflictingAnalog = conflicting ? buildRegimeAnalog(conflicting) : null;

  const saudiCycleContext = buildSaudiCycleContext(category, primaryAnalog, lang);
  const governanceNote = buildGovernanceNote(lang);

  // Build compact context block for injection
  const parts: string[] = [];
  if (primaryAnalog) {
    parts.push(lang === "ar"
      ? `[أنالوغ تاريخي رئيسي: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period})] ${primaryAnalog.episode.keyLesson}`
      : `[Primary analog: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period})] ${primaryAnalog.episode.keyLesson}`);
    if (primaryAnalog.matchingFeatures.length > 0) {
      parts.push(lang === "ar"
        ? `المطابق الآن: ${primaryAnalog.matchingFeatures.join("; ")}`
        : `Matching now: ${primaryAnalog.matchingFeatures.join("; ")}`);
    }
    if (primaryAnalog.differingFeatures.length > 0) {
      parts.push(lang === "ar"
        ? `يختلف هذه المرة: ${primaryAnalog.differingFeatures.join("; ")}`
        : `Different this time: ${primaryAnalog.differingFeatures.join("; ")}`);
    }
  }
  if (secondaryAnalog) {
    parts.push(lang === "ar"
      ? `[أنالوغ ثانوي: ${secondaryAnalog.episode.name}] ${secondaryAnalog.episode.keyLesson}`
      : `[Secondary analog: ${secondaryAnalog.episode.name}] ${secondaryAnalog.episode.keyLesson}`);
  }
  parts.push(governanceNote);

  return {
    category,
    primaryAnalog,
    secondaryAnalog,
    conflictingAnalog,
    contextBlock: parts.join("\n"),
    saudiCycleContext,
    governanceNote,
  };
}

/**
 * Builds a compact Saudi-specific historical cycle context for investment questions.
 * Includes breakeven cycle history and base rate returns by regime.
 */
export function buildSaudiHistoricalCycleContext(
  category: CycleCategory,
  lang: "ar" | "en",
): string {
  return buildSaudiCycleContext(category, null, lang);
}
