/**
 * Unified Market Intelligence Layer.
 *
 * Pure, deterministic, server-safe. Consumes a RouterQuote-shaped object
 * (and optional provider extras such as SAHMK raw liquidity, Finnhub news
 * sentiment) and produces an Arabic-first investment intelligence report.
 *
 * NEVER fetches data on its own. All price/news fetching happens in the
 * server function / public endpoint that wraps this module — keeps the
 * factor engine fast, testable, and free of network side-effects.
 *
 * NEVER executes trades. LIVE_TRADING_ENABLED remains false.
 */

import type { AssetClass, ProviderId, ProviderMode } from "@/lib/market/router";
import type { SahmkQuoteRaw } from "@/services/providers/sahmk";

// ---------- Input/Output types ----------

export type IntelDecision = "شراء" | "بيع" | "انتظار" | "مراقبة" | "مخاطرة عالية";
export type IntelTrend = "صاعد" | "هابط" | "جانبي";

export interface IntelQuoteInput {
  symbol: string;
  assetClass: AssetClass;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  liquidity: number | null;
  delayed: boolean;
  provider: ProviderId | null;
  mode: ProviderMode;
  success: boolean;
}

export interface IntelExtras {
  /** SAHMK raw payload (for inflow/outflow analysis when available). */
  sahmkRaw?: SahmkQuoteRaw | null;
  /** Aggregated news sentiment for US stocks (-100..+100), and headline count. */
  newsSentiment?: number | null;
  newsCount?: number | null;
}

export interface SaudiLiquidityAnalysis {
  inflow: number | null;
  outflow: number | null;
  net: number | null;
  classification: "تجميع" | "تصريف" | "محايد" | "غير متوفر";
  explanationAr: string;
}

export interface IntelReport {
  decision: IntelDecision;
  confidence: number;       // 0..100
  risk: number;             // 0..100
  trend: IntelTrend;
  summaryAr: string;
  reasonsAr: string[];
  positiveFactorsAr: string[];
  negativeFactorsAr: string[];
  oppositeScenarioAr: string;
  decisionChangeTriggerAr: string;
  dataMode: ProviderMode;
  provider: ProviderId | null;
  saudiLiquidity?: SaudiLiquidityAnalysis;
  /** Raw factor scores for debug / UI. */
  factors: {
    momentum: number;      // -100..+100
    volatility: number;    // 0..100
    liquidityScore: number; // 0..100 (higher = healthier)
    sentiment: number;     // -100..+100
    defensive: boolean;
  };
}

// ---------- Helpers ----------

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isGold(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s.startsWith("XAU") || s === "GOLD" || s === "GLD";
}

// ---------- Saudi liquidity ----------

function analyseSaudiLiquidity(raw: SahmkQuoteRaw | null | undefined, fallbackLiquidity: number | null): SaudiLiquidityAnalysis {
  const inflow =
    num(raw?.["inflow_value"]) ??
    num(raw?.["buy_value"]) ??
    num(raw?.["inflow"]);
  const outflow =
    num(raw?.["outflow_value"]) ??
    num(raw?.["sell_value"]) ??
    num(raw?.["outflow"]);

  if (inflow != null && outflow != null) {
    const net = inflow - outflow;
    const total = inflow + outflow;
    const ratio = total > 0 ? net / total : 0; // -1..+1
    let classification: SaudiLiquidityAnalysis["classification"];
    let explanationAr: string;
    if (ratio > 0.1) {
      classification = "تجميع";
      explanationAr = `تدفق شراء صافٍ موجب (${net.toLocaleString("en-US")}) يشير إلى تجميع من المتداولين.`;
    } else if (ratio < -0.1) {
      classification = "تصريف";
      explanationAr = `تدفق بيع صافٍ سالب (${net.toLocaleString("en-US")}) يشير إلى تصريف وضغط بيع.`;
    } else {
      classification = "محايد";
      explanationAr = "توازن نسبي بين الشراء والبيع — السيولة محايدة.";
    }
    return { inflow, outflow, net, classification, explanationAr };
  }

  if (fallbackLiquidity != null) {
    return {
      inflow: null,
      outflow: null,
      net: null,
      classification: fallbackLiquidity > 0 ? "محايد" : "غير متوفر",
      explanationAr: `إجمالي السيولة المتاحة: ${fallbackLiquidity.toLocaleString("en-US")} — لا تتوفر تفاصيل تدفقات الشراء والبيع.`,
    };
  }

  return {
    inflow: null,
    outflow: null,
    net: null,
    classification: "غير متوفر",
    explanationAr: "لم تُتح بيانات تدفقات السيولة من المزود.",
  };
}

// ---------- Factor engine ----------

interface Factors {
  momentum: number;
  volatility: number;
  liquidityScore: number;
  sentiment: number;
  defensive: boolean;
}

