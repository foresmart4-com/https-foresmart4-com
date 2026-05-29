// Phase-83B: Allocator Decision Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from existing modules:
//   committeeDebate.ts / committeeStance — produces a label (selective_over_broad, etc.)
//   institutionalDepthEngine.ts — injects allocator psychology guidelines into prompt
//   allocatorDecisionEngine (83B) — produces a SCORED, REASONED decision object that
//                                   functions as an institutional allocator would actually
//                                   think: conviction %, preservation priority, opportunity
//                                   cost analysis, liquidity/concentration risk framing,
//                                   and a scale-in/wait/avoid decision with explicit logic.
//
// Educational only. No execution. No broker logic.

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllocatorStance =
  | "scale_in_gradual"     // deploy in tranches; conditions are constructive
  | "scale_in_opportunistic" // asymmetric setup; deploy selectively on weakness
  | "hold_and_monitor"     // maintain existing; conditions unclear for new capital
  | "wait_confirmation"    // do not deploy; wait for a specific condition
  | "reduce_selective"     // trim high-risk names; protect core exposure
  | "avoid_or_reduce";     // conditions clearly adverse; new deployment not warranted

export type ExposureRecommendation =
  | "broad_index"          // ETF/index exposure; regime broadly supportive
  | "selective_quality"    // named quality names; sector-differentiated
  | "defensive_only"       // only high-yield/cash-generative names
  | "avoid_or_reduce";     // no new exposure; reduce if holding

export type PreservationPriority =
  | "growth_oriented"      // upside capture > downside protection
  | "balanced"             // equal weight to upside and downside management
  | "preservation_dominant"; // downside protection > upside capture

interface DecisionInputs {
  regime: string;
  macroBias: "bullish" | "bearish" | "neutral";
  creditStress: "low" | "moderate" | "high" | "extreme";
  consensusBias: "bullish" | "bearish" | "neutral";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  consensusAgreement: number;      // 0-100
  oilAboveBreakeven: boolean | null; // null = unknown
  fedEasingExpected: boolean | null; // null = unknown
  isSaudi: boolean;
  lang: "ar" | "en";
}

export interface AllocatorDecision {
  stance: AllocatorStance;
  conviction: number;                    // 0-100
  preservationPriority: PreservationPriority;
  exposureRecommendation: ExposureRecommendation;
  primaryLogic: string;                  // the single most important reason for this stance
  opportunityCostNote: string;           // "Waiting has cost X because Y" or "Deploying now costs Y if Z"
  liquidityRisk: "low" | "moderate" | "high";
  concentrationNote: string;             // context-specific concentration risk
  scaleInLogic: string;                  // if scale_in: how many tranches and on what conditions
  decisionContext: string;               // compact injectable prompt directive
}

// ─── Stance derivation ────────────────────────────────────────────────────────
// Decision matrix based on regime + credit + consensus + Saudi-specific signals.

function deriveStance(inputs: DecisionInputs): AllocatorStance {
  const { macroBias, creditStress, consensusBias, consensusStrength, consensusAgreement,
          oilAboveBreakeven, fedEasingExpected, isSaudi } = inputs;

  // Adverse conditions → avoid/reduce
  if (creditStress === "extreme") return "avoid_or_reduce";
  if (creditStress === "high" && consensusBias === "bearish") return "avoid_or_reduce";
  if (isSaudi && oilAboveBreakeven === false && creditStress !== "low") return "avoid_or_reduce";

  // Conflicted signals → wait for confirmation
  if (consensusStrength === "conflicted") return "wait_confirmation";
  if (consensusAgreement < 50 && creditStress !== "low") return "wait_confirmation";
  if (isSaudi && oilAboveBreakeven === null && consensusStrength !== "strong") return "wait_confirmation";

  // Constructive but uncertain → selective
  if (macroBias === "bullish" && creditStress === "moderate" && consensusStrength === "moderate") {
    return fedEasingExpected ? "scale_in_gradual" : "wait_confirmation";
  }

  // Clear constructive → scale in
  if (macroBias === "bullish" && creditStress === "low" && consensusBias === "bullish" && consensusAgreement >= 65) {
    return "scale_in_gradual";
  }

  // Asymmetric opportunity → opportunistic
  if (macroBias === "bullish" && creditStress === "high" && consensusBias !== "bearish") {
    return "scale_in_opportunistic"; // stressed credit = better entry points for quality
  }

  // Holding pattern
  if (macroBias === "neutral" || consensusStrength === "weak") return "hold_and_monitor";

  // Bear regime but not extreme
  if (macroBias === "bearish" && creditStress !== "extreme") return "reduce_selective";

  return "wait_confirmation";
}

// ─── Conviction scoring ───────────────────────────────────────────────────────

