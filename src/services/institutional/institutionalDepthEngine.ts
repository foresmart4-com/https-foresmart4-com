// P0 Genesis Intelligence Rescue — Institutional Depth Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Purpose:
//   The existing layers (institutionalReasoning, sectorIntelligence, committeeDebate)
//   enforce FIELD PRESENCE and MACRO CHAIN STRUCTURE. What they do NOT enforce:
//     - Explicit transmission chain format (X → Y → Z → investment implication)
//     - Second-order contagion effects (what follows from the direct effect)
//     - Allocator psychology (how a real institutional allocator with AUM + drawdown
//       constraints + mandate actually deploys capital in this regime)
//     - Regime conflict resolution (what wins when signals diverge, and why)
//     - Valuation vs earnings distinction (multiple expansion ≠ earnings growth)
//     - Policy reaction functions (if inflation does X, CB will do Y, therefore Z)
//     - Liquidity and credit channel specifics
//     - Risk/reward asymmetry framing
//     - Saudi mandatory depth beyond the 5-channel list
//
//   This engine injects a "DEPTH ENFORCEMENT DIRECTIVE" into the fusion prompt that
//   forces the AI to reason through all 10 institutional depth dimensions — not as
//   optional extras but as the expected output format for serious investment questions.

// ─── Track slices (mirrors qualityGate / institutionalReasoning interfaces) ────

interface TrackASlice {
  regime?: string;
  macroSummary?: string;
  ratesEnv?: string;
  oilLiquidity?: string;
  dxyImpact?: string;
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  macroBias?: "bullish" | "bearish" | "neutral";
  regimeConf?: number;
}

interface TrackDSlice {
  uncertaintyLevel?: "low" | "moderate" | "high" | "extreme";
  primaryRisk?: string;
  counterCase?: string;
  invalidationTrigger?: string;
  confidenceChallenge?: string;
  thesisWeakness?: string;
}

interface ConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
}

export interface DepthEngineResult {
  depthContext: string;
  saudiDepthContext: string;
  dimensionsInjected: string[];
}

// ─── Dimension 1: Transmission Chain Format ──────────────────────────────────
// Explicit instruction to show full causal paths in arrow format.

function buildTransmissionChainDirective(
  trackA: TrackASlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  if (ar) {
    const chain = trackA?.ratesEnv
      ? `سلسلة نقل إشارة الأسعار: ${trackA.ratesEnv} → تكلفة رأس المال ترتفع/تنخفض → مضاعفات تقييم الأسهم تنضغط/تتوسع → قرار تخصيص رأس المال بين فئات الأصول.`
      : "سلسلة نقل الإشارات (مطلوبة): [عامل الماكرو] → [آلية المفعول] → [تأثير على فئة الأصول] → [تداعية الاستثمار].";
    const oil = isSaudi
      ? `قناة النفط السعودية: سعر النفط $X → [فوق/تحت] نقطة التعادل $75-80 → فائض/عجز الميزانية → الإنفاق الحكومي [يتسارع/يتعاقد] → النمو الاقتصادي غير النفطي [يستفيد/يتراجع] → تاسي.`
      : "";
    return [chain, oil].filter(Boolean).join("\n");
  }

  const chain = trackA?.ratesEnv
    ? `Rates transmission chain: ${trackA.ratesEnv} → cost of capital rises/falls → equity valuation multiples compress/expand → capital allocation decision across asset classes.`
    : "Transmission chain format (mandatory): [macro factor] → [mechanism] → [asset class effect] → [investment implication].";
  const oil = isSaudi
    ? "Saudi oil channel: oil at $X → [above/below] fiscal breakeven ~$75-80 → budget surplus/deficit → government spending [accelerates/contracts] → non-oil GDP growth [benefits/declines] → TASI."
    : "";
  return [chain, oil].filter(Boolean).join("\n");
}

// ─── Dimension 2: Second-Order Effects ───────────────────────────────────────
// Forces reasoning about contagion effects BEYOND the direct impact.

