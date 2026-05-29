// Phase-68: Portfolio Allocation Intelligence
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from existing portfolio files:
//   portfolioConstruction.ts (Phase 48) — diagnoses what is WRONG with a current portfolio.
//   allocationEngine.ts / portfolioOptimizer.ts — execution weight generation (not this).
//   TrackF — alignment check between existing holdings and macro thesis.
//
// This module reasons about WHICH ALLOCATION APPROACH is appropriate given the
// macro regime and injects that framing into Genesis answers. It covers the six
// dimensions the spec requires:
//   1. Broad vs selective exposure
//   2. Risk-adjusted allocation logic
//   3. Defensive vs cyclical balance
//   4. Concentration risk — when justified vs when dangerous
//   5. Preservation vs growth orientation
//   6. Horizon suitability
//
// All output is educational and advisory. No execution language.
// No "rebalance now", no capital amounts, no specific buy/sell instructions.

import type { Lang } from "@/lib/ai/locale";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AllocationFrame =
  | "broad_exposure"     // diversified, index-like; regime supports general risk-on
  | "selective_exposure" // high-conviction few positions; sector/factor divergence active
  | "defensive"          // capital preservation priority; risk-off or high credit stress
  | "balanced"           // blended growth + defense; regime is transitional or mixed
  | "opportunistic";     // patient entry on specific dislocations; not momentum chasing

export type HorizonLabel =
  | "short_term"   // < 3 months; momentum and tactical framing
  | "medium_term"  // 3-12 months; cycle-phase and earnings framing
  | "long_term";   // > 12 months; structural and valuation framing

export interface AllocationIntelligenceInput {
  question: string;
  regimeBias: "bullish" | "bearish" | "neutral";
  regimeLabel: string;              // e.g. "bull_trending", "high_vol_risk-off"
  creditStress: "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  isSaudi: boolean;
  lang: Lang;
}

export interface AllocationIntelligenceResult {
  frame: AllocationFrame;
  horizon: HorizonLabel;
  broadVsSelective: string;       // 1-2 sentences: when to use each and why now
  riskAdjustedLogic: string;      // 1-2 sentences: asymmetry and quality over size
  defensiveCyclicalBalance: string; // 1-2 sentences: current regime balance
  concentrationRisk: string;      // 1-2 sentences: justified vs dangerous concentration
  preservationVsGrowth: string;   // 1-2 sentences: current orientation
  horizonSuitability: string;     // 1-2 sentences: what horizon fits the current setup
  frameRationale: string;         // 1 sentence: why this frame was selected
  fusionContext: string;          // injectable prompt context block
}

// ─── Horizon detection from question ──────────────────────────────────────────

const SHORT_TERM_Q = /\b(week|day|short.?term|قصير|أسبوع|يوم|near.?term|immediate|near|قريب)/i;
const LONG_TERM_Q  = /\b(year|long.?term|طويل|سنة|3.{0,3}year|5.{0,3}year|decade|structural|هيكلي)/i;
const HORIZON_Q    = /\b(month|6.{0,3}month|quarter|horizon|أشهر|ربع|مدى|أفق)/i;

function detectHorizon(question: string): HorizonLabel {
  if (SHORT_TERM_Q.test(question)) return "short_term";
  if (LONG_TERM_Q.test(question))  return "long_term";
  if (HORIZON_Q.test(question))    return "medium_term";
  return "medium_term"; // default: cycle-phase framing
}

// ─── Frame derivation ─────────────────────────────────────────────────────────