function scoreConviction(stance: AllocatorStance, inputs: DecisionInputs): number {
  const { creditStress, consensusAgreement, consensusStrength, oilAboveBreakeven } = inputs;

  const baseConviction: Record<AllocatorStance, number> = {
    scale_in_gradual:        65,
    scale_in_opportunistic:  55,
    hold_and_monitor:        50,
    wait_confirmation:       40,
    reduce_selective:        55,
    avoid_or_reduce:         65, // high conviction in avoiding
  };

  let conviction = baseConviction[stance];

  // Modifiers
  if (creditStress === "extreme") conviction = Math.min(conviction, 45);
  if (creditStress === "high") conviction -= 8;
  if (consensusStrength === "conflicted") conviction -= 12;
  if (consensusStrength === "strong") conviction += 8;
  if (consensusAgreement >= 75) conviction += 5;
  if (consensusAgreement < 50) conviction -= 5;
  if (inputs.isSaudi && oilAboveBreakeven === false) conviction -= 10;
  if (inputs.isSaudi && oilAboveBreakeven === true) conviction += 8;

  return Math.max(20, Math.min(82, conviction));
}

// ─── Preservation priority ────────────────────────────────────────────────────

function derivePreservationPriority(stance: AllocatorStance, inputs: DecisionInputs): PreservationPriority {
  if (stance === "avoid_or_reduce" || stance === "reduce_selective") return "preservation_dominant";
  if (stance === "scale_in_gradual" && inputs.creditStress === "low") return "growth_oriented";
  if (stance === "scale_in_opportunistic") return "balanced";
  return "balanced";
}

// ─── Exposure recommendation ─────────────────────────────────────────────────

function deriveExposure(stance: AllocatorStance, inputs: DecisionInputs): ExposureRecommendation {
  if (stance === "avoid_or_reduce") return "avoid_or_reduce";
  if (stance === "scale_in_gradual" && inputs.creditStress === "low") return "selective_quality";
  if (stance === "scale_in_gradual" && inputs.creditStress === "low" && inputs.consensusAgreement >= 75) return "selective_quality";
  if (stance === "scale_in_opportunistic") return "selective_quality";
  if (stance === "reduce_selective" || stance === "wait_confirmation") return "defensive_only";
  if (stance === "hold_and_monitor") return "selective_quality";
  return "selective_quality";
}

// ─── Text builders ────────────────────────────────────────────────────────────

function buildPrimaryLogic(stance: AllocatorStance, inputs: DecisionInputs, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  const { macroBias, creditStress, consensusStrength, oilAboveBreakeven, isSaudi } = inputs;

  const logicMap: Record<AllocatorStance, string> = {
    scale_in_gradual: ar
      ? `النظام الصاعد (${macroBias}) مع ضغط ائتماني ${creditStress} يدعم النشر التدريجي؛ الدخول على دفعات يُقلّص التعرض للتوقيت.`
      : `Constructive regime (${macroBias}) with ${creditStress} credit stress supports gradual deployment; tranched entry reduces timing exposure.`,
    scale_in_opportunistic: ar
      ? `تشوّه التسعير في ظل ضغط ائتماني ${creditStress} يُنشئ أسعار دخول أفضل للقطاعات الجيدة — الدخول بحجم صغير الآن مع قدرة على البناء.`
      : `Pricing dislocation from ${creditStress} credit stress creates better entry prices for quality names — small initial size with capacity to build.`,
    hold_and_monitor: ar
      ? `إشارات ${consensusStrength} مع نظام ${macroBias} — لا مبرر للنشر الجديد؛ المراقبة حتى يتضح اتجاه الأدلة.`
      : `${consensusStrength} signals with ${macroBias} regime — new deployment not warranted; monitor until evidence direction clarifies.`,
    wait_confirmation: ar
      ? (isSaudi && oilAboveBreakeven === null
          ? "عدم اليقين في اتجاه النفط مقابل نقطة التعادل هو المتغير الأهم — الانتظار حتى تتضح الصورة يُجنّب الدخول بتقييم خاطئ."
          : `الإجماع ${consensusStrength} يجعل الخسأة مرتفعة التكلفة — الانتظار لتأكيد محدد قبل الالتزام برأس مال.`)
      : (isSaudi && oilAboveBreakeven === null
          ? "Oil direction vs fiscal breakeven is the key unresolved variable — waiting avoids committing capital at the wrong valuation entry."
          : `${consensusStrength} consensus makes being wrong costly — waiting for specific confirmation before committing capital.`),
    reduce_selective: ar
      ? `النظام الهابط (${macroBias}) مع ${consensusStrength} — الحد من التعرض للقطاعات ذات الرافعة العالية وإبقاء الجودة الدفاعية.`
      : `Bear regime (${macroBias}) with ${consensusStrength} — limit high-leverage sector exposure while maintaining quality defensives.`,
    avoid_or_reduce: ar
      ? `ضغط ائتماني ${creditStress} ${isSaudi && oilAboveBreakeven === false ? "مع نفط دون نقطة التعادل " : ""}— الظروف معاكسة بما يكفي لتُعيق نشر رأس المال الجديد.`
      : `${creditStress} credit stress ${isSaudi && oilAboveBreakeven === false ? "with oil below fiscal breakeven " : ""}— conditions adverse enough to impair new capital deployment.`,
  };

  return logicMap[stance];
}