function buildSecondOrderDirective(
  trackA: TrackASlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const credit = trackA?.creditStressLevel ?? "moderate";

  if (ar) {
    const base = `التأثيرات من الدرجة الثانية (مطلوبة — تجاوز الأثر المباشر):
- إذا انخفض النفط دون نقطة التعادل → أولاً: الإيرادات الحكومية تراجعت. ثانياً: الإقراض المصرفي يتراجع → نمو الائتمان يتباطأ → التقييمات العقارية تتراجع → ثروة الأسرة تنضغط.
- إذا رفع الفيدرالي الأسعار → أولاً: الريال يبقى مربوطاً بالدولار. ثانياً: SAMA تتبع → تكلفة الإقراض المحلي ترتفع → نمو الرهن العقاري يتراجع → قطاع الإسكان يتأثر → أرباح البنوك من الرسوم تنضغط.`;
    const creditNote = credit === "high" || credit === "extreme"
      ? `\n- ضغط ائتماني ${credit === "extreme" ? "شديد" : "مرتفع"}: القنوات الثانوية تتفاقم — اتساع فوارق الائتمان يرفع تكلفة إعادة التمويل → الأصول المدعومة بالرافعة المالية تتراجع بأسرع من الأصول الأساسية.`
      : "";
    return base + creditNote;
  }

  const base = `Second-order effects (mandatory — reason beyond the direct impact):
- If oil falls below fiscal breakeven → First: government revenues decline. Second-order: bank lending slows → credit growth contracts → real estate valuations compress → household wealth effect dampens consumption.
- If Fed raises rates → First: SAR peg holds. Second-order: SAMA shadows Fed → local borrowing costs rise → mortgage growth declines → housing sector pressures → bank fee income compresses.`;
  const creditNote = credit === "high" || credit === "extreme"
    ? `\n- ${credit === "extreme" ? "Extreme" : "High"} credit stress: secondary channels amplify — credit spread widening raises refinancing costs → leveraged assets decline faster than fundamental assets.`
    : "";
  return base + creditNote;
}

// ─── Dimension 3: Allocator Psychology ───────────────────────────────────────
// Forces reasoning from the perspective of a real institutional allocator.
// Not "the market is X" but "an allocator with a mandate would do Y because Z".

function buildAllocatorPsychologyDirective(
  trackA: TrackASlice | null,
  consensus: ConsensusSlice,
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const bias = consensus.dominantBias;
  const strength = consensus.strength;
  const regime = trackA?.regime ?? "current regime";
  const credit = trackA?.creditStressLevel ?? "moderate";

  const allocatorStance = () => {
    if (bias === "bullish" && strength === "strong" && credit === "low") return ar ? "دخول تدريجي بمرونة — النظام يدعم التوجه الصاعد." : "scale in gradually — regime supports constructive bias.";
    if (bias === "bullish" && (credit === "high" || credit === "extreme")) return ar ? "انتظار تأكيد قبل البناء — تضارب بين الزخم والائتمان." : "wait for confirmation before building — momentum-credit conflict.";
    if (bias === "bearish") return ar ? "تقليص تدريجي أو تحوط — النظام هابط." : "reduce exposure or hedge — regime is bearish.";
    if (strength === "conflicted") return ar ? "تعرض محدود حتى تتضح الإشارات — تضارب الوكلاء يرفع تكلفة الخطأ." : "limit exposure until signals clarify — conflicted agents raise cost of error.";
    return ar ? "انتقائية قطاعية بدلاً من التعرض الواسع — النظام يستوجب التمييز." : "sector selectivity over broad exposure — regime requires discrimination.";
  };

  if (ar) {
    return `علم نفس المخصص المؤسسي (مطلوب — أفق 12-24 شهراً):
المخصص المحافظ مع قيود على الحد الأقصى للتراجع:
- موقف الدخول: ${allocatorStance()}
- منطق التوقيت: المخصص المؤسسي يميّز بين "السعر العادل" و"سعر الدخول المناسب" — نظام ${regime} قد يكون السعر عادلاً لكن قوة الاتجاه والمحفز القريب يحددان التوقيت.
- تحيّز ضبط النفس: في غياب إشارة تقنية حاسمة، الانتظار هو القرار الصواب — ليس الخمول.
- قيود الإلزام: في النظام مرتفع التذبذب أو النظام المتضارب، تكلفة الخطأ تفوق تكلفة الانتظار.
- التمييز القطاعي: المخصص يفضّل الجودة على الزخم عند ارتفاع ضغط الائتمان — ${credit === "high" || credit === "extreme" ? `ضغط ${credit} يدفع للتعرض الدفاعي.` : "الضغط الائتماني الحالي يسمح ببعض التعرض الدوري."}`
    ;
  }

  return `Institutional allocator psychology (mandatory — 12-24 month horizon):
Conservative allocator with drawdown-constraint mandate:
- Deployment stance: ${allocatorStance()}
- Timing logic: institutional allocators distinguish "fair value" from "entry price" — ${regime} regime may be fairly valued but trend strength and near-term catalyst determine deployment timing.
- Restraint bias: in the absence of a decisive technical confirmation, waiting IS the correct decision — not inaction.
- Commitment constraints: in high-volatility or conflicted regimes, cost of error exceeds cost of waiting.
- Sector discrimination: allocator favors quality over momentum when credit stress is elevated — ${credit === "high" || credit === "extreme" ? `${credit} credit stress pushes toward defensive exposure.` : "current credit stress allows modest cyclical exposure."}`;
}

