// Phase-83B: Thesis Evolution Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from existing modules:
//   Phase-66 reasoningCalibration.ts — calibrates the CURRENT reply's thesis
//                                      strength (backward-looking; what's present)
//   Phase-63 institutionalReasoning.ts — injects macro chain reasoning context
//   thesisEvolutionEngine (83B)       — FORWARD-LOOKING framework specifying under
//                                      what CONDITIONS the thesis gets stronger/weaker/
//                                      revised/invalidated, plus confidence direction
//
// Core concept: a thesis isn't just strong or weak today — it has a TRAJECTORY.
// An institutional investor asks: "Is my conviction building or deteriorating, and
// what specific observable events would require me to revise my position?"
//
// This engine produces the conditions framework that gets injected into the prompt,
// forcing the AI to reason about thesis evolution, not just thesis state.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThesisConfidenceDirection =
  | "building"        // supporting evidence accumulating; conditions converging
  | "stable"          // evidence balanced; no clear directional signal
  | "deteriorating"   // contradicting evidence growing; conditions diverging
  | "unknown";        // insufficient evidence to assess direction

export type ThesisEvolutionStage =
  | "emerging"        // hypothesis forming; low evidence; conviction 30-45%
  | "developing"      // supporting evidence building; conviction 45-60%
  | "established"     // multiple confirming signals; conviction 60-75%
  | "high_conviction" // broad evidence alignment; conviction 75%+
  | "contested"       // competing evidence; conviction fluctuating
  | "weakening"       // invalidation signals appearing; conviction declining
  | "invalidated";    // thesis conditions broken; stance reversal warranted

interface TrackASlice {
  regime?: string;
  macroBias?: "bullish" | "bearish" | "neutral";
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  ratesEnv?: string;
  oilLiquidity?: string;
  regimeConf?: number;
}

interface TrackDSlice {
  uncertaintyLevel?: "low" | "moderate" | "high" | "extreme";
  primaryRisk?: string;
  thesisWeakness?: string;
  invalidationTrigger?: string;
  counterCase?: string;
}

interface ConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
}

export interface ThesisEvolutionInput {
  trackA: TrackASlice | null;
  trackD: TrackDSlice | null;
  consensus: ConsensusSlice;
  hasExistingThesis: boolean;
  currentInvalidation?: string;
  currentMissingEvidence?: string;
  isSaudi: boolean;
  lang: "ar" | "en";
}

export interface ThesisEvolutionState {
  stage: ThesisEvolutionStage;
  confidenceDirection: ThesisConfidenceDirection;
  supportingFactorCount: number;
  contradictingFactorCount: number;
  strongerConditions: string[];    // observable events that would build conviction
  weakerConditions: string[];      // observable events that would undermine thesis
  revisionTriggers: string[];      // what warrants revision WITHOUT full invalidation
  invalidationTriggers: string[];  // what kills the thesis outright
  convictionCeiling: number;       // max confidence warranted in current state
  convictionFloor: number;         // min confidence needed to maintain any position
  evolutionContext: string;        // compact injectable prompt directive
}

// ─── Evidence counting ────────────────────────────────────────────────────────

function countSupportingFactors(trackA: TrackASlice | null, consensus: ConsensusSlice): number {
  let count = 0;
  if (trackA?.macroBias === "bullish") count++;
  if (trackA?.creditStressLevel === "low") count++;
  if (trackA?.regimeConf && trackA.regimeConf >= 65) count++;
  if (consensus.dominantBias === "bullish" && consensus.strength !== "conflicted") count++;
  if (consensus.agreementScore >= 70) count++;
  return count;
}

function countContradictingFactors(trackA: TrackASlice | null, trackD: TrackDSlice | null, consensus: ConsensusSlice): number {
  let count = 0;
  if (trackA?.creditStressLevel === "high" || trackA?.creditStressLevel === "extreme") count++;
  if (trackD?.uncertaintyLevel === "high" || trackD?.uncertaintyLevel === "extreme") count++;
  if (consensus.strength === "conflicted" || consensus.strength === "weak") count++;
  if (consensus.agreementScore < 50) count++;
  if (trackD?.thesisWeakness) count++;
  return count;
}

// ─── Stage derivation ─────────────────────────────────────────────────────────

