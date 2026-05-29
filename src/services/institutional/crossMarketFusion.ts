// Phase-67: Cross-Market Intelligence Fusion
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from crossMarketRegime.ts (Phase 41) which classifies regime labels
// from structured market-intel signals. This module builds the CAUSAL SPILLOVER
// NARRATIVE: how each macro dimension transmits through the chain to downstream
// assets, and injects it into the Genesis prompt as actionable reasoning context.
//
// Eight dimensions fused:
//   1. Oil         — Saudi fiscal channel, global demand, inflation proxy
//   2. Rates       — CB trajectory, real-rate environment, duration pressure
//   3. USD/DXY     — EM capital flows, commodity pricing, SAR peg tightening
//   4. Liquidity   — Global dollar supply, credit availability, risk capacity
//   5. China demand — Commodity demand, EM growth proxy, petrochemical margins
//   6. Risk appetite — Cross-asset confirmation, positioning, crowding signals
//   7. Regional flows — TASI/EM foreign capital, DXY-driven repatriation
//   8. Macro spillovers — Primary shock → secondary asset transmission chain
//
// Design rules:
// - Causal language mandatory ("→", "leads to", "transmits to", "which means")
// - Correlation ≠ causation: never assert confirmed causation
// - Hedged conditional language for predictions ("if X then Y")
// - No execution language, no price targets, no trade instructions
// - Isolation risk flag: signals when question needs cross-market context

import type { Lang } from "@/lib/ai/locale";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CrossMarketLinkage =
  | "oil_fiscal_channel"       // oil → Saudi fiscal space → government spending → TASI
  | "usd_em_flows"             // DXY strength → EM repatriation → TASI/EM liquidity drain
  | "rates_valuation"          // rate rises → higher discount rate → equity multiple compression
  | "liquidity_risk_appetite"  // dollar liquidity expansion/contraction → global risk capacity
  | "china_commodity_demand"   // China PMI → commodity demand → oil/metals/petrochemicals
  | "spillover_contagion"      // primary shock → secondary asset transmission (cross-border)
  | "regional_flow_rotation";  // global risk-on/off → TASI/Gulf foreign flow direction

export interface CrossMarketFusionInput {
  question: string;
  oilPrice: number | null;
  oilChangePct: number | null;
  tltPrice: number | null;       // TLT proxy for bond/rate direction
  tltChangePct: number | null;
  spyChangePct: number | null;   // equity risk appetite proxy
  btcChangePct: number | null;   // liquidity/risk proxy
  goldChangePct: number | null;  // safe-haven / real-rate proxy
  eurUsd: number | null;         // USD/DXY proxy (inverse)
  regimeBias: "bullish" | "bearish" | "neutral";
  creditStress: "low" | "moderate" | "high" | "extreme";
  lang: Lang;
}

export interface CrossMarketFusionResult {
  activeLinkages: CrossMarketLinkage[];
  dominantTransmission: string;    // single strongest causal chain (1-2 sentences)
  isolationRisk: boolean;          // true when question analyzes market without its linkages
  oilMacroLinkage: string;         // oil → downstream narrative
  ratesLiquidityLinkage: string;   // rates + liquidity interaction narrative
  usdEmFlowLinkage: string;        // USD → EM/regional flow narrative
  chinaLinkage: string | null;     // China demand → commodity chain (null when irrelevant)
  riskAppetiteLinkage: string;     // cross-asset risk appetite signal
  spilloverNote: string | null;    // compound shock transmission note
  fusionContext: string;           // full injectable prompt context block
}

// ─── Question-relevance detection ─────────────────────────────────────────────