function deriveFrame(
  regimeBias: "bullish" | "bearish" | "neutral",
  regimeLabel: string,
  creditStress: "low" | "moderate" | "high" | "extreme",
  consensus: "strong" | "moderate" | "weak" | "conflicted",
): AllocationFrame {
  const regime = regimeLabel.toLowerCase();

  // Extreme stress or risk-off → defensive
  if (creditStress === "extreme" || regime.includes("risk-off") || regime.includes("bear_ranging")) {
    return "defensive";
  }

  // High credit stress + bearish → defensive regardless of consensus
  if (creditStress === "high" && regimeBias === "bearish") return "defensive";

  // Conflicted consensus or macro_transition → balanced
  if (consensus === "conflicted" || regime.includes("transition")) return "balanced";

  // Strong bull + low credit → broad or selective depending on regime spread
  if (regimeBias === "bullish" && creditStress === "low" && consensus === "strong") {
    return regime.includes("accumulation") ? "broad_exposure" : "selective_exposure";
  }

  // Bullish with moderate credit → selective (quality over quantity)
  if (regimeBias === "bullish" && creditStress !== "high") return "selective_exposure";

  // Bearish + moderate credit → opportunistic (wait for dislocations)
  if (regimeBias === "bearish" && creditStress !== "extreme") return "opportunistic";

  // Weak consensus + neutral → balanced
  if (consensus === "weak" || regimeBias === "neutral") return "balanced";

  return "balanced";
}

// ─── Dimension narrative builders ─────────────────────────────────────────────

function buildBroadVsSelective(frame: AllocationFrame, regimeBias: string, lang: Lang): string {
  const ar = lang === "ar";
  switch (frame) {
    case "broad_exposure":
      return ar
        ? "التعرض الواسع مبرر عندما تنتعش معظم القطاعات معاً وتكون الفروق بين الأصول محدودة — نظام الانتعاش الكلي يُقلّص ميزة الانتقائية. الاستثمار في مؤشر عريض يُقلّل خطأ الانتقاء دون التضحية بالاتجاه."
        : "Broad exposure is justified when most sectors rise together and inter-asset dispersion is low — a broad macro recovery regime reduces the edge of selectivity. Index-level exposure minimises selection error without sacrificing directional participation.";
    case "selective_exposure":
      return ar
        ? "الانتقائية تتفوق على التعرض الواسع عندما تتباعد القطاعات وتتمايز الجودة — الدورة المتقدمة والتضخم المرتفع والقيادة القطاعية الضيقة تُعزز الانتقائية. ابحث عن أسهم ذات كتالوج أرباح قوي وميزانية متينة بدلاً من شراء المؤشر كاملاً."
        : "Selectivity outperforms broad exposure when sectors diverge and quality differentiation is active — late cycle, elevated dispersion, and narrow sector leadership all strengthen the selective case. Seek earnings quality and balance sheet strength rather than index-level participation.";
    case "defensive":
      return ar
        ? "في بيئة الحذر، التعرض الواسع يحمل مخاطر هبوط غير متناسبة — أسهم المؤشر تشمل قطاعات دورية عالية التقلب. التركيز الضيق على الدفاعيات ذات التدفق النقدي المرئي يُفضّل التعرض الواسع."
        : "In a risk-off environment, broad exposure carries asymmetric downside — index-level holdings include high-volatility cyclicals. Narrow focus on defensives with visible cash flow is preferred over broad market participation.";
    case "balanced":
      return ar
        ? "النظام الانتقالي يستدعي مزجاً من التعرض الواسع في القطاعات الدفاعية مع الانتقائية في الدورية — لا التعرض الواسع الكامل ولا التركيز الضيق. التوازن بين الأسهم ذات العوائد المرتفعة والقطاعات النامية يُحدّ من الخطأ في تحديد توقيت الدورة."
        : "A transitional regime calls for blending broad exposure within defensives and selectivity within cyclicals — neither full broad nor narrow concentration. Balancing yield-anchored names with growth exposure reduces cycle-timing error.";
    case "opportunistic":
      return ar
        ? "الأسواق الهابطة أو المتذبذبة تخلق انتشاراً في التقييم بين الأصول — الانتقائية المنضبطة على نقاط دخول محددة تتفوق على المشاركة العامة. لا مطاردة الزخم؛ انتظر الانخفاضات المحددة التي توفر هامش أمان."
        : "Bear or range-bound markets create valuation dispersion across assets — disciplined selectivity around specific entry conditions outperforms general participation. No momentum chasing; wait for defined pullbacks that offer a margin of safety.";
  }
}