// ─── Dimension 4: Regime Conflict Resolution ─────────────────────────────────
// When macro/technical/cross-asset signals conflict, forces explicit resolution.

function buildRegimeConflictDirective(
  trackA: TrackASlice | null,
  consensus: ConsensusSlice,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  if (consensus.strength !== "conflicted" && consensus.strength !== "weak") return "";

  if (ar) {
    return `تعارض نظام السوق (مطلوب لأن الإجماع ${consensus.strength}):
قاعدة حل التعارض: عند تضارب الإشارات، صرّح بـ:
1. أي الإشارات تتعارض (مثال: ماكرو صاعد + تقني هابط)؟
2. أي الإشارتين لها وزن دليل أعلى في النظام الحالي ولماذا؟
3. ما الإطار الزمني الذي تُحلّ فيه الحالة (في المدى القريب، في المدى المتوسط)؟
4. ماذا يعني ذلك للمخصص: انتظار التأكيد أم التحوط مع بناء مركز صغير؟
الإجماع الحالي: ${consensus.agreementScore}% تطابق (${consensus.strength}) — لا يجوز إبداء رأي اتجاهي عالي الثقة دون الإفصاح عن التضارب.`;
  }

  return `Regime conflict (mandatory because consensus is ${consensus.strength}):
Conflict resolution rule — when signals diverge, explicitly state:
1. Which signals are in conflict (e.g., bullish macro + bearish technical)?
2. Which signal has higher evidence weight in the current regime and why?
3. What timeframe resolves the conflict (near-term, medium-term)?
4. What this means for the allocator: wait for confirmation or hedge while building a small position?
Current consensus: ${consensus.agreementScore}% agreement (${consensus.strength}) — a high-confidence directional thesis without conflict disclosure is a failure.`;
}

// ─── Dimension 5: Valuation vs Earnings Distinction ──────────────────────────
// Forces the AI to distinguish multiple expansion from actual earnings growth.

function buildValuationEarningsDirective(
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  if (ar) {
    return `التمييز بين التقييم والأرباح (مطلوب لأسئلة الاستثمار):
- توسّع المضاعفات ≠ نمو الأرباح. يجب التمييز بوضوح: هل الصعود المتوقع مدفوع بتوسّع P/E (قائم على تيسير مالي أو إعادة تسعير المخاطر) أم نمو EPS (قائم على الإيرادات والهوامش الفعلية)؟
- توسّع المضاعفات أكثر هشاشةً: يمكن عكسه بسرعة عند تغيير السياسة النقدية.
- نمو الأرباح أكثر إسناداً: لكن يتطلب توقعات إيرادات مستقرة.
${isSaudi ? "- تاسي: نمو أرباح أرامكو مرتبط بأسعار النفط والإنتاج — هل التقييمات الحالية تعكس أرباح دورة كاملة أم نقطة بيانات واحدة؟" : ""}`;
  }

  return `Valuation vs earnings distinction (mandatory for investment questions):
- Multiple expansion ≠ earnings growth. Explicitly distinguish: is the expected upside from P/E expansion (driven by monetary easing or risk repricing) or EPS growth (driven by actual revenue and margin improvement)?
- Multiple expansion is more fragile: it reverses rapidly on policy tightening.
- Earnings growth is more durable: but requires stable revenue forecasts.
${isSaudi ? "- TASI: Aramco earnings growth is oil-price and production-volume linked — do current valuations price a full-cycle earnings level or a single data point?" : ""}`;
}

// ─── Dimension 6: Policy Reaction Function ───────────────────────────────────
// Forces explicit "if inflation/data does X, CB will do Y, therefore asset Z" chains.

function buildPolicyReactionDirective(
  trackA: TrackASlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const ratesEnv = trackA?.ratesEnv ?? "";
  if (ar) {
    return `دالة ردّ الفعل السياسي (مطلوبة):
صياغة: "إذا كانت بيانات [X]، فإن [البنك المركزي] سيكون [أكثر/أقل] ميلاً إلى [رفع/خفض/التثبيت]، مما يعني أن أسعار الأصول [تُعاد تسعيرها بشكل أعلى/أدنى/جانبياً] من خلال قناة [التقييم/الائتمان/تدفقات رأس المال]".
${ratesEnv ? `السياق الحالي: ${ratesEnv}` : ""}
${isSaudi ? `SAMA: لأن الريال مربوط بالدولار، SAMA مُقيّدة في السياسة المستقلة — إذا بقي الفيدرالي ثابتاً أو رفع، تبقى تكاليف الإقراض السعودية مرتفعة → تأثير سلبي على القطاعات ذات المضاعفات المرتفعة، مدعوم للقطاعات ذات التدفقات النقدية العالية (أرامكو، البنوك التجارية).` : ""}`;
  }

  return `Policy reaction function (mandatory):
Format: "If [X data/event], then [central bank] will be [more/less] inclined to [raise/cut/hold], which means [asset prices reprice higher/lower/sideways] through the [valuation/credit/capital flows] channel."
${ratesEnv ? `Current rate environment: ${ratesEnv}` : ""}
${isSaudi ? `SAMA: because SAR is pegged to USD, SAMA is constrained from independent policy — if Fed holds or hikes, Saudi borrowing costs remain elevated → negative for high-multiple sectors, supportive for high-cash-flow sectors (Aramco, commercial banks).` : ""}`;
}