function computeFactors(input: IntelQuoteInput, extras: IntelExtras, saudi?: SaudiLiquidityAnalysis): Factors {
  const cp = input.changePercent ?? 0;

  // Momentum: scale changePercent to -100..+100 with class-specific sensitivity.
  const momentumScale: Record<AssetClass, number> = {
    crypto: 10, us_stock: 20, saudi_stock: 25, etf: 25, metal: 30,
    commodity: 20, forex: 100, bond: 100, treasury: 200, index: 25, unknown: 20,
  };

  const momentum = clamp((cp / momentumScale[input.assetClass]) * 100, -100, 100);

  // Volatility (absolute % move, class-relative).
  const volatility = (() => {
    const abs = Math.abs(cp);
    if (input.assetClass === "crypto") return clamp(abs * 8, 0, 100);
    if (input.assetClass === "saudi_stock" || input.assetClass === "us_stock" || input.assetClass === "etf") {
      return clamp(abs * 15, 0, 100);
    }
    if (input.assetClass === "metal" || input.assetClass === "commodity") return clamp(abs * 20, 0, 100);
    return clamp(abs * 25, 0, 100);
  })();

  // Liquidity score
  let liquidityScore = 50;
  if (input.assetClass === "saudi_stock" && saudi) {
    if (saudi.classification === "تجميع") liquidityScore = 75;
    else if (saudi.classification === "تصريف") liquidityScore = 25;
    else if (saudi.classification === "محايد") liquidityScore = 55;
    else liquidityScore = 40;
  } else if (input.volume != null && input.volume > 0) {
    liquidityScore = 60;
  }

  const sentiment = extras.newsSentiment ?? 0;
  const defensive = isGold(input.symbol) || input.assetClass === "bond";

  return { momentum, volatility, liquidityScore, sentiment, defensive };
}

// ---------- Decision engine ----------

function decide(input: IntelQuoteInput, f: Factors): { decision: IntelDecision; trend: IntelTrend; confidence: number; risk: number } {
  // Trend
  const trend: IntelTrend = f.momentum > 25 ? "صاعد" : f.momentum < -25 ? "هابط" : "جانبي";

  // Composite signal: momentum (60%) + sentiment (20%) − volatility penalty (20%).
  let signal = f.momentum * 0.6 + f.sentiment * 0.2 - (f.volatility - 50) * 0.2;

  // Saudi liquidity tilt
  if (input.assetClass === "saudi_stock") signal += (f.liquidityScore - 50) * 0.4;

  // Defensive bias: tame aggressive long/short, gold rewards risk-off.
  if (f.defensive) signal *= 0.7;

  // Risk: volatility-driven, amplified for crypto.
  let risk = f.volatility;
  if (input.assetClass === "crypto") risk = clamp(risk * 1.2, 0, 100);
  if (input.assetClass === "saudi_stock" && f.liquidityScore < 35) risk = clamp(risk + 15, 0, 100);

  // Decision mapping
  let decision: IntelDecision;
  if (risk >= 80) decision = "مخاطرة عالية";
  else if (signal >= 35) decision = "شراء";
  else if (signal <= -35) decision = "بيع";
  else if (Math.abs(signal) < 10) decision = "انتظار";
  else decision = "مراقبة";

  // Confidence: agreement of momentum/sentiment/liquidity, dampened by data quality.
  const agreement = clamp(Math.abs(signal), 0, 100);
  let confidence = agreement;
  if (input.delayed) confidence *= 0.85;
  if (!input.success) confidence *= 0.4;
  if (input.assetClass === "us_stock" && (extrasCount(input, f) === 0)) confidence *= 0.9;
  confidence = clamp(Math.round(confidence), 5, 95);

  return { decision, trend, confidence, risk: Math.round(clamp(risk, 0, 100)) };
}

function extrasCount(_input: IntelQuoteInput, f: Factors): number {
  return Math.abs(f.sentiment) > 0 ? 1 : 0;
}

// ---------- Narrative ----------