function buildRiskAdjustedLogic(creditStress: string, frame: AllocationFrame, lang: Lang): string {
  const ar = lang === "ar";
  const creditNote = creditStress === "high" || creditStress === "extreme"
    ? (ar
        ? "ضغط الائتمان المرتفع يرفع تكلفة الأموال ويُضغط على الرافعة المالية — العائد المعدّل بالمخاطر أهم من العائد المطلق في هذه البيئة."
        : "Elevated credit stress raises the cost of capital and compresses leverage — risk-adjusted return matters more than absolute return in this environment.")
    : (ar
        ? "ظروف الائتمان تسمح بالتعرض الانتقائي للفرص عالية الجودة دون ضغط تمويلي فوري."
        : "Credit conditions permit selective exposure to quality opportunities without immediate funding pressure.");

  return ar
    ? `التخصيص المعدّل بالمخاطر يعني ترجيح جودة التوقيت (الدخول في نقاط انخفاض الضغط) والحجم (التناسب مع مستوى الثقة) على الجودة الطيفية فقط. ${creditNote} التركيز على أصول ذات مدفوعات نقدية مرئية أو هوامش أمان في التقييم يُحسّن ملف المخاطر دون التضحية بكامل الصعود.`
    : `Risk-adjusted allocation means weighting entry timing quality (entering at stress-point lows) and size (proportional to conviction level) over spectral quality alone. ${creditNote} Focusing on assets with visible cash distributions or valuation margins of safety improves the risk profile without surrendering full upside participation.`;
}

function buildDefensiveCyclicalBalance(
  frame: AllocationFrame, regimeBias: string, creditStress: string, lang: Lang,
): string {
  const ar = lang === "ar";
  const cycleNote = regimeBias === "bullish"
    ? (ar ? "الإشارات الكلية تدعم الدوريين بشكل أفضل نسبياً." : "Macro signals relatively favour cyclicals.")
    : regimeBias === "bearish"
    ? (ar ? "الإشارات الكلية تدعم الدفاعيين بشكل أفضل نسبياً." : "Macro signals relatively favour defensives.")
    : (ar ? "الإشارات الكلية متوازنة بين الدوريين والدفاعيين." : "Macro signals are balanced between cyclicals and defensives.");

  if (frame === "defensive")
    return ar
      ? `${cycleNote} الدفاعيون (الرعاية الصحية، المرافق، العوائد المستقرة، السيولة) يُمثّلون الملاذ الهيكلي في بيئة ضغط الائتمان المرتفع. الدوريون عرضة للضغط المزدوج: تراجع الأرباح + انضغاط مضاعفات التقييم.`
      : `${cycleNote} Defensives (healthcare, utilities, stable yields, liquidity) provide structural shelter in a high credit stress environment. Cyclicals face dual pressure: earnings downgrades + valuation multiple compression.`;

  if (frame === "selective_exposure" || frame === "opportunistic")
    return ar
      ? `${cycleNote} التوازن بين الدوريين والدفاعيين يجب أن يعكس وضع الدورة: الدوريون منطقيون في بداية ومنتصف الدورة مع أرباح قوية؛ الدفاعيون أكثر منطقية في نهاية الدورة أو أثناء الانتقال. الميزانيات العمومية القوية تتفوق على الأصول عالية الرافعة في كلا الفئتين.`
      : `${cycleNote} Defensive-cyclical balance should reflect cycle positioning: cyclicals are rational in early-to-mid cycle with strong earnings; defensives are more rational in late cycle or during transitions. Strong balance sheets outperform high-leverage names within both categories.`;

  return ar
    ? `${cycleNote} التوازن المتساوي بين الدوريين والدفاعيين يُقلّل خطأ توقيت الدورة في النظام الانتقالي. المزج يتضمن: أصول دفاعية ذات عوائد (للحد من الهبوط) + دوريون ذوو ميزانيات قوية (للمشاركة في الصعود).`
    : `${cycleNote} An equal defensive-cyclical balance reduces cycle-timing error in a transitional regime. The mix involves: yield-anchored defensives (to limit downside) + balance-sheet-strong cyclicals (to capture upside participation).`;
}