// ─── Dimension 7: Liquidity and Credit Channel ───────────────────────────────

function buildLiquidityCreditDirective(
  trackA: TrackASlice | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const credit = trackA?.creditStressLevel ?? "moderate";
  const oilLiq = trackA?.oilLiquidity ?? "";
  if (ar) {
    return `قناة السيولة والائتمان (مطلوبة):
- السيولة العالمية (الدولار): ${oilLiq || "اتجاه السيولة العالمية من خلال الميزانية العمومية للفيدرالي + DXY"} → قدرة تمويل المخاطرة في الأسواق الناشئة.
- ضغط الائتمان: ${credit} → ${credit === "low" ? "التمويل بالرافعة متاح، الأسواق ذات العائد المرتفع نشطة، دعم رأس المال الجريء." : credit === "high" || credit === "extreme" ? `ضغط ${credit}: فوارق الائتمان تتسع → تكلفة الاقتراض ترتفع → إعادة تمويل الأسهم تتراجع → الأصول المدعومة بالرافعة تضغط.` : "ائتمان محايد: يتيح استثماراً انتقائياً محافظاً."}
- ترتيب الأولويات للمخصص: في ظل ضغط ائتماني ${credit === "high" || credit === "extreme" ? "مرتفع" : "منخفض إلى معتدل"}، الميزانية العمومية الجيدة تتفوق على النمو الموعود بالرافعة.`;
  }

  return `Liquidity and credit channel (mandatory):
- Global liquidity (dollar): ${oilLiq || "global liquidity direction via Fed balance sheet + DXY"} → risk-asset funding capacity in emerging markets.
- Credit stress: ${credit} → ${credit === "low" ? "leveraged financing available, high-yield active, risk capital supportive." : credit === "high" || credit === "extreme" ? `${credit} credit stress: spreads widening → borrowing costs rise → equity buyback capacity declines → leveraged assets compress.` : "neutral credit: allows conservative selective investment."}
- Allocator priority: under ${credit === "high" || credit === "extreme" ? "elevated" : "low-to-moderate"} credit stress, strong balance sheet quality outperforms leveraged growth promises.`;
}

// ─── Dimension 8: Sector Rotation Logic ──────────────────────────────────────
// Forces explicit sector winners/losers with causal mechanism, not just labels.