const OIL_Q       = /oil|نفط|wti|brent|aramco|أرامكو|fiscal|مالي|opec|أوبك/i;
const RATES_Q     = /rate|فائدة|yield|عائد|bond|سند|fed|فيدرالي|central bank|بنك مركزي|sama|tlt|inflation|تضخم/i;
const USD_Q       = /dollar|دولار|dxy|usd|eur.?usd|forex|عملة|currency|sar peg|ربط/i;
const CHINA_Q     = /china|صين|chinese|pmi|بتروكيماوي|petroch|sabic|سابك|commodity|سلع|demand|طلب/i;
const EM_Q        = /emerging|ناشئة|tasi|تاسي|saudi|سعود|gulf|خليج|dfm|adx|flows|تدفق/i;
const LIQUIDITY_Q = /liquidity|سيولة|credit|ائتمان|spread|فروقات|funding|تمويل|btc|bitcoin|بيتكوين/i;

function detectIsolationRisk(question: string): boolean {
  // Question is isolated if it asks about a specific asset without market-linkage framing
  const asksAboutSingleAsset = /\b(aramco|أرامكو|sabic|سابك|2222|tasi|تاسي|btc|bitcoin|gold|ذهب|oil|النفط)\b/i.test(question);
  const hasCrossMarketFrame = /market|سوق|macro|كلي|link|ارتباط|impact|تأثير|relation|علاقة|cross|متقاطع|sector|قطاع/i.test(question);
  return asksAboutSingleAsset && !hasCrossMarketFrame;
}

// ─── Live-data narrative builders (per dimension) ─────────────────────────────