function buildConcentrationRisk(frame: AllocationFrame, consensus: string, lang: Lang): string {
  const ar = lang === "ar";
  const isConflicted = consensus === "conflicted" || consensus === "weak";

  if (frame === "selective_exposure" && !isConflicted)
    return ar
      ? "التركيز مبرر في بيئة الإشارات المتوافقة عندما تكون قناعة الأطروحة عالية والأدلة المتقاطعة داعمة — فارق الجودة في الأرباح يكافئ التركيز. يصبح خطراً عندما يُدار تركيز واحد بإشارات متعارضة أو ضغط ائتمان مرتفع دون هامش أمان في التقييم."
      : "Concentration is justified in an aligned-signal environment when thesis conviction is high and cross-asset evidence is supportive — earnings quality dispersion rewards concentration. It becomes dangerous when a single concentration is managed against conflicting signals or high credit stress without a valuation margin of safety.";

  if (frame === "defensive")
    return ar
      ? "التركيز في الدفاعيين يُقلّل مخاطر الهبوط الكلي في نظام الحذر، لكنه يُعرّض المحفظة لمخاطر خاصة بالشركة — التنويع داخل الدفاعيين (مثال: الرعاية الصحية + المرافق + العوائد المستقرة) يحافظ على الحماية مع الحد من خطر الأصل المنفرد."
      : "Concentration within defensives reduces macro downside in a risk-off regime but exposes the portfolio to company-specific risk — diversifying within defensives (e.g. healthcare + utilities + stable yields) preserves protection while limiting single-name risk.";

  return ar
    ? "في بيئة الإشارات المتعارضة أو الضعيفة، التركيز يضاعف الخطأ الاتجاهي — توزيع المحفظة عبر قطاعات أو أصول متعددة يُقلّل من تأثير إشارة فردية خاطئة. التركيز الذي يتجاوز 30-40% في موضع واحد يستحق مراجعة بشرية في أي نظام."
    : "In a conflicted or weak signal environment, concentration amplifies directional error — spreading across multiple sectors or asset classes reduces the impact of a single incorrect signal. Concentration exceeding 30-40% in a single position warrants human review in any regime.";
}

function buildPreservationVsGrowth(frame: AllocationFrame, horizon: HorizonLabel, lang: Lang): string {
  const ar = lang === "ar";

  if (frame === "defensive")
    return ar
      ? "التوجه الحالي يدعم حفظ رأس المال كأولوية — في بيئة ضغط الائتمان والمخاطر، الحد من خسارة الرأس المال يستحق التضحية ببعض الصعود. النمو يصبح الأولوية عند عودة النظام إلى الوضع الإيجابي مع تراجع ضغط الائتمان."
      : "Current orientation supports capital preservation as the priority — in a credit-stress and risk-off environment, limiting capital drawdown is worth sacrificing some upside. Growth orientation becomes appropriate when regime returns to constructive with credit stress normalising.";

  if (frame === "broad_exposure" || (frame === "selective_exposure" && horizon !== "short_term"))
    return ar
      ? "التوجه الحالي يدعم النمو المعدّل بالمخاطر — النظام الإيجابي يسمح بتفضيل الأصول التي تُعظّم الصعود على المدى المتوسط. حفظ رأس المال يتم عبر إدارة الحجم والانضباط في التقييم، لا عبر تجنب التعرض."
      : "Current orientation supports risk-adjusted growth — a constructive regime permits favouring assets that maximise medium-term upside. Capital preservation is achieved through sizing discipline and valuation entry, not exposure avoidance.";

  if (frame === "opportunistic")
    return ar
      ? "التوجه الانتهازي يوازن بين الحفظ في الحالة الأساسية والنمو في الحالة المُطالبة — الصبر على نقطة دخول محددة يُعظّم التوازن بين الصعود والهبوط. لا تضحية برأس المال دون هامش أمان في التقييم."
      : "An opportunistic orientation balances preservation in the base case with growth in the triggered case — patience for a defined entry maximises the upside/downside balance. No capital is sacrificed without a valuation margin of safety.";

  // balanced, default
  return ar
    ? "النظام الانتقالي يستدعي خلطاً متوازناً من الاثنين: أصول ذات عوائد مرئية (الجانب الحافظ) + أصول ذات صعود انتقائي في القطاعات المواتية (الجانب النامي). الحد من التعرض للأصول ذات المدة الطويلة في بيئة الأسعار المرتفعة يُقلّل التقلب دون خفض التوجه الكلي."
    : "A transitional regime calls for a blended orientation: yield-visible assets (the preservation side) + selective upside in favoured sectors (the growth side). Limiting long-duration exposure in a high-rate environment reduces volatility without lowering the overall growth orientation.";
}