function buildNarrative(
  input: IntelQuoteInput,
  f: Factors,
  d: { decision: IntelDecision; trend: IntelTrend; confidence: number; risk: number },
  extras: IntelExtras,
  saudi?: SaudiLiquidityAnalysis,
): { reasons: string[]; positives: string[]; negatives: string[]; summary: string; opposite: string; trigger: string } {
  const positives: string[] = [];
  const negatives: string[] = [];
  const reasons: string[] = [];

  const cp = input.changePercent ?? 0;
  const cpTxt = `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`;

  if (f.momentum > 25) positives.push(`زخم سعري إيجابي خلال آخر جلسة (${cpTxt}).`);
  else if (f.momentum < -25) negatives.push(`زخم سعري سلبي خلال آخر جلسة (${cpTxt}).`);
  else reasons.push(`حركة سعرية محدودة (${cpTxt}) — السوق في وضع انتظار.`);

  if (f.volatility > 70) negatives.push(`تذبذب مرتفع (${Math.round(f.volatility)}/100) يزيد المخاطر.`);
  else if (f.volatility < 25) positives.push(`تذبذب منخفض يعكس استقرار نسبي.`);

  if (input.assetClass === "saudi_stock" && saudi) {
    reasons.push(`تحليل السيولة السعودية: ${saudi.classification}.`);
    if (saudi.classification === "تجميع") positives.push("تدفقات شراء صافية موجبة من السوق السعودي.");
    if (saudi.classification === "تصريف") negatives.push("تدفقات بيع صافية تشير إلى ضغط هبوطي.");
  }

  if (input.assetClass === "crypto") {
    negatives.push("تحذير: العملات الرقمية ذات تذبذب مرتفع — قد تتغير الأسعار خلال دقائق.");
  }

  if (isGold(input.symbol)) {
    reasons.push("الذهب أصل دفاعي تقليدي يستفيد من فترات عدم اليقين وضعف الدولار.");
    if (f.momentum > 25) positives.push("الزخم الصاعد في الذهب يدعم سيناريو risk-off (تجنب المخاطرة).");
  }

  if (input.assetClass === "us_stock") {
    if (extras.newsCount && extras.newsCount > 0) {
      if (f.sentiment > 20) positives.push(`تدفق إخباري إيجابي (${extras.newsCount} عناوين).`);
      else if (f.sentiment < -20) negatives.push(`تدفق إخباري سلبي (${extras.newsCount} عناوين).`);
      else reasons.push(`تدفق إخباري محايد (${extras.newsCount} عناوين).`);
    } else {
      reasons.push("لا توجد أخبار كافية لتقييم التأثير الإعلامي.");
    }
  }

  if (input.delayed) reasons.push("⚠️ البيانات متأخرة، ليست لحظية.");
  if (!input.success) negatives.push("لم يتم جلب بيانات حقيقية من المزود (وضع تركيبي).");

  // Summary
  const summary = `القرار الحالي: ${d.decision}. الاتجاه ${d.trend} بثقة ${d.confidence}% ومخاطرة ${d.risk}/100. ${
    d.decision === "شراء" ? "الزخم والعوامل الفنية تدعم الدخول، مع مراعاة إدارة المخاطر."
    : d.decision === "بيع" ? "العوامل الحالية تدعم الخروج أو تقليل الانكشاف."
    : d.decision === "مخاطرة عالية" ? "ظروف السوق غير مناسبة — يُفضل الابتعاد حتى تستقر."
    : d.decision === "انتظار" ? "لا توجد إشارة واضحة — الأفضل الانتظار حتى يتحدد الاتجاه."
    : "إبقاء الأصل تحت المراقبة دون اتخاذ قرار حاسم."
  }`;

  // Opposite scenario
  const opposite = d.decision === "شراء"
    ? "إذا انعكس الزخم وانخفض السعر بأكثر من ضعف نسبة التحرك اليومية، أو ظهرت أخبار سلبية مفاجئة، فسيتحول القرار إلى انتظار أو بيع."
    : d.decision === "بيع"
    ? "إذا ظهر دعم قوي مع تدفق شراء صافٍ أو خبر إيجابي جوهري، فقد ينعكس الاتجاه ويتحول القرار إلى مراقبة أو شراء."
    : d.decision === "مخاطرة عالية"
    ? "تراجع التذبذب وعودة السيولة الطبيعية يُعيد الأصل إلى نطاق التقييم العادي."
    : "تكوّن اتجاه واضح صاعد أو هابط مع تأكيد من الحجم/السيولة سيُخرج القرار من حالة الانتظار.";

  // Trigger
  const trigger = (() => {
    const base = input.price ?? 0;
    const move = Math.max(Math.abs(cp), 1);
    if (d.decision === "شراء" || d.decision === "بيع") {
      return `يتغير القرار إذا تحرك السعر بأكثر من ${(move * 1.5).toFixed(2)}% في الاتجاه المعاكس، أو إذا تجاوز التذبذب 80/100.`;
    }
    if (base > 0) {
      const up = (base * (1 + move / 100)).toFixed(2);
      const dn = (base * (1 - move / 100)).toFixed(2);
      return `كسر مستوى ${up} صعوداً أو ${dn} هبوطاً مع زيادة الحجم سيُحفّز تغيير القرار.`;
    }
    return "ظهور بيانات أوضح للسعر أو حجم التداول.";
  })();

  return { reasons, positives, negatives, summary, opposite, trigger };
}

// ---------- Public entry ----------

export function buildMarketIntelligence(input: IntelQuoteInput, extras: IntelExtras = {}): IntelReport {
  const saudi = input.assetClass === "saudi_stock"
    ? analyseSaudiLiquidity(extras.sahmkRaw ?? null, input.liquidity)
    : undefined;
  const factors = computeFactors(input, extras, saudi);
  const d = decide(input, factors);
  const n = buildNarrative(input, factors, d, extras, saudi);

  return {
    decision: d.decision,
    confidence: d.confidence,
    risk: d.risk,
    trend: d.trend,
    summaryAr: n.summary,
    reasonsAr: n.reasons,
    positiveFactorsAr: n.positives,
    negativeFactorsAr: n.negatives,
    oppositeScenarioAr: n.opposite,
    decisionChangeTriggerAr: n.trigger,
    dataMode: input.mode,
    provider: input.provider,
    saudiLiquidity: saudi,
    factors,
  };
}