function buildSectorRotationDirective(
  trackA: TrackASlice | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const bias = trackA?.macroBias ?? "neutral";
  const credit = trackA?.creditStressLevel ?? "moderate";

  if (ar) {
    const globalRotation = bias === "bullish"
      ? "الدوريات والتقنية (استفادة من مضاعفات التوسع) > الدفاعيات (متراجعة في النظام الصاعد)."
      : bias === "bearish"
        ? "الدفاعيات والسلع الأساسية والمرافق (تدفقات نقدية مستقرة ومدفوعات أرباح) > الدوريات والتقنية ذات الرافعة العالية."
        : "الانتقائية القطاعية تتفوق على التعرض الواسع — لا توجد قيادة قطاعية واضحة في النظام المتذبذب.";
    const saudiRotation = isSaudi
      ? `\nدوران القطاعات السعودية:
- البنوك: ترتفع مع أسعار الفائدة (هامش الفائدة الصافي يتوسع) لكن تتراجع عند تراجع الائتمان.
- الطاقة (أرامكو): الدفاعي الأول — توزيعات ثابتة تدعم التقييم في النظام غير المؤكد.
- البتروكيماويات (سابك): مرتبطة بالطلب الصيني + هوامش الإيثيلين — أكثر تذبذباً من الدفاعيات.
- رؤية 2030 (البنية التحتية/الترفيه): التمويل مرتبط بسعر النفط — معرّض لتراجع الإنفاق عند انخفاض النفط.
- الاتصالات/الرعاية الصحية: دفاعي جزئي — نمو مستقر لكن مضاعفات متوسطة.`
      : "";
    return `منطق دوران القطاعات (مطلوب):
الدوران العالمي الحالي: ${globalRotation}
قاعدة الضغط الائتماني: ${credit === "high" || credit === "extreme" ? `ضغط ${credit} → الجودة على الزخم (P/B منخفض + تدفق نقدي حر + دين منخفض).` : "ضغط ائتماني منخفض → التعرض الدوري مستساغ مع إدارة المخاطر."}${saudiRotation}`;
  }

  const globalRotation = bias === "bullish"
    ? "Cyclicals and technology (benefit from multiple expansion) > defensives (lag in risk-on regime)."
    : bias === "bearish"
      ? "Defensives, consumer staples, utilities (stable cash flows, dividend yield) > high-leverage cyclicals and technology."
      : "Sector selectivity outperforms broad exposure — no clear sector leadership in range-bound regime.";
  const saudiRotation = isSaudi
    ? `\nSaudi sector rotation:
- Banks: benefit from higher rates (net interest margin expands) but lag when credit growth declines.
- Energy (Aramco): primary defensive — stable dividends anchor TASI valuation in uncertain regimes.
- Petrochemicals (SABIC): China demand + ethylene margin linked — more volatile than defensives.
- Vision 2030 (infra/entertainment): funding tied to oil price — at risk from government spending contraction.
- Telecom/Healthcare: partial defensive — stable growth but moderate multiples.`
    : "";
  return `Sector rotation logic (mandatory):
Current global rotation: ${globalRotation}
Credit stress rule: ${credit === "high" || credit === "extreme" ? `${credit} credit stress → quality over momentum (low P/B + free cash flow + low debt).` : "Low-to-moderate credit stress → cyclical exposure is acceptable with risk management."}${saudiRotation}`;
}

// ─── Dimension 9: Risk/Reward Asymmetry Framing ──────────────────────────────
// Forces explicit upside/downside quantification and asymmetry judgment.

function buildRiskRewardDirective(
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const risk = trackD?.primaryRisk ?? (ar ? "ضغوط ماكرو" : "macro headwinds");
  const weakness = trackD?.thesisWeakness;
  if (ar) {
    return `إطار تماثل المخاطر/العائد (مطلوب):
صياغة: "الجانب الصاعد: [X%] إذا [شرط]. الجانب الهابط: [Y%] إذا [شرط]. التماثل: [مناسب/غير مناسب] لأن [سبب محدد]."
المخاطرة الرئيسية الحالية: ${risk}.
${weakness ? `الافتراض الأضعف: ${weakness} — يجب أن يظهر في تقييم التماثل.` : ""}
قاعدة المخصص: التماثل غير المناسب (إمكانية هبوط > إمكانية صعود في النظام الحالي) يستدعي حجم مركز أصغر أو انتظار إعادة التسعير.`;
  }

  return `Risk/reward asymmetry framing (mandatory):
Format: "Upside: [X%] if [condition]. Downside: [Y%] if [condition]. Asymmetry: [favorable/unfavorable] because [specific reason]."
Current primary risk: ${risk}.
${weakness ? `Weakest assumption: ${weakness} — must appear in asymmetry assessment.` : ""}
Allocator rule: unfavorable asymmetry (downside > upside potential in current regime) requires smaller position size or waiting for repricing.`;
}

// ─── Dimension 10: Thesis Change Conditions ──────────────────────────────────
// Forces specific, measurable conditions that would flip the view.

function buildThesisChangeDirective(
  trackD: TrackDSlice | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const trigger = trackD?.invalidationTrigger;
  if (ar) {
    return `شروط تغيير الأطروحة (مطلوبة — قابلة للقياس):
صياغة: "الرأي يتحول عندما [حدث محدد قابل للرصد]: [مستوى سعر / قرار سياسة / قراءة بيانات / تطور هيكلي]."
${trigger ? `شرط الإلغاء الحالي: ${trigger}` : "شروط التغيير الموصى بها: تحوّل الفيدرالي في مسار الأسعار، النفط ينخفض دون نقطة التعادل، اتساع فوارق الائتمان بشكل ملموس، انهيار أرباح القطاع."}
ممنوع: "إذا تغيّرت الظروف" أو "تغيّر معنويات السوق" — يجب تسمية الحدث الدقيق القابل للرصد.`;
  }

  return `Thesis change conditions (mandatory — must be measurable):
Format: "The view flips when [specific observable event]: [price level / policy decision / data reading / structural development]."
${trigger ? `Current invalidation condition: ${trigger}` : "Recommended change conditions: Fed pivot in rate trajectory, oil below fiscal breakeven, material credit spread widening, sector earnings collapse."}
FORBIDDEN: "if conditions change" or "market sentiment shifts" — must name the precise observable event.`;
}

