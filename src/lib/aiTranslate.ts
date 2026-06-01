// Shared Arabic translation patches for AI-generated service-layer strings.
// Applied at display time; service layer remains language-agnostic.

export const REGIME_AR: Record<string, string> = {
  "Trending Bullish":  "اتجاه صاعد",
  "Trending Bearish":  "اتجاه هابط",
  "Risk-Off":          "إيقاف المخاطرة",
  "Risk-On":           "تشغيل المخاطرة",
  "High Volatility":   "تقلب عالٍ",
  "Sideways":          "جانبي",
  "Panic":             "هلع",
  "Range Bound":       "نطاق محدد",
};

export const STABILITY_AR: Record<string, string> = {
  stable:   "مستقر",
  shaky:    "غير مستقر",
  chaotic:  "فوضوي",
};

export const AGENT_LABEL_AR: Record<string, string> = {
  "Quantitative Intelligence": "الذكاء الكمي",
  "Technical Intelligence":    "الذكاء التقني",
  "Macro Intelligence":        "الذكاء الكلي",
  "Portfolio Intelligence":    "ذكاء المحفظة",
  "Sentiment Intelligence":    "ذكاء المعنويات",
  "Strategy Intelligence":     "ذكاء الاستراتيجية",
};

const PATCHES: [string, string][] = [
  // Explainability reason (order matters — longest match first)
  ["Weighted ensemble confidence", "ثقة المجموعة المرجحة"],
  ["% × agreement", "% × توافق"],
  ["% across", "% عبر"],
  ["directional agents", "وكيل اتجاهي"],

  // Quant agent
  ["Risk-adjusted profile:", "ملف المخاطر المعدّل:"],
  ["max DD", "أقصى تراجع"],

  // Technical agent flags
  ["Mixed timeframe alignment — wait for confirmation", "توافق إطارات زمنية متضاربة — انتظر التأكيد"],

  // Macro agent flags
  ["high-impact macro events imminent — event-driven volatility likely",
   "أحداث ماكرو عالية التأثير وشيكة — تقلب محرك بالأحداث محتمل"],
  ["Cross-asset regime risk-off", "النظام متعدد الأصول — إيقاف المخاطرة"],

  // Portfolio warning
  ["Portfolio is concentrated in a few high-conviction names.",
   "المحفظة مركّزة في عدد قليل من الأسماء عالية القناعة."],

  // Strategy agent rationale
  ["Risk profile —", "ملف المخاطر —"],
  ["Composite bias neutral",  "التحيز المركّب محايد"],
  ["Composite bias bullish",  "التحيز المركّب صاعد"],
  ["Composite bias bearish",  "التحيز المركّب هابط"],
  ["risk-appetite balanced",     "شهية المخاطرة متوازنة"],
  ["risk-appetite conservative", "شهية المخاطرة محافظة"],
  ["risk-appetite aggressive",   "شهية المخاطرة هجومية"],

  // Signal engine
  ["Mixed signals — waiting for confirmation.", "إشارات متضاربة — انتظار التأكيد."],

  // Regime explanations
  ["Sentiment is defensive and macro news pressure is rising.",
   "المعنويات دفاعية وضغط أخبار الماكرو يرتفع."],
  ["Rotate into quality, raise hedges, monitor correlations for stress.",
   "دوران نحو الجودة، رفع التحوط، مراقبة الارتباطات للضغط."],
  ["Mixed signals across momentum, volatility and sentiment.",
   "إشارات متضاربة عبر الزخم والتقلب والمعنويات."],
  ["Stay selective, prefer mean-reversion setups and tight risk.",
   "كن انتقائياً، افضّل إعدادات الانعكاس للمتوسط والمخاطر المحكمة."],
  ["Elevated volatility colliding with high-impact negative news flow.",
   "تقلب مرتفع يصطدم بتدفق أخبار سلبية عالية التأثير."],
  ["Reduce exposure, raise cash, avoid catching falling knives.",
   "خفّض التعرض، ارفع السيولة، تجنب الإمساك بالسكاكين الساقطة."],
  ["Cross-asset volatility is well above normal — regime is unstable.",
   "تقلب متعدد الأصول أعلى بكثير من الطبيعي — النظام غير مستقر."],
  ["Trim position sizes, widen stops, prefer optionality over directional bets.",
   "خفّض أحجام المراكز، وسّع وقف الخسارة، فضّل المرونة على الرهانات الاتجاهية."],
  ["Positive momentum confirmed by constructive sentiment across assets.",
   "زخم إيجابي مؤكد بمعنويات بنّاءة عبر الأصول."],
  ["Favour trend-following on leaders; trail stops, do not pre-empt reversals.",
   "فضّل تتبع الاتجاه على القادة؛ تتبع وقف الخسارة، لا تستبق الانعكاسات."],
  ["Negative momentum reinforced by deteriorating sentiment.",
   "زخم سلبي مدعوم بتدهور المعنويات."],
  ["Prefer defensives and hedges; fade rallies into structural resistance.",
   "فضّل الدفاعيات والتحوطات؛ خفّض التجمعات عند المقاومة الهيكلية."],
  ["Sentiment skews constructive while news pressure remains contained.",
   "المعنويات تميل إلى البنّاءة بينما يبقى ضغط الأخبار محدوداً."],
  ["Lean into high-beta exposure but respect risk budgets.",
   "تحيّز نحو التعرض عالي البيتا مع احترام ميزانيات المخاطر."],
  ["Low momentum and contained volatility — range-bound conditions.",
   "زخم منخفض وتقلب محدود — ظروف نطاق محدد."],
  ["Mean-reversion at range extremes; avoid breakout chases until volume returns.",
   "انعكاس للمتوسط عند أطراف النطاق؛ تجنب ملاحقة الاختراقات حتى يعود الحجم."],

  // Confidence stability/reasoning
  ["Mixed alignment — size positions conservatively.",
   "توافق متضارب — حجّم المراكز بتحفظ."],
  ["Conditions support trusting AI conviction.",
   "الظروف تدعم الثقة بقناعة الذكاء الاصطناعي."],
  ["Unstable conditions — confidence intentionally suppressed.",
   "ظروف غير مستقرة — الثقة مخفّضة عمداً."],

  // Strategy adaptation
  ["Capital preservation; defensive sector rotation.",
   "الحفاظ على رأس المال؛ دوران القطاعات الدفاعية."],
  ["Reduce gross exposure; prefer safe-haven and dollar strength.",
   "تخفيض التعرض الإجمالي؛ تفضيل الملاذ الآمن وقوة الدولار."],
  ["Cut high-beta exposure.", "قطع التعرض عالي البيتا."],
  ["Tighten stops aggressively.", "تضييق وقف الخسارة بقوة."],
  ["Avoid catching falling knives.", "تجنب الإمساك بالسكاكين الساقطة."],
  ["Prioritize momentum continuation; let winners run.",
   "أولّد استمرار الزخم؛ دع الرابحين يجرون."],
  ["Lean into trend-aligned breakouts; avoid counter-trend fades.",
   "تحيّز نحو الاختراقات الاتجاهية؛ تجنب المعاكسة."],
  ["Favor momentum-aligned entries.", "فضّل الدخولات الاتجاهية."],
  ["Trail stops to lock gains.", "تتبع وقف الخسارة لتأمين الأرباح."],
  ["Avoid mean-reversion trades.", "تجنب صفقات الانعكاس للمتوسط."],
  ["Range-bound — fade extremes, smaller size.",
   "نطاق محدد — خفّض الأطراف، حجم أصغر."],
  ["Lower conviction across breakouts; expect chop.",
   "قناعة أقل عبر الاختراقات؛ توقع الصخب."],
  ["Discount breakout signals.", "خصّم إشارات الاختراق."],
  ["Trade smaller positions.", "تداول مراكز أصغر."],
  ["Wait for confirmation.", "انتظر التأكيد."],
  ["Volatility regime — survival over prediction.",
   "نظام التقلب — البقاء فوق التنبؤ."],
  ["Reduce size sharply; widen stops or step aside.",
   "خفّض الحجم بحدة؛ وسّع وقف الخسارة أو ابتعد."],
  ["Halve typical position size.", "انصف الحجم الاعتيادي للمركز."],
  ["Avoid clustered correlated bets.", "تجنب الرهانات المترابطة المتجمعة."],
  ["Wait for vol contraction before re-engaging.",
   "انتظر انكماش التقلب قبل العودة."],
  ["Panic regime — capital preservation is the only objective.",
   "نظام الهلع — الحفاظ على رأس المال هو الهدف الوحيد."],
  ["Avoid new entries; protect capital and re-assess once volatility cools.",
   "تجنب الدخولات الجديدة؛ احمِ رأس المال وأعد التقييم عند هدوء التقلب."],
  ["No new directional risk.", "لا مخاطر اتجاهية جديدة."],
  ["Hedge or de-risk existing exposure.", "تحوّط أو قلّل المخاطر القائمة."],
  ["Document plan for re-entry.", "وثّق خطة إعادة الدخول."],
  ["Extreme fear — historically supportive long-term, but near-term risk elevated.",
   "خوف متطرف — داعم تاريخياً على المدى الطويل، لكن المخاطر قصيرة الأمد مرتفعة."],
  ["Extreme greed — trim aggression; complacency risk rising.",
   "طمع متطرف — خفّض العدوانية؛ مخاطر الاسترخاء ترتفع."],
  ["Maintain framework discipline; no tactical shift required.",
   "حافظ على انضباط الإطار؛ لا تحول تكتيكي مطلوب."],
  ["Balanced positioning across regimes.",
   "توضع متوازن عبر الأنظمة."],

  // Self-evaluation flags
  ["is below expected threshold — recalibrate.",
   "أقل من المتوقع — إعادة معايرة."],
  ["Risk readings (", "قراءات المخاطر ("],
  [") misaligned with", ") غير متوافق مع"],
  ["stress level (", "مستوى الضغط ("],
  ["System health degraded — favor capital preservation.",
   "صحة النظام متراجعة — تفضيل الحفاظ على رأس المال."],
  ["Adaptive intelligence under stress — prioritize survival, await stabilization.",
   "ذكاء تكيفي تحت الضغط — أولوية البقاء، انتظار الاستقرار."],
  ["Adaptive intelligence operating within healthy calibration bands.",
   "الذكاء التكيفي يعمل ضمن نطاقات معايرة صحية."],
  ["Adaptive intelligence functional; some calibration drift detected.",
   "الذكاء التكيفي يعمل؛ رُصد انحراف معايرة بسيط."],
  ["System operating below optimal calibration.",
   "النظام يعمل دون المعايرة المثلى."],
  ["Building calibration baseline — limited evaluated samples.",
   "بناء خط أساس المعايرة — عينات تقييم محدودة."],
  ["Panic regime detected — suppress aggressive entries.",
   "نظام الهلع مرصود — تثبيط الدخولات العدوانية."],
  ["High-confidence accuracy", "دقة الثقة العالية"],

  // Trade planner
  ["No directional conviction on", "لا قناعة اتجاهية على"],
  ["Constructive long setup on", "إعداد شراء بنّاء على"],
  ["Tactical short setup on", "إعداد بيع تكتيكي على"],
  ["Entry plan:", "خطة الدخول:"],
  ["Exit framework:", "إطار الخروج:"],
  ["Execution timing", "توقيت التنفيذ"],
  ["Suggested sleeve", "الحجم المقترح"],
  ["excellent timing", "توقيت ممتاز"],
  ["good timing", "توقيت جيد"],
  ["fair timing", "توقيت مقبول"],
  ["poor timing", "توقيت ضعيف"],
  ["execute now", "نفّذ الآن"],
  ["scale in", "ادخل تدريجياً"],
  ["stand aside", "ابتعد"],
  ["Position sizing recommends staying flat.",
   "تحديد الحجم يوصي بالبقاء في السيولة."],
  ["(raw", "(خام"],
  ["Regime:", "النظام:"],

  // Backtest observations
  ["leads with", "يتقدم بـ"],
  ["historical hit-rate.", "معدل الإصابة التاريخي."],
  ["lags at", "يتأخر عند"],
  ["deprioritise until regime shifts.", "خفّض الأولوية حتى تتغير البيئة."],

  // Calibration notes
  ["MTF agreement", "توافق متعدد الإطارات"],
  ["— strong alignment", "— توافق قوي"],
  ["— conflicting timeframes", "— إطارات زمنية متعارضة"],
  ["Short + macro bias confirm direction", "التحيز قصير المدى والماكرو يؤكدان الاتجاه"],
  ["Counter-trend versus macro bias", "عكس الاتجاه مقابل تحيز الماكرو"],
  ["Sentiment conflicts with signal", "المعنويات تتعارض مع الإشارة"],
  ["Panic regime — capital preservation", "نظام الهلع — الحفاظ على رأس المال"],
  ["Volatility elevated", "التقلب مرتفع"],
  ["Range-bound regime", "نظام نطاق محدد"],
  ["Risk score elevated", "نقاط المخاطر مرتفعة"],

  // Event impact engine (AICommandCenter events)
  ["Two-way risk — outcome path-dependent", "مخاطرة ثنائية الاتجاه — النتيجة تعتمد على المسار"],
  ["Probability skew tilts constructive", "احتمالية الانحياز بنّاءة"],
  ["Risk skew tilts defensive", "انحياز المخاطر دفاعي"],
  ["Policy-sensitive duration and USD reprice first; equities follow on terminal-rate repricing.",
   "مدة حساسة للسياسة النقدية وإعادة تسعير الدولار أولاً؛ الأسهم تتبع إعادة تسعير معدل الذروة."],
  ["Flow-driven impulse on spot liquidity; structural demand if sustained over multiple sessions.",
   "دفع تدفق على السيولة الفورية؛ طلب هيكلي إذا استمر عبر جلسات متعددة."],
  ["Supply discipline tightens balances; second-order pass-through into inflation expectations.",
   "انضباط العرض يشد التوازنات؛ تأثير ثانوي على توقعات التضخم."],
  ["Cross-asset reaction proportional to surprise vs. consensus.",
   "رد فعل متعدد الأصول يتناسب مع المفاجأة مقابل التوقعات."],
  ["Focus pairs:", "أزواج التركيز:"],

  // Correlation engine
  ["Relationship currently noisy — no reliable lead/lag signal.",
   "العلاقة متذبذبة حالياً — لا إشارة موثوقة للتقدم/التأخر."],
  ["Relationship currently noisy — no reliable lead/lag signal",
   "العلاقة متذبذبة حالياً — لا إشارة موثوقة للتقدم/التأخر"],

  // Dynamic brain / market intelligence
  ["Mixed tape — selectivity required", "شريط متضارب — الانتقائية مطلوبة"],
  ["bullish vs", "صاعد مقابل"],
  ["bearish across", "هابط عبر"],
  ["tracked assets", "الأصول المتتبعة"],
  ["Average volatility", "متوسط التقلب"],
  ["Volume spike", "ارتفاع الحجم"],
  ["size positions down", "خفّض أحجام المراكز"],

  // Correlation meanings (global scanner)
  ["Crypto beta cluster", "مجموعة بيتا الكريبتو"],
  ["Risk-on tech alignment", "توافق التكنولوجيا المخاطِرة"],
];

/** Apply Arabic patches to a string. No-op when ar=false. */
export function patchAr(text: string, ar: boolean): string {
  if (!ar || !text) return text;
  let r = text;
  for (const [en, arStr] of PATCHES) {
    if (r.includes(en)) r = r.split(en).join(arStr);
  }
  return r;
}

/** Translate an agent label. Falls back to the original label. */
export function tAgentLabel(label: string, ar: boolean): string {
  return ar ? (AGENT_LABEL_AR[label] ?? label) : label;
}

/** Translate a regime name. Falls back to the original. */
export function tRegime(regime: string, ar: boolean): string {
  return ar ? (REGIME_AR[regime] ?? regime) : regime;
}

/** Translate confidence stability. */
export function tStability(s: string, ar: boolean): string {
  return ar ? (STABILITY_AR[s] ?? s) : s;
}