function buildOpportunityCostNote(stance: AllocatorStance, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (stance) {
    case "scale_in_gradual":
      return ar
        ? "تكلفة الفرصة للانتظار: قد يرتفع السوق قبل بلوغ نقطة الدخول المثلى — الدخول التدريجي يوازن بين هذين الخطرين."
        : "Opportunity cost of waiting: market may appreciate before ideal entry — gradual entry balances both risks.";
    case "wait_confirmation":
      return ar
        ? "تكلفة الانتظار: الغياب عن السوق يُفوّت العائد إذا تحسن الوضع — لكن تكلفة الدخول المبكر في نظام معادٍ أعلى."
        : "Cost of waiting: being out of market misses upside if conditions improve — but cost of early entry in adverse regime is higher.";
    case "avoid_or_reduce":
      return ar
        ? "تكلفة الفرصة: الحفاظ على رأس المال يُفوّت الصعود المحتمل — لكن حماية رأس المال الدائم أكثر قيمة في النظام الحالي."
        : "Opportunity cost: capital preservation misses potential upside — but protecting permanent capital is higher value in current regime.";
    default:
      return ar
        ? "تكلفة الانتظار محدودة في الوضع الحالي — الانتقائية أفضل من التعرض الواسع المتسرّع."
        : "Cost of waiting is limited in current setup — selectivity is better than rushed broad exposure.";
  }
}

function buildScaleInLogic(stance: AllocatorStance, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  if (stance === "scale_in_gradual") {
    return ar
      ? "المنطق المقترح (تعليمي فقط — لا تنفيذ): دفعة 1 (30% من الحجم المستهدف) عند التأكيد الأولي؛ دفعة 2 (30%) عند تأكيد ثانٍ أو تراجع سعري معقول؛ دفعة 3 (40%) عند تأكيد الأطروحة. شرط الانتظار بين الدفعات: 3-4 أسابيع أو حدث بيانات."
      : "Suggested logic (educational only — no execution): Tranche 1 (30% of target size) at initial confirmation; Tranche 2 (30%) at second confirmation or reasonable price pullback; Tranche 3 (40%) at thesis confirmation. Waiting condition between tranches: 3-4 weeks or data event.";
  }
  if (stance === "scale_in_opportunistic") {
    return ar
      ? "المنطق المقترح: حجم أولي صغير (15-20%) عند أسعار التشوه؛ بناء الحجم حصراً على قطاعات الجودة التي تدعمها الميزانية العمومية القوية. مراقبة مستمرة لبيانات الائتمان."
      : "Suggested logic: small initial size (15-20%) at distress prices; build only into quality names supported by strong balance sheets. Continuous credit data monitoring.";
  }
  return ar
    ? "لا يُقترح الدخول التدريجي في الوضع الحالي — النظام لا يدعم بناء المركز."
    : "Gradual entry not suggested in current setup — regime does not support position building.";
}

function buildLiquidityRisk(stance: AllocatorStance, creditStress: string): "low" | "moderate" | "high" {
  if (creditStress === "extreme" || creditStress === "high") return "high";
  if (stance === "avoid_or_reduce" || stance === "reduce_selective") return "moderate";
  if (creditStress === "low") return "low";
  return "moderate";
}

function buildConcentrationNote(isSaudi: boolean, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  return isSaudi
    ? (ar
        ? "مخاطر التركيز السعودية: أرامكو~60% من تاسي — أي محفظة سعودية مركّزة بطبيعتها في النفط. الانتقائية يجب أن تعالج هذا التركيز البنيوي."
        : "Saudi concentration risk: Aramco ~60% of TASI — any Saudi portfolio is structurally concentrated in oil. Selectivity must address this structural concentration.")
    : (ar
        ? "مخاطر التركيز: قطاع واحد >40% أو ورقة واحدة >10% = مخاطرة غير خطية؛ توزيع التعرض أولوية في النظام غير المؤكد."
        : "Concentration risk: single sector >40% or single name >10% = non-linear risk; distributing exposure is a priority in uncertain regime.");
}