// ─── Saudi Mandatory Depth Context ───────────────────────────────────────────
// For Saudi/TASI questions: goes beyond the 5-channel checklist and forces
// the AI to reason as a conservative Saudi-market allocator.

function buildSaudiMandatoryDepthContext(
  trackA: TrackASlice | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const oil = trackA?.oilLiquidity ?? "";
  const rates = trackA?.ratesEnv ?? "";
  const credit = trackA?.creditStressLevel ?? "moderate";
  const bias = trackA?.macroBias ?? "neutral";

  if (ar) {
    return `عمق السوق السعودي الإلزامي — أفق 12-24 شهراً:

1. تحليل نقطة التعادل النفطية:
   ${oil ? `السياق: ${oil}` : "سعر النفط الحالي مقابل نقطة التعادل السعودية ~75-80$/ب:"}
   - [فوق/تحت] نقطة التعادل → فائض/عجز الميزانية → قدرة الإنفاق الحكومي على رؤية 2030.
   - الفارق بالنسبة المئوية عن نقطة التعادل يحدد الهامش الأمني للإنفاق الرأسمالي.

2. آلية ربط SAR-USD والتأثير النقدي:
   ${rates ? `بيئة الأسعار: ${rates}` : ""}
   - SAR مربوط بـ USD → SAMA تتبع الفيدرالي ولا تقود → السياسة النقدية المحلية خارج السيطرة المستقلة.
   - إذا رفع الفيدرالي/ثبّت: تكاليف الاقتراض السعودية ترتفع → نمو الائتمان يتراجع → ضغط على القطاعات ذات الرافعة.
   - إذا خفّض الفيدرالي: تخفيف محلي تلقائي → دعم التقييمات والنمو الائتماني.

3. البنوك ونمو الائتمان:
   - البنوك السعودية تمثل ~30% من رسملة تاسي — محرك رئيسي لاتجاه المؤشر.
   - نمو الائتمان مرتبط بالإنفاق الحكومي والنشاط العقاري → مراقبة نسب كفاية رأس المال والقروض المتعثرة.
   - في ضغط ائتماني ${credit}: ${credit === "high" || credit === "extreme" ? "هوامش البنوك مضغوطة — تقييمات P/B ستنخفض." : "البنوك في وضع معقول — مراقبة نمو القروض عامل رئيسي."}

4. أرامكو السعودية والتوزيعات:
   - أرامكو تمثل ~80% من مؤشر MSCI Saudi / ~60% من تاسي الكامل.
   - تحديد: هل التوزيعات الحالية مغطاة بسعر النفط الحالي؟ → إذا نعم، تاسي لديه "أرضية توزيعات".
   - الملكية الحكومية (~98%) تعني أن التوزيعات تمول الإنفاق الحكومي → الأولوية السياسية عالية.

5. البتروكيماويات والطلب الصيني:
   - سابك + قطاع البتروكيماويات: مرتبطة بطلب الإيثيلين الصيني ومؤشر PMI الصناعي الصيني.
   - انتعاش الصين → تحسن هوامش البتروكيماويات → دعم محتمل للقطاع.
   - تراجع الصين → ضغط الهامش → تقييمات أدنى.

6. رؤية 2030: الإنفاق الرأسمالي مقابل انتقال الأرباح الفعلية:
   - المشاريع الكبرى (نيوم/القدية/البحر الأحمر) تستهلك رأس المال ولا تُدرّ عائداً بعد.
   - الشركات المستفيدة من رؤية 2030 تستند إلى طلب مستقبلي لا أرباح حالية.
   - خطر التقييم: إذا تباطأ الإنفاق بسبب ضغط النفط، توقعات الأرباح تُعاد تسعيرها.

7. موقف المخصص المحافظ للسوق السعودي:
   اتجاه ${bias} مع اتفاق ${credit === "low" ? "ائتماني مريح" : credit === "high" || credit === "extreme" ? "ائتمان مضغوط" : "ائتمان محايد"}:
   - الدخول التدريجي مناسب إذا: النفط فوق نقطة التعادل + اتجاه الفيدرالي نحو التخفيف + نمو ائتمان البنوك إيجابي.
   - الانتظار مناسب إذا: عدم اليقين في مسار النفط + ثبات الفيدرالي + مضاعفات تاسي فوق المتوسط التاريخي.
   - التجنب/التقليص: النفط يتراجع دون نقطة التعادل + الفيدرالي يرفع + نمو الائتمان يتباطأ.`;
  }

  return `Saudi market mandatory depth — 12-24 month horizon:

1. Fiscal breakeven analysis:
   ${oil ? `Context: ${oil}` : "Current oil price vs Saudi fiscal breakeven ~$75-80/bbl:"}
   - [Above/below] breakeven → budget surplus/deficit → government spending capacity for Vision 2030.
   - Percentage gap from breakeven determines safety margin for capex commitments.

2. SAR-USD peg and monetary transmission:
   ${rates ? `Rate environment: ${rates}` : ""}
   - SAR pegged to USD → SAMA shadows Fed, cannot lead → domestic monetary policy is not independently set.
   - If Fed holds/hikes: Saudi borrowing costs remain elevated → credit growth decelerates → pressure on leveraged sectors.
   - If Fed cuts: automatic local easing → supports valuations and credit growth.

3. Banks and credit growth:
   - Saudi banks represent ~30% of TASI market cap — a primary driver of index direction.
   - Credit growth linked to government spending and real estate activity → monitor capital adequacy and NPL trends.
   - Under ${credit} credit stress: ${credit === "high" || credit === "extreme" ? "bank margins are compressed — P/B valuations will reflect downward pressure." : "banks are reasonably positioned — credit growth trajectory is the key watchable."}

4. Aramco and dividends:
   - Aramco represents ~80% of MSCI Saudi / ~60% of full TASI by market cap.
   - Key question: are current dividends covered at the current oil price? → If yes, TASI has a "dividend floor".
   - ~98% government ownership means dividends fund government spending → political priority is high.

5. Petrochemicals and China demand:
   - SABIC + petrochemicals sector: linked to Chinese ethylene demand and China industrial PMI.
   - China recovery → petrochemical margin improvement → potential sector support.
   - China slowdown → margin compression → lower sector valuations.

6. Vision 2030: capex vs actual earnings transmission:
   - Large projects (NEOM/Qiddiya/Red Sea) consume capital and are not yet earnings-generative.
   - Vision 2030 beneficiary companies depend on future demand not current earnings.
   - Valuation risk: if spending decelerates under oil pressure, earnings expectations will be repriced lower.

7. Conservative Saudi allocator stance:
   ${bias} bias with ${credit === "low" ? "comfortable credit" : credit === "high" || credit === "extreme" ? "stressed credit" : "neutral credit"}:
   - Scale in gradually if: oil above breakeven + Fed moving toward easing + bank credit growth positive.
   - Wait if: oil trajectory uncertain + Fed holding + TASI multiples above historical average.
   - Avoid/reduce: oil trending below breakeven + Fed hiking + credit growth decelerating.`;
}

