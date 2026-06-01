import type { MarketQuote } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";

export type Sentiment = "bullish" | "bearish" | "neutral";
export type RiskLevel = "low" | "moderate" | "elevated" | "high";

export interface MarketSummary {
  sentiment: Sentiment;
  riskLevel: RiskLevel;
  focusAsset: string;
  headline: string;
  body: string;
  generatedAt: number;
}

const bullishEn = [
  "Market sentiment remains constructive as risk assets push higher with broadening participation.",
  "Momentum across major benchmarks continues to favor bulls amid healthy volume confirmation.",
  "Risk appetite improves as leadership rotates into high-beta names and crypto majors strengthen.",
];
const bullishAr = [
  "معنويات السوق بنّاءة مع ارتفاع الأصول عالية المخاطر وتوسع المشاركة.",
  "الزخم عبر المؤشرات الرئيسية يستمر لصالح المشترين مع تأكيد الحجم.",
  "شهية المخاطرة تتحسن مع دوران القيادة نحو الأسهم عالية البيتا.",
];
const bearishEn = [
  "Risk-off tone dominates as defensive flows accelerate and breadth deteriorates.",
  "Sentiment turns cautious as momentum fades and volatility expands across cyclicals.",
  "Markets show distribution as overhead supply weighs on rallies and credit spreads widen.",
];
const bearishAr = [
  "النبرة الدفاعية تسود مع تسارع التدفقات الدفاعية وتراجع الاتساع.",
  "المعنويات تتحول نحو الحذر مع تراجع الزخم وتوسع التقلب.",
  "الأسواق تُظهر توزيعاً مع ضغط العرض واتساع فروقات الائتمان.",
];
const neutralEn = [
  "Markets trade in a balanced range as participants digest mixed macro signals.",
  "Price action remains constructive but range-bound — awaiting the next catalyst.",
  "Sentiment is balanced; rotation continues beneath the surface without a clear directional bias.",
];
const neutralAr = [
  "الأسواق تتداول في نطاق متوازن بينما يستوعب المشاركون إشارات الماكرو المتضاربة.",
  "حركة السعر بنّاءة لكنها ضمن نطاق — في انتظار المحفز التالي.",
  "المعنويات متوازنة؛ يستمر الدوران تحت السطح دون تحيز اتجاهي واضح.",
];

const RISK_LEVEL_AR: Record<RiskLevel, string> = {
  low: "منخفض", moderate: "معتدل", elevated: "مرتفع", high: "عالٍ",
};
const ACTION_LABEL_AR: Record<string, string> = {
  BUY: "شراء", SELL: "بيع", HOLD: "انتظار", WAIT: "انتظار",
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function buildSummary(quotes: MarketQuote[], signals: Signal[], lang?: string): MarketSummary {
  const ar = lang === "ar";
  const avgMom = quotes.reduce((s, q) => s + q.momentum, 0) / Math.max(1, quotes.length);
  const avgVol = quotes.reduce((s, q) => s + q.volatility, 0) / Math.max(1, quotes.length);
  const sentiment: Sentiment = avgMom > 0.4 ? "bullish" : avgMom < -0.4 ? "bearish" : "neutral";

  const riskLevel: RiskLevel =
    avgVol > 65 ? "high" : avgVol > 45 ? "elevated" : avgVol > 25 ? "moderate" : "low";

  const top = [...signals].sort((a, b) => b.confidence - a.confidence)[0];
  const focusAsset = top ? `${top.assetName} (${top.action})` : "Bitcoin";

  const headlineEn = pick(sentiment === "bullish" ? bullishEn : sentiment === "bearish" ? bearishEn : neutralEn);
  const headlineAr = pick(sentiment === "bullish" ? bullishAr : sentiment === "bearish" ? bearishAr : neutralAr);
  const headline = ar ? headlineAr : headlineEn;

  const leaders = quotes.filter((q) => q.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 2);
  const laggards = quotes.filter((q) => q.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 2);

  const lead = leaders.map((q) => `${q.name} +${q.changePct.toFixed(2)}%`).join(", ") || "—";
  const lag = laggards.map((q) => `${q.name} ${q.changePct.toFixed(2)}%`).join(", ") || "—";

  let body: string;
  if (ar) {
    const focusAr = top
      ? `${top.assetName} (${ACTION_LABEL_AR[top.action] ?? top.action})`
      : "بيتكوين";
    body =
      `${headlineAr} القادة: ${lead}. المتأخرون: ${lag}. ` +
      `تقلب متعدد الأصول: ${RISK_LEVEL_AR[riskLevel]}. أعلى إعداد قناعة: ${focusAr}` +
      (top ? ` بثقة ${top.confidence}%.` : ".");
  } else {
    body =
      `${headlineEn} Leaders: ${lead}. Laggards: ${lag}. ` +
      `Cross-asset volatility is ${riskLevel}. Highest-conviction setup: ${focusAsset}` +
      (top ? ` with ${top.confidence}% confidence.` : ".");
  }

  return { sentiment, riskLevel, focusAsset, headline, body, generatedAt: Date.now() };
}