function buildHorizonSuitability(frame: AllocationFrame, horizon: HorizonLabel, lang: Lang): string {
  const ar = lang === "ar";

  if (horizon === "short_term")
    return ar
      ? "الأفق القصير (أقل من 3 أشهر) يُركّز على الزخم والمحفزات قريبة الأجل — التقييم أقل أهمية على المدى القصير مقارنة بالمحفز الفوري والتموضع. النظام الحالي ومستوى ضغط الائتمان يُحدّدان جاذبية قصيرة الأجل بشكل مستقل عن القيمة الجوهرية."
      : "A short-term horizon (< 3 months) focuses on momentum and near-term catalysts — valuation matters less at this time frame than immediate catalyst and positioning. The current regime and credit stress level determine short-term attractiveness independently of intrinsic value.";

  if (horizon === "long_term")
    return ar
      ? "الأفق الطويل (أكثر من 12 شهراً) يُركّز على التقييم الهيكلي وجودة الأرباح ومتانة الميزانية — تذبذبات الدورة الكلية قصيرة الأجل أقل صلة. الأصول ذات المزايا التنافسية الدائمة وقوة التسعير تُعظّم عوائد الأفق الطويل في معظم البيئات الكلية."
      : "A long-term horizon (> 12 months) focuses on structural valuation, earnings quality, and balance sheet durability — short-term macro cycle fluctuations are less relevant. Assets with durable competitive advantages and pricing power maximise long-horizon returns across most macro environments.";

  // medium_term
  return ar
    ? "الأفق المتوسط (3-12 أشهر) يُركّز على وضع الدورة والتوجه الكلي — يوفر وقتاً كافياً لتحقّق المحفزات الأساسية مع الحد من التعرض لعدم يقين الدورة الكاملة. أدوات الانتقاء المناسبة هي: توقيت الدخول في الدورة، مراحل الأرباح، ومستويات ضغط الائتمان."
    : "A medium-term horizon (3-12 months) focuses on cycle positioning and macro directional alignment — provides enough time for fundamental catalysts to materialise while limiting exposure to full-cycle uncertainty. The right selection tools are: cycle entry timing, earnings phases, and credit stress levels.";
}

// ─── Frame rationale ─────────────────────────────────────────────────────────

function buildFrameRationale(
  frame: AllocationFrame,
  regimeBias: string,
  creditStress: string,
  consensus: string,
  lang: Lang,
): string {
  const ar = lang === "ar";
  const descriptions: Record<AllocationFrame, { en: string; ar: string }> = {
    broad_exposure:     { en: "broad exposure selected: strong consensus + low credit stress + bullish bias supports general participation.", ar: "التعرض الواسع مُختار: إجماع قوي + ضغط ائتمان منخفض + توجه صاعد يدعم المشاركة العامة." },
    selective_exposure: { en: "selective exposure selected: regime supports directionality but sector divergence rewards quality discrimination over broad index.", ar: "الانتقائية مُختارة: النظام يدعم الاتجاهية لكن تباعد القطاعات يُكافئ التمييز القائم على الجودة على المؤشر الواسع." },
    defensive:          { en: "defensive orientation selected: credit stress and/or risk-off regime makes capital preservation the primary objective.", ar: "التوجه الدفاعي مُختار: ضغط الائتمان و/أو نظام الحذر يجعل حفظ رأس المال الهدف الأول." },
    balanced:           { en: "balanced orientation selected: conflicted signals or transitional regime reduces conviction for a directional tilt.", ar: "التوجه المتوازن مُختار: الإشارات المتعارضة أو النظام الانتقالي يُقلّص القناعة بأي ميل اتجاهي." },
    opportunistic:      { en: "opportunistic orientation selected: bearish or range-bound regime creates entry-condition-dependent asymmetry.", ar: "التوجه الانتهازي مُختار: النظام الهابط أو المتذبذب يُنشئ تناسباً مشروطاً بشروط الدخول." },
  };
  return ar ? descriptions[frame].ar : descriptions[frame].en;
}