// ─── Banned Phrase Enforcement ───────────────────────────────────────────────
// Explicit instruction to the AI: these phrases are only permitted with a
// following causal mechanism. Without the mechanism, they are shallow and rejected.

function buildBannedPhraseDirective(lang: "ar" | "en"): string {
  const ar = lang === "ar";
  if (ar) {
    return `العبارات المحظورة بدون آلية سببية (مطلوب الالتزام):
الأنماط الآتية مقبولة فقط إذا تلتها جملة آلية سببية كاملة:
- "السوق متذبذب" → مقبول فقط إذا تلاه: "بسبب [عامل محدد] → [تأثيره على [قطاع/فئة أصل] → [دلالة الاستثمار]."
- "النفط يؤثر على السوق" → مقبول فقط إذا تلاه: "من خلال قناة [المالية العامة/البتروكيماويات/الطلب الصيني] → يؤدي إلى [X] → مما يعني للمستثمر [Y]."
- "السيولة محايدة" → مقبول فقط إذا تلاه: "لأن [مؤشرات محددة] تشير إلى [مستوى] → الاستثمار الانتقائي ممكن في [قطاعات محددة]."
- "الضغط الائتماني معتدل" → مقبول فقط إذا تلاه: "بمعنى أن [X] قابل للتمويل و[Y] في ضغط جزئي → المخصص يُفضّل [Z]."
- "لا يوجد اتجاه واضح" → مقبول فقط إذا تلاه: "لأن [إشارات A وB تتعارض] → استراتيجية الانتظار منطقية حتى [حدث محدد قابل للرصد]."
ممنوع تماماً: عبارات وصفية مجردة بدون آلية سببية تالية.`;
  }

  return `Banned phrases without causal mechanism (mandatory compliance):
The following patterns are permitted ONLY if immediately followed by a complete causal mechanism sentence:
- "market is volatile" → only if followed by: "because [specific factor] → [its effect on sector/asset class] → [investment implication]."
- "oil affects the market" → only if followed by: "through the [fiscal/petrochemical/China demand] channel → leading to [X] → meaning for the investor [Y]."
- "liquidity is neutral" → only if followed by: "because [specific indicators] show [level] → selective investment is feasible in [specific sectors]."
- "credit pressure is moderate" → only if followed by: "meaning [X] is fundable and [Y] is under partial stress → allocator prefers [Z]."
- "no clear direction" → only if followed by: "because [signals A and B conflict] → waiting is rational until [specific observable event]."
ABSOLUTELY FORBIDDEN: descriptive statements without a following causal mechanism.`;
}