function fmt(v: number | null, decimals = 2): string {
  return v !== null ? v.toFixed(decimals) : "n/a";
}
function fmtPct(v: number | null): string {
  if (v === null) return "n/a";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function buildOilMacroLinkage(
  oilPrice: number | null,
  oilChangePct: number | null,
  lang: Lang,
): string {
  const ar = lang === "ar";
  const price = oilPrice !== null ? `$${fmt(oilPrice, 1)}/bbl` : null;
  const chg = fmtPct(oilChangePct);
  const dir = oilChangePct === null ? "unclear"
    : oilChangePct >= 2   ? "rising_sharply"
    : oilChangePct >= 0.5 ? "rising"
    : oilChangePct <= -2  ? "falling_sharply"
    : oilChangePct <= -0.5 ? "falling"
    : "flat";

  const fiscal = (() => {
    if (dir === "rising_sharply" || dir === "rising")
      return ar
        ? "فوق نقطة تعادل الميزانية السعودية (~75-80$/ب) → فضاء مالي إيجابي → إنفاق رأسمالي لرؤية 2030 محافظ عليه → دعم تاسي."
        : "above Saudi fiscal breakeven (~$75-80/bbl) → positive fiscal space → Vision 2030 capex maintained → TASI tailwind.";
    if (dir === "falling_sharply")
      return ar
        ? "يقترب أو يكسر نقطة التعادل السعودية → ضغط مالي → احتمال خفض الإنفاق الحكومي → ضغط على تاسي عبر قناة أرامكو."
        : "approaching/breaching Saudi breakeven → fiscal pressure → risk of government spending cuts → TASI headwind via Aramco dividend channel.";
    if (dir === "falling")
      return ar
        ? "يتراجع نحو منطقة التعادل المالي → تزداد المخاطر المالية → يُراقَب قريباً."
        : "moving toward fiscal breakeven zone → fiscal risks increasing → watch closely.";
    return ar
      ? "قريب من التعادل المالي — تأثير محايد على الإنفاق الحكومي."
      : "near fiscal neutral — limited near-term government spending impact.";
  })();

  const globalDemand = (() => {
    if (dir === "rising_sharply")
      return ar
        ? "ارتفاع حاد في النفط → إشارة طلب عالمي قوي أو اضطراب في العرض → دعم للأصول الدورية وسلع الطاقة."
        : "sharp oil rise → strong global demand signal or supply disruption → supportive for cyclicals and energy commodities.";
    if (dir === "falling_sharply")
      return ar
        ? "هبوط حاد في النفط → إشارة تباطؤ الطلب العالمي → ضغط على الأسهم الدورية والأسواق الناشئة."
        : "sharp oil fall → global demand slowdown signal → pressure on cyclicals and EM equities.";
    return ar
      ? "النفط يتحرك في نطاق محدود → إشارة الطلب العالمي غير حاسمة."
      : "oil range-bound → global demand signal inconclusive.";
  })();

  const priceStr = price ? (ar ? `النفط عند ${price} (${chg}): ` : `Oil at ${price} (${chg}): `) : "";
  return ar ? `${priceStr}${fiscal} ${globalDemand}` : `${priceStr}${fiscal} ${globalDemand}`;
}

function buildRatesLiquidityLinkage(
  tltChangePct: number | null,
  creditStress: "low" | "moderate" | "high" | "extreme",
  lang: Lang,
): string {
  const ar = lang === "ar";
  const tltDir = tltChangePct === null ? "unclear"
    : tltChangePct >= 0.5 ? "rallying"
    : tltChangePct <= -0.5 ? "selling_off"
    : "stable";

  const rateEnv = (() => {
    if (tltDir === "rallying")
      return ar
        ? "TLT يرتفع → العائدات تتراجع → تيسير فعلي → يرفع عائد أصول المدة وضغط التخفيض على معامل الخصم يتراجع."
        : "TLT rallying → yields falling → de facto easing → lifts duration asset valuations; discount rate pressure easing.";
    if (tltDir === "selling_off")
      return ar
        ? "TLT يتراجع → العائدات ترتفع → تشديد فعلي → ضغط على معامل الخصم للنمو والأصول ذات المدة الطويلة."
        : "TLT selling off → yields rising → de facto tightening → compresses growth and long-duration asset multiples.";
    return ar
      ? "TLT مستقر → بيئة أسعار محايدة."
      : "TLT stable → neutral rate environment.";
  })();

  const creditEnv = (() => {
    if (creditStress === "extreme")
      return ar
        ? "ضغط ائتمان حرج → تضيّق السيولة العالمية → تكاليف تمويل مرتفعة → سقف الثقة 60%، مخاطر فروقات السندات تُحدّ من الصعود."
        : "extreme credit stress → global liquidity tightening → elevated funding costs → confidence ceiling 60%; spread risk limits upside.";
    if (creditStress === "high")
      return ar
        ? "ضغط ائتمان مرتفع → تكاليف الاقتراض ترتفع → يُضغط على الشركات عالية الرافعة والأسواق الناشئة."
        : "high credit stress → borrowing costs rising → pressure on leveraged names and EM markets.";
    if (creditStress === "low")
      return ar
        ? "ضغط ائتمان منخفض → السيولة متاحة → يدعم الاقتراض والتوسع."
        : "low credit stress → ample liquidity → supports borrowing and expansion.";
    return ar
      ? "ضغط ائتمان معتدل → بيئة تمويل مقيّدة لكن غير حرجة."
      : "moderate credit stress → funding conditions constrained but not critical.";
  })();

  const tltStr = tltChangePct !== null ? ` (TLT ${fmtPct(tltChangePct)})` : "";
  return ar
    ? `الأسعار والسيولة${tltStr}: ${rateEnv} ${creditEnv}`
    : `Rates/Liquidity${tltStr}: ${rateEnv} ${creditEnv}`;
}

function buildUsdEmFlowLinkage(eurUsd: number | null, lang: Lang): string {
  const ar = lang === "ar";
  if (eurUsd === null) {
    return ar
      ? "DXY: بيانات غير متوفرة — تأثير التدفقات الإقليمية على الأسواق الناشئة غير محدد."
      : "DXY: data unavailable — EM/regional flow impact unclear.";
  }
  const dxyStrong = eurUsd <= 1.02;
  const dxyWeak   = eurUsd >= 1.10;

  if (dxyStrong) {
    return ar
      ? `EUR/USD ${fmt(eurUsd, 4)} → الدولار قوي → ضغط على تدفقات الأسواق الناشئة → مستثمرو تاسي الأجانب (~15-20% ملكية) يواجهون ضغط إعادة استثمار → قد يتراجع الطلب على العملات المحلية المثبّتة بالدولار → انخفاض في السيولة الإقليمية.`
      : `EUR/USD ${fmt(eurUsd, 4)} → strong USD → pressure on EM inflows → TASI foreign investors (~15-20% ownership) face repatriation incentive → local SAR-pegged liquidity tightens implicitly → headwind for EM/Gulf equities.`;
  }
  if (dxyWeak) {
    return ar
      ? `EUR/USD ${fmt(eurUsd, 4)} → الدولار ضعيف → تدفقات الأسواق الناشئة مدعومة → يرفع الطلب على الأصول المقيّمة بالدولار → إيجابي للسلع والأسواق الناشئة والخليج.`
      : `EUR/USD ${fmt(eurUsd, 4)} → weak USD → EM inflows supported → lifts demand for dollar-denominated assets → positive for commodities, EM, and Gulf equities.`;
  }
  return ar
    ? `EUR/USD ${fmt(eurUsd, 4)} → الدولار محايد — تأثير محدود على تدفقات الأسواق الناشئة والسيولة الإقليمية.`
    : `EUR/USD ${fmt(eurUsd, 4)} → neutral USD — limited impact on EM flows and regional liquidity.`;
}

function buildChinaLinkage(question: string, lang: Lang): string | null {
  if (!CHINA_Q.test(question)) return null;
  return lang === "ar"
    ? "قناة الطلب الصيني: الصين هي المستهلك الأكبر للسلع. تراجع مؤشر PMI التصنيعي الصيني → تراجع الطلب على النفط والنحاس → هوامش البتروكيماويات (سابك) تنخفض → ضغط على أرباح صادرات الخليج. ارتفاع PMI → العكس صحيح."
    : "China demand channel: China is the largest commodity consumer. Chinese manufacturing PMI contraction → falling demand for oil and copper → petrochemical margins (SABIC) compress → pressure on Gulf export revenues. PMI recovery → the reverse applies.";
}

function buildRiskAppetiteLinkage(
  btcChangePct: number | null,
  goldChangePct: number | null,
  spyChangePct: number | null,
  lang: Lang,
): string {
  const ar = lang === "ar";
  const btcUp   = btcChangePct !== null && btcChangePct >= 2;
  const btcDown = btcChangePct !== null && btcChangePct <= -2;
  const goldUp  = goldChangePct !== null && goldChangePct >= 0.5;
  const goldDown= goldChangePct !== null && goldChangePct <= -0.5;
  const spyUp   = spyChangePct !== null && spyChangePct >= 0.5;
  const spyDown = spyChangePct !== null && spyChangePct <= -0.5;

  // Mode discrimination
  if (goldUp && btcDown)
    return ar
      ? `الذهب يرتفع + BTC يتراجع → ملاذ آمن دون شهية مخاطرة — ضغط ماكرو بدون سيولة → حذر.`
      : `Gold rising + BTC falling → safe-haven bid WITHOUT risk appetite — macro stress without liquidity expansion → caution signal.`;
  if (goldUp && btcUp && spyDown)
    return ar
      ? `الذهب + BTC يرتفعان مع تراجع الأسهم → توسّع السيولة أو طلب على مخزن القيمة — تحقق من اتجاه DXY للتمييز.`
      : `Gold + BTC both rising while equities fall → liquidity surge or store-of-value demand — check DXY direction to distinguish modes.`;
  if (btcUp && goldDown && spyUp)
    return ar
      ? `BTC + أسهم ترتفع مع تراجع الذهب → شهية مخاطرة نشطة — الطلب على الملاذ غائب، متوافق مع بيئة إيجابية.`
      : `BTC + equities rising while gold fades → active risk appetite — haven demand absent; consistent with risk-on environment.`;
  if (btcDown && goldDown)
    return ar
      ? `BTC + الذهب كلاهما يتراجع → احتمال استنزاف سيولة الدولار أو شح السيولة العام → يُراقَب DXY.`
      : `BTC + gold both falling → potential dollar-liquidity drain or broad derisking — monitor DXY direction.`;
  if (spyDown && btcDown)
    return ar
      ? `تراجع الأسهم + BTC معاً → ضغط هروب من المخاطرة — نمط عام للتقليص.`
      : `Equities + BTC both falling → broad risk-off pressure — general deleveraging pattern.`;

  // Default
  const parts: string[] = [];
  if (btcChangePct !== null)  parts.push(`BTC ${fmtPct(btcChangePct)}`);
  if (goldChangePct !== null) parts.push(`Gold ${fmtPct(goldChangePct)}`);
  if (spyChangePct !== null)  parts.push(`SPY ${fmtPct(spyChangePct)}`);
  const summary = parts.join(", ") || "data unavailable";
  return ar
    ? `شهية المخاطرة (${summary}): إشارات مختلطة أو محدودة — لا تأكيد متقاطع واضح.`
    : `Risk appetite (${summary}): mixed or limited signals — no clear cross-asset confirmation.`;
}

function buildSpilloverNote(
  oilChangePct: number | null,
  eurUsd: number | null,
  creditStress: "low" | "moderate" | "high" | "extreme",
  lang: Lang,
): string | null {
  const ar = lang === "ar";
  const oilFallingHard = oilChangePct !== null && oilChangePct <= -2;
  const dxyStrong = eurUsd !== null && eurUsd <= 1.02;
  const highCredit = creditStress === "high" || creditStress === "extreme";

  // Compound shock: oil falling + DXY strong = EM double headwind
  if (oilFallingHard && dxyStrong) {
    return ar
      ? "انتقال مركّب: النفط يهبط بحدة + الدولار قوي → دفاع الأسواق الناشئة يواجه صدمتين متزامنتين: (1) تراجع الإيرادات من السلع + (2) استنزاف تدفقات رأس المال → الأسواق الناشئة والخليج تحت أشد ضغط ممكن في هذه التوليفة."
      : "Compound spillover: oil falling hard + strong USD → EM/Gulf markets face a double headwind: (1) commodity revenue decline + (2) capital flow repatriation → this combination is the most adverse regime for Saudi/Gulf equities.";
  }
  // Credit stress + equity pressure
  if (highCredit && oilFallingHard) {
    return ar
      ? "انتقال ائتماني: ضغط ائتمان مرتفع + هبوط النفط → تضيّق فروقات صكوك الخليج + تراجع الودائع الحكومية → ضغط مزدوج على السيولة المحلية."
      : "Credit spillover: high credit stress + oil falling → Gulf sukuk spreads widen + government deposits at risk → dual local liquidity pressure.";
  }
  // DXY + credit stress = EM liquidity squeeze
  if (dxyStrong && highCredit) {
    return ar
      ? "انتقال سيولة: دولار قوي + ضغط ائتمان مرتفع → ضغط تمويل الأسواق الناشئة → تضيق السيولة الدولارية عالمياً → مخاطر إعادة تسعير الأصول عالية الرافعة."
      : "Liquidity spillover: strong USD + high credit stress → EM funding pressure → global dollar liquidity squeeze → repricing risk for leveraged assets.";
  }
  return null;
}

// ─── Active linkage detection ─────────────────────────────────────────────────

function detectActiveLinkages(input: CrossMarketFusionInput): CrossMarketLinkage[] {
  const active: CrossMarketLinkage[] = [];
  const q = input.question;

  if (OIL_Q.test(q) || input.oilPrice !== null)
    active.push("oil_fiscal_channel");
  if (USD_Q.test(q) || (input.eurUsd !== null && (input.eurUsd <= 1.02 || input.eurUsd >= 1.10)))
    active.push("usd_em_flows");
  if (RATES_Q.test(q) || input.tltChangePct !== null)
    active.push("rates_valuation");
  if (LIQUIDITY_Q.test(q) || input.creditStress !== "low")
    active.push("liquidity_risk_appetite");
  if (CHINA_Q.test(q))
    active.push("china_commodity_demand");
  if (EM_Q.test(q))
    active.push("regional_flow_rotation");
  // Spillover is active when multiple adverse signals coincide
  const oilFalling = input.oilChangePct !== null && input.oilChangePct <= -1.5;
  const dxyStrong  = input.eurUsd !== null && input.eurUsd <= 1.02;
  if (oilFalling || dxyStrong || input.creditStress === "high" || input.creditStress === "extreme")
    active.push("spillover_contagion");

  return [...new Set(active)]; // deduplicate
}

// ─── Dominant transmission chain ─────────────────────────────────────────────

function deriveDominantTransmission(
  linkages: CrossMarketLinkage[],
  oilChangePct: number | null,
  eurUsd: number | null,
  tltChangePct: number | null,
  creditStress: "low" | "moderate" | "high" | "extreme",
  regimeBias: "bullish" | "bearish" | "neutral",
  lang: Lang,
): string {
  const ar = lang === "ar";

  // Determine the most dominant pair of forces
  const oilFalling = oilChangePct !== null && oilChangePct <= -1;
  const oilRising  = oilChangePct !== null && oilChangePct >= 1;
  const dxyStrong  = eurUsd !== null && eurUsd <= 1.03;
  const dxyWeak    = eurUsd !== null && eurUsd >= 1.09;
  const ratesEasing = tltChangePct !== null && tltChangePct >= 0.4;
  const ratesTight  = tltChangePct !== null && tltChangePct <= -0.4;
  const hiCredit    = creditStress === "high" || creditStress === "extreme";

  if (oilFalling && dxyStrong)
    return ar
      ? "النفط يهبط → ضغط مالي سعودي + الدولار يرتفع → استنزاف تدفقات الأسواق الناشئة → الأسواق الناشئة/الخليج في أشد الأنظمة معاكسة."
      : "Oil falling → Saudi fiscal pressure + USD rising → EM flow drain → Gulf/EM markets in the most adverse dual-headwind regime.";
  if (oilRising && dxyWeak)
    return ar
      ? "النفط يرتفع → فضاء مالي إيجابي للسعودية + الدولار يضعف → تدفقات الأسواق الناشئة تنتعش → الأسواق الناشئة/الخليج في بيئة الرياح المواتية المزدوجة."
      : "Oil rising → positive Saudi fiscal space + USD weakening → EM inflows recover → Gulf/EM markets in a dual-tailwind environment.";
  if (ratesEasing && !hiCredit)
    return ar
      ? "العائدات تتراجع (TLT يرتفع) → انخفاض معامل الخصم → دعم لأصول النمو والمدة الطويلة → فضاء أوسع لأسهم النمو والعقارات."
      : "Yields falling (TLT rallying) → lower discount rate → support for growth and long-duration assets → multiple expansion window.";
  if (ratesTight && hiCredit)
    return ar
      ? "العائدات ترتفع + ضغط ائتمان → انضغاط مضاعفات التقييم → الأصول ذات المدة الطويلة تحت الضغط الأشد → سقف الثقة يُفرض."
      : "Yields rising + credit stress → multiple compression forces active → long-duration assets under dual pressure → confidence ceiling warranted.";
  if (regimeBias === "bullish" && !hiCredit)
    return ar
      ? "النظام الكلي بنّاء مع ضغط ائتمان محدود → السلاسل متقاطعة تدعم التعرض الانتقائي في المناطق الأكثر حساسية للأرباح."
      : "Constructive macro regime with limited credit friction → cross-market chains support selective exposure in highest earnings-sensitivity zones.";
  if (regimeBias === "bearish" || hiCredit)
    return ar
      ? "سلاسل الانتقال المتقاطعة تُنشئ رياحاً معاكسة متعددة — الانتقائية أفضل من التعرض الواسع؛ جودة الميزانية العمومية تتقدم على الزخم."
      : "Cross-market transmission chains creating multiple headwinds — selectivity over broad exposure; balance sheet quality outperforms momentum.";
  return ar
    ? "إشارات متعددة الأسواق محايدة أو مختلطة — لا سلسلة انتقال مهيمنة واضحة في الوقت الراهن."
    : "Cross-market signals are neutral or mixed — no dominant transmission chain is clearly dominant at present.";
}

// ─── Full fusion context builder ──────────────────────────────────────────────

function buildFusionContext(result: Omit<CrossMarketFusionResult, "fusionContext">, lang: Lang): string {
  const ar = lang === "ar";
  const lines: string[] = [];

  const header = ar
    ? "سياق دمج الأسواق المتقاطعة — استخدمه لتعزيز السلاسل السببية في التحليل:"
    : "Cross-Market Intelligence Fusion — use to strengthen causal chains in analysis:";
  lines.push(header);

  lines.push(ar ? `السلسلة المهيمنة: ${result.dominantTransmission}` : `Dominant chain: ${result.dominantTransmission}`);
  lines.push(ar ? `النفط والاقتصاد الكلي: ${result.oilMacroLinkage}` : `Oil/Macro: ${result.oilMacroLinkage}`);
  lines.push(ar ? `الأسعار والسيولة: ${result.ratesLiquidityLinkage}` : `Rates/Liquidity: ${result.ratesLiquidityLinkage}`);
  lines.push(ar ? `الدولار والتدفقات: ${result.usdEmFlowLinkage}` : `USD/EM Flows: ${result.usdEmFlowLinkage}`);
  if (result.chinaLinkage)
    lines.push(ar ? `الطلب الصيني: ${result.chinaLinkage}` : `China Demand: ${result.chinaLinkage}`);
  lines.push(ar ? `شهية المخاطرة: ${result.riskAppetiteLinkage}` : `Risk Appetite: ${result.riskAppetiteLinkage}`);
  if (result.spilloverNote)
    lines.push(ar ? `انتقال الصدمة: ${result.spilloverNote}` : `Spillover: ${result.spilloverNote}`);
  if (result.isolationRisk) {
    lines.push(ar
      ? "تحذير العزل: السؤال يحلل أصلاً منفرداً — يجب ربطه بالسلاسل المتقاطعة أعلاه."
      : "Isolation warning: question analyzes a single asset — must link to cross-market chains above.");
  }
  lines.push(ar
    ? "القاعدة: لا تحليل سوق معزول — كل ادعاء اتجاهي يجب أن يمر عبر آلية انتقال محددة."
    : "Rule: no isolated market analysis — every directional claim must pass through a named transmission mechanism.");

  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCrossMarketFusion(input: CrossMarketFusionInput): CrossMarketFusionResult {
  const { oilPrice, oilChangePct, tltChangePct, spyChangePct, btcChangePct,
          goldChangePct, eurUsd, creditStress, regimeBias, question, lang } = input;

  const activeLinkages    = detectActiveLinkages(input);
  const isolationRisk     = detectIsolationRisk(question);
  const oilMacroLinkage   = buildOilMacroLinkage(oilPrice, oilChangePct, lang);
  const ratesLiquidityLinkage = buildRatesLiquidityLinkage(tltChangePct, creditStress, lang);
  const usdEmFlowLinkage  = buildUsdEmFlowLinkage(eurUsd, lang);
  const chinaLinkage      = buildChinaLinkage(question, lang);
  const riskAppetiteLinkage = buildRiskAppetiteLinkage(btcChangePct, goldChangePct, spyChangePct, lang);
  const spilloverNote     = buildSpilloverNote(oilChangePct, eurUsd, creditStress, lang);
  const dominantTransmission = deriveDominantTransmission(
    activeLinkages, oilChangePct, eurUsd, tltChangePct, creditStress, regimeBias, lang,
  );

  const partial: Omit<CrossMarketFusionResult, "fusionContext"> = {
    activeLinkages, dominantTransmission, isolationRisk,
    oilMacroLinkage, ratesLiquidityLinkage, usdEmFlowLinkage,
    chinaLinkage, riskAppetiteLinkage, spilloverNote,
  };

  const fusionContext = buildFusionContext(partial, lang);

  return { ...partial, fusionContext };
}