function deriveStage(
  supporting: number,
  contradicting: number,
  consensus: ConsensusSlice,
): ThesisEvolutionStage {
  if (!supporting && !contradicting) return "emerging";
  if (contradicting > supporting + 1) return "weakening";
  if (consensus.strength === "conflicted") return "contested";
  if (supporting >= 3 && contradicting <= 1) return "high_conviction";
  if (supporting >= 2 && contradicting <= 1) return "established";
  if (supporting >= 1 && contradicting <= 2) return "developing";
  if (contradicting >= 3) return "invalidated";
  return "emerging";
}

// ─── Confidence direction ────────────────────────────────────────────────────

function deriveDirection(
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  supporting: number,
  contradicting: number,
): ThesisConfidenceDirection {
  if (!trackA) return "unknown";
  if (supporting > contradicting + 1) return "building";
  if (contradicting > supporting + 1) return "deteriorating";
  if (trackD?.uncertaintyLevel === "high" || trackD?.uncertaintyLevel === "extreme") return "deteriorating";
  if (trackA.regimeConf && trackA.regimeConf >= 70) return "building";
  return "stable";
}

// ─── Condition generators ─────────────────────────────────────────────────────

function buildStrongerConditions(
  trackA: TrackASlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string[] {
  const ar = lang === "ar";
  const conditions: string[] = [];

  if (isSaudi) {
    conditions.push(ar
      ? "النفط يرتفع بشكل ثابت فوق $80/ب لأكثر من 4 أسابيع → فائض مالي مؤكد → تسارع الإنفاق الحكومي."
      : "Oil sustains above $80/bbl for 4+ weeks → confirmed budget surplus → government spending acceleration.");
    conditions.push(ar
      ? "إشارة تخفيف الفيدرالي → SAMA تُيسّر تلقائياً → تكاليف الاقتراض السعودية تنخفض → دعم إعادة التسعير."
      : "Fed pivot signal → SAMA eases automatically → Saudi borrowing costs decline → re-pricing support.");
    conditions.push(ar
      ? "نمو الائتمان المصرفي السعودي يتسارع (نمو>8% سنوياً) → دليل على توسع الطلب المحلي."
      : "Saudi bank credit growth accelerates (>8% YoY) → evidence of domestic demand expansion.");
  } else {
    conditions.push(ar
      ? "بيانات التضخم تتراجع نحو هدف البنك المركزي → مسار تخفيف أوضح → دعم مضاعفات التقييم."
      : "Inflation data declines toward CB target → clearer easing path → valuation multiple support.");
    conditions.push(ar
      ? "أرباح الشركات تتجاوز التوقعات في القطاعات الدورية الرئيسية → نمو EPS يؤكد الأطروحة."
      : "Corporate earnings beat estimates in key cyclicals → EPS growth confirms the thesis.");
    if (trackA?.creditStressLevel === "high" || trackA?.creditStressLevel === "extreme") {
      conditions.push(ar
        ? "فوارق الائتمان تضيق بشكل ملموس → ظروف الائتمان تتحسن → إزالة قيد رئيسي على التقييم."
        : "Credit spreads narrow materially → credit conditions improve → key valuation constraint lifted.");
    }
  }

  return conditions;
}

function buildWeakerConditions(
  trackD: TrackDSlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string[] {
  const ar = lang === "ar";
  const conditions: string[] = [];

  if (isSaudi) {
    conditions.push(ar
      ? "النفط يتراجع نحو أو دون $72/ب → فائض الميزانية يتقلص → وتيرة الإنفاق الحكومي تتباطأ."
      : "Oil declines toward or below $72/bbl → budget surplus contracts → government spending pace slows.");
    conditions.push(ar
      ? "الفيدرالي يُبقي أو يرفع الأسعار أكثر من المتوقع → SAMA مُقيَّدة → تكاليف الاقتراض السعودية تبقى مرتفعة."
      : "Fed holds or hikes more than expected → SAMA constrained → Saudi borrowing costs remain elevated.");
  } else {
    conditions.push(ar
      ? "أرباح الشركات تخيب التوقعات في القطاعات الدورية الرئيسية → نمو EPS يتباطأ → ضغط على مضاعفات التقييم."
      : "Corporate earnings disappoint in key cyclicals → EPS growth slows → valuation multiple pressure.");
    const risk = trackD?.primaryRisk ?? (ar ? "الخطر الرئيسي يتصاعد" : "primary risk escalates");
    conditions.push(ar
      ? `${risk} → الحالة الهابطة تكتسب أدلة → قد يكون التقليص مبرراً.`
      : `${risk} → bear case accumulates evidence → reduction may be warranted.`);
  }

  return conditions;
}

function buildRevisionTriggers(
  trackD: TrackDSlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string[] {
  const ar = lang === "ar";
  const triggers: string[] = [];

  if (isSaudi) {
    triggers.push(ar
      ? "النفط يستقر بين $68-72/ب لأكثر من 8 أسابيع → مراجعة الفرضية المالية لكن لا إلغاء كامل."
      : "Oil stabilises between $68-72/bbl for 8+ weeks → revise fiscal assumption but not full invalidation.");
    triggers.push(ar
      ? "نمو الائتمان المصرفي يتراجع دون 3% سنوياً → مراجعة الحجم للأسفل مع الإبقاء على التعرض الانتقائي."
      : "Bank credit growth decelerates below 3% YoY → revise position size lower while maintaining selective exposure.");
  } else {
    const weakness = trackD?.thesisWeakness ?? (ar ? "الافتراض الأضعف يظهر في البيانات" : "weakest assumption appears in data");
    triggers.push(ar
      ? `${weakness} يتجسد في البيانات → مراجعة الأطروحة وتقليص الحجم مؤقتاً حتى يتضح المشهد.`
      : `${weakness} materialises in data → revise thesis and reduce size temporarily until picture clarifies.`);
    triggers.push(ar
      ? "الإجماع يتحول من صاعد إلى محايد عبر 3+ وكلاء → مراجعة قناعة الأطروحة والحجم."
      : "Consensus shifts from bullish to neutral across 3+ agents → revise thesis conviction and size.");
  }

  return triggers;
}

function buildInvalidationTriggers(
  trackD: TrackDSlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string[] {
  const ar = lang === "ar";
  const triggers: string[] = [];

  // Use existing track D invalidation if available, then add specifics
  if (trackD?.invalidationTrigger) {
    triggers.push(trackD.invalidationTrigger);
  }

  if (isSaudi) {
    if (!trackD?.invalidationTrigger || !/(70|72|75|ب)/.test(trackD.invalidationTrigger)) {
      triggers.push(ar
        ? "النفط يتراجع دون $68/ب لأكثر من 6 أسابيع → الفرضية المالية السعودية تنهار → الأطروحة تُلغى."
        : "Oil sustained below $68/bbl for 6+ weeks → Saudi fiscal thesis collapses → full invalidation.");
    }
    triggers.push(ar
      ? "أرامكو يُخفّض أرباح الأسهم الأساسية → خسارة مرساة العائد → إعادة تسعير واسعة في تاسي."
      : "Aramco cuts the ordinary dividend → yield anchor lost → broad TASI re-pricing warranted.");
  } else {
    if (!trackD?.invalidationTrigger) {
      triggers.push(ar
        ? "تحول مفاجئ في السياسة المركزية نحو التشديد المطوّل + توسع فوارق ائتمانية >100 نقطة أساس → إلغاء الأطروحة."
        : "Surprise CB pivot toward extended tightening + credit spread widening >100bps → full invalidation.");
    }
    triggers.push(ar
      ? "خيبة أمل في أرباح 3+ ربعين متتاليين في القطاعات الأساسية → نمو EPS يُلغى → إعادة تسعير الأطروحة."
      : "Earnings disappointment 3+ consecutive quarters in core sectors → EPS growth thesis negated → thesis re-pricing.");
  }

  return triggers;
}

// ─── Conviction ceiling / floor ───────────────────────────────────────────────

function deriveConvictionRange(
  stage: ThesisEvolutionStage,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
): { ceiling: number; floor: number } {
  const uncertHigh = trackD?.uncertaintyLevel === "high" || trackD?.uncertaintyLevel === "extreme";

  const ceilings: Record<ThesisEvolutionStage, number> = {
    emerging: 50,
    developing: 60,
    established: 72,
    high_conviction: 82,
    contested: 58,
    weakening: 45,
    invalidated: 20,
  };

  const floors: Record<ThesisEvolutionStage, number> = {
    emerging: 25,
    developing: 35,
    established: 50,
    high_conviction: 60,
    contested: 30,
    weakening: 20,
    invalidated: 0,
  };

  let ceiling = ceilings[stage];
  let floor = floors[stage];

  if (uncertHigh) { ceiling -= 10; floor -= 5; }
  if (consensus.strength === "conflicted") { ceiling -= 10; }
  if (consensus.agreementScore < 50) { ceiling -= 5; }

  return { ceiling: Math.max(15, ceiling), floor: Math.max(0, floor) };
}

// ─── Evolution context builder ────────────────────────────────────────────────

function buildEvolutionContext(
  state: ThesisEvolutionState,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";

  const stageLabel: Record<ThesisEvolutionStage, string> = {
    emerging:        ar ? "ناشئة" : "emerging",
    developing:      ar ? "في تطور" : "developing",
    established:     ar ? "راسخة" : "established",
    high_conviction: ar ? "عالية القناعة" : "high conviction",
    contested:       ar ? "متنازع عليها" : "contested",
    weakening:       ar ? "متضعضعة" : "weakening",
    invalidated:     ar ? "مُلغاة" : "invalidated",
  };

  const dirLabel: Record<ThesisConfidenceDirection, string> = {
    building:      ar ? "تتصاعد" : "building",
    stable:        ar ? "مستقرة" : "stable",
    deteriorating: ar ? "تتراجع" : "deteriorating",
    unknown:       ar ? "غير محددة" : "unknown",
  };

  const header = ar
    ? `إطار تطور الأطروحة [مرحلة: ${stageLabel[state.stage]}, اتجاه القناعة: ${dirLabel[state.confidenceDirection]}, سقف القناعة: ${state.convictionCeiling}%]:`
    : `Thesis evolution framework [stage: ${stageLabel[state.stage]}, confidence direction: ${dirLabel[state.confidenceDirection]}, conviction ceiling: ${state.convictionCeiling}%]:`;

  const stronger = state.strongerConditions.length > 0
    ? (ar ? `شروط تقوية الأطروحة: ${state.strongerConditions[0]}` : `Conditions that strengthen: ${state.strongerConditions[0]}`)
    : "";
  const weaker = state.weakerConditions.length > 0
    ? (ar ? `شروط إضعاف الأطروحة: ${state.weakerConditions[0]}` : `Conditions that weaken: ${state.weakerConditions[0]}`)
    : "";
  const revision = state.revisionTriggers.length > 0
    ? (ar ? `محفز المراجعة (تعديل لا إلغاء): ${state.revisionTriggers[0]}` : `Revision trigger (adjust, not invalidate): ${state.revisionTriggers[0]}`)
    : "";
  const invalidation = state.invalidationTriggers.length > 0
    ? (ar ? `محفز الإلغاء (تحوّل كامل): ${state.invalidationTriggers[0]}` : `Invalidation trigger (full stance reversal): ${state.invalidationTriggers[0]}`)
    : "";
  const rule = ar
    ? `قاعدة القناعة: الإجابة يجب أن تكون بثقة ${state.convictionFloor}-${state.convictionCeiling}% في المرحلة الحالية. ممنوع: تجاوز سقف ${state.convictionCeiling}% مع الأدلة المتاحة.`
    : `Conviction rule: answer must carry ${state.convictionFloor}-${state.convictionCeiling}% confidence at this stage. FORBIDDEN: exceeding ${state.convictionCeiling}% ceiling with available evidence.`;

  return [header, stronger, weaker, revision, invalidation, rule].filter(Boolean).join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Produces a forward-looking thesis evolution state from available track evidence.
 * Pure O(1) — no AI calls, no network.
 */
export function assessThesisEvolution(input: ThesisEvolutionInput): ThesisEvolutionState {
  const { trackA, trackD, consensus, isSaudi, lang } = input;

  const supportingFactorCount = countSupportingFactors(trackA, consensus);
  const contradictingFactorCount = countContradictingFactors(trackA, trackD, consensus);

  const stage = deriveStage(supportingFactorCount, contradictingFactorCount, consensus);
  const confidenceDirection = deriveDirection(trackA, trackD, supportingFactorCount, contradictingFactorCount);
  const { ceiling: convictionCeiling, floor: convictionFloor } = deriveConvictionRange(stage, trackD, consensus);

  const strongerConditions = buildStrongerConditions(trackA, isSaudi, lang);
  const weakerConditions = buildWeakerConditions(trackD, isSaudi, lang);
  const revisionTriggers = buildRevisionTriggers(trackD, isSaudi, lang);
  const invalidationTriggers = buildInvalidationTriggers(trackD, isSaudi, lang);

  const state: ThesisEvolutionState = {
    stage,
    confidenceDirection,
    supportingFactorCount,
    contradictingFactorCount,
    strongerConditions,
    weakerConditions,
    revisionTriggers,
    invalidationTriggers,
    convictionCeiling,
    convictionFloor,
    evolutionContext: "", // populated below
  };

  state.evolutionContext = buildEvolutionContext(state, lang);
  return state;
}