// ─── Main Public API ──────────────────────────────────────────────────────────

/**
 * Builds the full institutional depth context for injection into the Genesis fusion prompt.
 * Returns both the full depth directive and the Saudi-specific depth context.
 * Pure O(1) — no AI calls, no network.
 */
export function buildInstitutionalDepthContext(
  question: string,
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
  isInvestment: boolean,
  isSaudi: boolean,
  lang: "ar" | "en",
): DepthEngineResult {
  if (!isInvestment) {
    return { depthContext: "", saudiDepthContext: "", dimensionsInjected: [] };
  }

  const parts: string[] = [];
  const dimensions: string[] = [];

  const ar = lang === "ar";
  const header = ar
    ? "توجيه العمق المؤسسي (مطلوب الالتزام الكامل لأسئلة الاستثمار):"
    : "INSTITUTIONAL DEPTH DIRECTIVE (mandatory full compliance for investment questions):";
  parts.push(header);

  // D1: Transmission chain
  const d1 = buildTransmissionChainDirective(trackA, isSaudi, lang);
  if (d1) { parts.push(d1); dimensions.push("transmission_chain"); }

  // D2: Second-order effects
  const d2 = buildSecondOrderDirective(trackA, isSaudi, lang);
  if (d2) { parts.push(d2); dimensions.push("second_order_effects"); }

  // D3: Allocator psychology
  const d3 = buildAllocatorPsychologyDirective(trackA, consensus, isSaudi, lang);
  if (d3) { parts.push(d3); dimensions.push("allocator_psychology"); }

  // D4: Regime conflict (only when relevant)
  const d4 = buildRegimeConflictDirective(trackA, consensus, lang);
  if (d4) { parts.push(d4); dimensions.push("regime_conflict"); }

  // D5: Valuation vs earnings
  const d5 = buildValuationEarningsDirective(isSaudi, lang);
  if (d5) { parts.push(d5); dimensions.push("valuation_vs_earnings"); }

  // D6: Policy reaction function
  const d6 = buildPolicyReactionDirective(trackA, isSaudi, lang);
  if (d6) { parts.push(d6); dimensions.push("policy_reaction"); }

  // D7: Liquidity and credit channel
  const d7 = buildLiquidityCreditDirective(trackA, lang);
  if (d7) { parts.push(d7); dimensions.push("liquidity_credit"); }

  // D8: Sector rotation logic
  const d8 = buildSectorRotationDirective(trackA, isSaudi, lang);
  if (d8) { parts.push(d8); dimensions.push("sector_rotation"); }

  // D9: Risk/reward asymmetry
  const d9 = buildRiskRewardDirective(trackA, trackD, lang);
  if (d9) { parts.push(d9); dimensions.push("risk_reward"); }

  // D10: Thesis change conditions
  const d10 = buildThesisChangeDirective(trackD, lang);
  if (d10) { parts.push(d10); dimensions.push("thesis_change"); }

  // Banned phrase enforcement
  const banned = buildBannedPhraseDirective(lang);
  parts.push(banned);
  dimensions.push("banned_phrase_enforcement");

  // Second-order risks field requirement
  const secondOrderField = ar
    ? `حقل "secondOrderRisks" (إلزامي لأسئلة الاستثمار): جملة 1-2: التأثيرات الثانوية التي تتدفق من السيناريو الأساسي — تجاوز الأثر المباشر. مثال: "إذا انخفض النفط دون نقطة التعادل، تراجع الإنفاق الحكومي يتوالد عنه تباطؤ الإقراض المصرفي → تراجع تقييمات العقارات → انضغاط ثروة الأسرة → ضعف الطلب الاستهلاكي — بعيداً عن قطاع الطاقة مباشرة."`
    : `"secondOrderRisks" field (mandatory for investment questions): 1-2 sentences on second-order contagion effects flowing from the primary scenario — beyond the direct impact. Example: "if oil falls below fiscal breakeven, government spending contraction generates bank lending deceleration → real estate valuation compression → household wealth effect dampening → consumer demand weakness — well beyond the direct energy sector impact."`;
  parts.push(secondOrderField);

  // Saudi depth context (separate block)
  const saudiDepthContext = isSaudi ? buildSaudiMandatoryDepthContext(trackA, lang) : "";

  return {
    depthContext: parts.join("\n\n"),
    saudiDepthContext,
    dimensionsInjected: dimensions,
  };
}