function buildDecisionContext(decision: AllocatorDecision, lang: "ar" | "en"): string {
  const ar = lang === "ar";

  const stanceLabel: Record<AllocatorStance, string> = {
    scale_in_gradual:        ar ? "دخول تدريجي" : "scale in gradually",
    scale_in_opportunistic:  ar ? "دخول فرصي انتقائي" : "scale in opportunistically",
    hold_and_monitor:        ar ? "تمسك ومراقبة" : "hold and monitor",
    wait_confirmation:       ar ? "انتظار التأكيد" : "wait for confirmation",
    reduce_selective:        ar ? "تقليص انتقائي" : "reduce selectively",
    avoid_or_reduce:         ar ? "تجنب أو تقليص" : "avoid or reduce",
  };

  const exposureLabel: Record<ExposureRecommendation, string> = {
    broad_index:        ar ? "مؤشر واسع" : "broad index",
    selective_quality:  ar ? "جودة انتقائية" : "selective quality",
    defensive_only:     ar ? "دفاعيات فقط" : "defensives only",
    avoid_or_reduce:    ar ? "تجنب/تقليص" : "avoid/reduce",
  };

  return ar
    ? `[موقف المخصص المؤسسي] الموقف: ${stanceLabel[decision.stance]} (قناعة: ${decision.conviction}%). التعرض: ${exposureLabel[decision.exposureRecommendation]}. المنطق الرئيسي: ${decision.primaryLogic} تكلفة الفرصة: ${decision.opportunityCostNote} ${decision.scaleInLogic}`
    : `[Institutional allocator stance] Stance: ${stanceLabel[decision.stance]} (conviction: ${decision.conviction}%). Exposure: ${exposureLabel[decision.exposureRecommendation]}. Primary logic: ${decision.primaryLogic} Opportunity cost: ${decision.opportunityCostNote} ${decision.scaleInLogic}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derives a conviction-scored allocator decision from objective regime inputs.
 * Educational only — no execution, no broker, no trading.
 * Pure O(1) — no AI calls, no network.
 */
export function deriveAllocatorDecision(
  trackA: { regime?: string; macroBias?: string; creditStressLevel?: string; oilLiquidity?: string } | null,
  consensus: { dominantBias: string; agreementScore: number; strength: string },
  isSaudi: boolean,
  lang: "ar" | "en",
): AllocatorDecision {
  const macroBias = (trackA?.macroBias ?? "neutral") as "bullish" | "bearish" | "neutral";
  const creditStress = (trackA?.creditStressLevel ?? "moderate") as "low" | "moderate" | "high" | "extreme";
  const consensusBias = consensus.dominantBias as "bullish" | "bearish" | "neutral";
  const consensusStrength = consensus.strength as "strong" | "moderate" | "weak" | "conflicted";

  // Try to infer oil context from oilLiquidity string
  const oilText = (trackA?.oilLiquidity ?? "").toLowerCase();
  const oilAboveBreakeven: boolean | null =
    /above|فوق|surplus|فائض|>?\s*80|>?\s*82|>?\s*85/.test(oilText) ? true :
    /below|دون|deficit|عجز|<\s*75|<\s*72|<\s*70/.test(oilText) ? false :
    null;

  // Try to infer Fed easing from rates env
  const ratesText = (trackA as { ratesEnv?: string } | null)?.ratesEnv ?? "";
  const fedEasingExpected: boolean | null =
    /cut|ease|pivot|lower|تخفيف|تخفيض/.test(ratesText.toLowerCase()) ? true :
    /hike|raise|tight|رفع|تشديد/.test(ratesText.toLowerCase()) ? false :
    null;

  const inputs: DecisionInputs = {
    regime: trackA?.regime ?? "unknown",
    macroBias,
    creditStress,
    consensusBias,
    consensusStrength,
    consensusAgreement: consensus.agreementScore,
    oilAboveBreakeven,
    fedEasingExpected,
    isSaudi,
    lang,
  };

  const stance = deriveStance(inputs);
  const conviction = scoreConviction(stance, inputs);
  const preservationPriority = derivePreservationPriority(stance, inputs);
  const exposureRecommendation = deriveExposure(stance, inputs);
  const primaryLogic = buildPrimaryLogic(stance, inputs, lang);
  const opportunityCostNote = buildOpportunityCostNote(stance, lang);
  const scaleInLogic = buildScaleInLogic(stance, lang);
  const liquidityRisk = buildLiquidityRisk(stance, creditStress);
  const concentrationNote = buildConcentrationNote(isSaudi, lang);

  const decision: AllocatorDecision = {
    stance,
    conviction,
    preservationPriority,
    exposureRecommendation,
    primaryLogic,
    opportunityCostNote,
    liquidityRisk,
    concentrationNote,
    scaleInLogic,
    decisionContext: "",
  };

  decision.decisionContext = buildDecisionContext(decision, lang);
  return decision;
}