// ─── Fusion context builder ───────────────────────────────────────────────────

function buildFusionContext(result: Omit<AllocationIntelligenceResult, "fusionContext">, lang: Lang): string {
  const ar = lang === "ar";
  const lines: string[] = [];

  lines.push(ar
    ? "ذكاء التخصيص — استخدمه لإطار التحليل التخصيصي التعليمي فقط:"
    : "Allocation Intelligence — use for educational allocation framing only:");

  lines.push(ar ? `الإطار: ${result.frame.replace(/_/g, " ")} — ${result.frameRationale}` : `Frame: ${result.frame.replace(/_/g, " ")} — ${result.frameRationale}`);
  lines.push(ar ? `الأفق: ${result.horizon.replace(/_/g, " ")} — ${result.horizonSuitability}` : `Horizon: ${result.horizon.replace(/_/g, " ")} — ${result.horizonSuitability}`);
  lines.push(ar ? `واسع مقابل انتقائي: ${result.broadVsSelective}` : `Broad vs selective: ${result.broadVsSelective}`);
  lines.push(ar ? `التخصيص المعدّل بالمخاطر: ${result.riskAdjustedLogic}` : `Risk-adjusted logic: ${result.riskAdjustedLogic}`);
  lines.push(ar ? `التوازن الدفاعي/الدوري: ${result.defensiveCyclicalBalance}` : `Defensive/cyclical balance: ${result.defensiveCyclicalBalance}`);
  lines.push(ar ? `مخاطر التركيز: ${result.concentrationRisk}` : `Concentration risk: ${result.concentrationRisk}`);
  lines.push(ar ? `الحفظ مقابل النمو: ${result.preservationVsGrowth}` : `Preservation vs growth: ${result.preservationVsGrowth}`);

  lines.push(ar
    ? "القاعدة الإلزامية: كل هذا المحتوى تعليمي وتحليلي فقط. ممنوع: 'أعِد التوازن الآن'، 'اشترِ X'، 'مضمون العائد'، مبالغ رأسمال محددة، توصيات تنفيذية."
    : "Mandatory rule: all of this content is educational and analytical only. FORBIDDEN: 'rebalance now', 'buy X', 'guaranteed return', specific capital amounts, execution recommendations.");

  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildAllocationIntelligence(
  input: AllocationIntelligenceInput,
): AllocationIntelligenceResult {
  const { question, regimeBias, regimeLabel, creditStress, consensusStrength, lang } = input;

  const frame   = deriveFrame(regimeBias, regimeLabel, creditStress, consensusStrength);
  const horizon = detectHorizon(question);

  const broadVsSelective          = buildBroadVsSelective(frame, regimeBias, lang);
  const riskAdjustedLogic         = buildRiskAdjustedLogic(creditStress, frame, lang);
  const defensiveCyclicalBalance  = buildDefensiveCyclicalBalance(frame, regimeBias, creditStress, lang);
  const concentrationRisk         = buildConcentrationRisk(frame, consensusStrength, lang);
  const preservationVsGrowth      = buildPreservationVsGrowth(frame, horizon, lang);
  const horizonSuitability        = buildHorizonSuitability(frame, horizon, lang);
  const frameRationale            = buildFrameRationale(frame, regimeBias, creditStress, consensusStrength, lang);

  const partial: Omit<AllocationIntelligenceResult, "fusionContext"> = {
    frame, horizon, broadVsSelective, riskAdjustedLogic,
    defensiveCyclicalBalance, concentrationRisk,
    preservationVsGrowth, horizonSuitability, frameRationale,
  };

  const fusionContext = buildFusionContext(partial, lang);
  return { ...partial, fusionContext };
}
