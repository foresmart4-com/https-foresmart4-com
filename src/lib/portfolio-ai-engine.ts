// Client-safe portfolio AI engine — consumes priced user assets + MarketIntel
// to generate non-binding Arabic recommendations, factor analysis and risk metrics.
import type { PricedAsset, AssetClass, AssetDataMode } from "@/lib/assets.functions";
import type { MarketIntel } from "@/services/analysis";

export type Action = "increase" | "reduce" | "hold" | "watch";
export type Stance = "defensive" | "balanced" | "aggressive";

export interface AssetRecommendation {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  weight: number;          // 0..1
  targetWeight: number;    // 0..1
  marketValue: number;
  pnl: number;
  pnlPct: number;
  action: Action;
  actionAr: string;
  confidence: number;      // 0..100
  rationaleAr: string;
  factorsAr: string[];
  risksAr: string[];
  triggerAr: string;       // when does this recommendation flip
  dataMode: AssetDataMode;
}

export interface FactorReading {
  key: string;
  labelAr: string;
  valueAr: string;
  impactAr: string;        // bullish / bearish / neutral in Arabic
  score: number;           // -100..100
}

export interface PortfolioRiskMetrics {
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPct: number;
  riskScore: number;       // 0..100, higher = riskier
  varPct: number | null;   // 1-day 95% VaR estimate as % of NAV
  sharpe: number | null;
  diversification: number; // 0..100
  cashPct: number;
  cryptoPct: number;
  equityPct: number;
  defensivePct: number;
}

export interface AISummary {
  stance: Stance;
  stanceAr: string;
  topRisksAr: string[];
  topOpportunitiesAr: string[];
  bestActionAr: string;
  confidence: number;
}

export interface PortfolioAIResult {
  metrics: PortfolioRiskMetrics;
  recommendations: AssetRecommendation[];
  factors: FactorReading[];
  summary: AISummary;
  disclaimerAr: string;
}

// Annualized volatility assumption per asset class (used for parametric VaR)
const ANNUAL_VOL: Record<AssetClass, number> = {
  us_stock: 0.22, sa_stock: 0.20, etf: 0.18, bond: 0.07,
  crypto: 0.75, metal: 0.16, commodity: 0.28, cash: 0.0, other: 0.25,
};

const CLASS_LABEL_AR: Record<AssetClass, string> = {
  us_stock: "أسهم أمريكية", sa_stock: "أسهم سعودية", etf: "صناديق ETF",
  bond: "سندات", crypto: "كريبتو", metal: "معادن", commodity: "سلع",
  cash: "نقد", other: "أخرى",
};

const ACTION_AR: Record<Action, string> = {
  increase: "زيادة", reduce: "تخفيف", hold: "تثبيت", watch: "مراقبة",
};

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function classCap(cls: AssetClass, stance: Stance): number {
  const base: Record<AssetClass, number> = {
    crypto: 0.20, us_stock: 0.15, sa_stock: 0.12, etf: 0.30, bond: 0.40,
    metal: 0.15, commodity: 0.10, cash: 0.40, other: 0.10,
  };
  const mult = stance === "aggressive" ? 1.25 : stance === "defensive" ? 0.75 : 1;
  return clamp(base[cls] * mult, 0.03, 0.6);
}

export function buildFactors(intel: MarketIntel | null | undefined): FactorReading[] {
  const fg = intel?.sentiment?.score ?? 50;
  const regime = intel?.regime?.regime ?? "Sideways";
  const news = intel?.news ?? [];
  const quotes = intel?.quotes ?? [];

  const avgChange = quotes.length
    ? quotes.reduce((s, q) => s + (q.changePct ?? 0), 0) / quotes.length
    : 0;
  const vol = quotes.length
    ? Math.sqrt(quotes.reduce((s, q) => s + Math.pow(q.changePct ?? 0, 2), 0) / quotes.length)
    : 0;

  const trendScore = clamp(avgChange * 20, -100, 100);
  const volScore = clamp(vol * 25 - 50, -100, 100);
  const newsScore = clamp((fg - 50) * 2, -100, 100);

  const findKey = (re: RegExp) => quotes.find((q) => re.test(String(q.key)));
  const usd = findKey(/DXY|USD/i);
  const gold = findKey(/XAU|GOLD/i);
  const oil = findKey(/OIL|WTI|BRENT/i);

  const impactAr = (s: number) => s > 15 ? "إيجابي" : s < -15 ? "سلبي" : "محايد";
  const regAr =
    regime === "Trending Bullish" || regime === "Risk-On" ? "صاعد"
    : regime === "Trending Bearish" || regime === "Risk-Off" || regime === "Panic" ? "هابط"
    : regime === "High Volatility" ? "متذبذب بقوة" : "جانبي";

  return [
    { key: "trend", labelAr: "اتجاه السوق", valueAr: regAr, impactAr: impactAr(trendScore), score: trendScore },
    { key: "volatility", labelAr: "التقلب",
      valueAr: vol > 3 ? "مرتفع" : vol > 1.5 ? "متوسط" : "منخفض",
      impactAr: impactAr(-volScore), score: -volScore },
    { key: "news", labelAr: "الأخبار والمعنويات",
      valueAr: fg > 65 ? "طمع" : fg < 35 ? "خوف" : "متوازن",
      impactAr: impactAr(newsScore), score: newsScore },
    { key: "correlation", labelAr: "الارتباط بين الأصول",
      valueAr: vol > 2.5 ? "ارتفاع الارتباط" : "ارتباط معتدل",
      impactAr: vol > 2.5 ? "سلبي" : "محايد", score: vol > 2.5 ? -40 : 0 },
    { key: "rates", labelAr: "الفائدة والتضخم",
      valueAr: "ضغط متواصل من السياسة النقدية", impactAr: "محايد", score: -10 },
    { key: "usd", labelAr: "الدولار الأمريكي",
      valueAr: usd ? `${(usd.changePct ?? 0).toFixed(2)}%` : "غير متاح",
      impactAr: usd ? impactAr(-(usd.changePct ?? 0) * 10) : "محايد",
      score: usd ? -(usd.changePct ?? 0) * 10 : 0 },
    { key: "gold", labelAr: "الذهب",
      valueAr: gold ? `${(gold.changePct ?? 0).toFixed(2)}%` : "غير متاح",
      impactAr: gold ? impactAr((gold.changePct ?? 0) * 10) : "محايد",
      score: gold ? (gold.changePct ?? 0) * 10 : 0 },
    { key: "oil", labelAr: "النفط",
      valueAr: oil ? `${(oil.changePct ?? 0).toFixed(2)}%` : "غير متاح",
      impactAr: oil ? impactAr((oil.changePct ?? 0) * 10) : "محايد",
      score: oil ? (oil.changePct ?? 0) * 10 : 0 },
    { key: "momentum", labelAr: "زخم السعر",
      valueAr: avgChange > 0.5 ? "إيجابي" : avgChange < -0.5 ? "سلبي" : "ضعيف",
      impactAr: impactAr(avgChange * 30), score: clamp(avgChange * 30, -100, 100) },
    { key: "headlines", labelAr: "تدفق الأخبار",
      valueAr: news.length ? `${news.length} عنوان حديث` : "لا يوجد",
      impactAr: "محايد", score: 0 },
  ];
}

export function buildPortfolioAI(
  assets: PricedAsset[],
  intel: MarketIntel | null | undefined,
): PortfolioAIResult {
  const totalValue = assets.reduce((s, a) => s + a.marketValue, 0);
  const totalCost = assets.reduce((s, a) => s + a.costBasis, 0);
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const weightOf = (a: PricedAsset) => (totalValue > 0 ? a.marketValue / totalValue : 0);

  const sumByClass = (pred: (c: AssetClass) => boolean) =>
    assets.filter((a) => pred(a.asset_class)).reduce((s, a) => s + a.marketValue, 0);

  const cashPct = totalValue > 0 ? sumByClass((c) => c === "cash") / totalValue : 0;
  const cryptoPct = totalValue > 0 ? sumByClass((c) => c === "crypto") / totalValue : 0;
  const equityPct = totalValue > 0
    ? sumByClass((c) => c === "us_stock" || c === "sa_stock" || c === "etf") / totalValue : 0;
  const defensivePct = totalValue > 0
    ? sumByClass((c) => c === "cash" || c === "bond" || c === "metal") / totalValue : 0;

  // Portfolio annualized volatility (independence assumption — conservative simplification)
  const portVar = assets.reduce((s, a) => {
    const w = weightOf(a);
    const v = ANNUAL_VOL[a.asset_class] ?? 0.2;
    return s + w * w * v * v;
  }, 0);
  const portVol = Math.sqrt(portVar);

  // VaR 95% 1-day ≈ 1.65 * dailyVol
  const dailyVol = portVol / Math.sqrt(252);
  const varPct = assets.length >= 2 && totalValue > 0 ? +(1.65 * dailyVol * 100).toFixed(2) : null;

  // Risk score: higher vol & crypto concentration => higher
  const riskScore = clamp(Math.round(portVol * 200 + cryptoPct * 40 - defensivePct * 30 + 40), 0, 100);

  const sharpe = pnlPct !== 0 && portVol > 0
    ? +(pnlPct / 100 / Math.max(portVol, 0.05)).toFixed(2)
    : null;

  // Diversification: based on number of classes & Herfindahl
  const hh = assets.reduce((s, a) => s + Math.pow(weightOf(a), 2), 0);
  const diversification = clamp(Math.round((1 - hh) * 100), 0, 100);

  const stance: Stance =
    riskScore > 65 ? "aggressive"
    : defensivePct > 0.45 || riskScore < 35 ? "defensive"
    : "balanced";

  const stanceAr = stance === "aggressive" ? "هجومي" : stance === "defensive" ? "دفاعي" : "متوازن";

  const factors = buildFactors(intel);
  const trendF = factors.find((f) => f.key === "trend")?.score ?? 0;
  const volF = factors.find((f) => f.key === "volatility")?.score ?? 0;
  const newsF = factors.find((f) => f.key === "news")?.score ?? 0;

  // Per-asset recommendations
  const recommendations: AssetRecommendation[] = assets.map((a) => {
    const w = weightOf(a);
    const cap = classCap(a.asset_class, stance);
    let action: Action = "hold";
    const factorsAr: string[] = [];
    const risksAr: string[] = [];
    let triggerAr = "يتغير القرار عند تجاوز ±5% من الوزن المستهدف أو تغير الاتجاه العام.";
    let confidence = 55;

    // Concentration cap
    if (w > cap + 0.02) {
      action = "reduce";
      factorsAr.push(`الوزن الحالي ${(w * 100).toFixed(1)}% يتجاوز السقف ${(cap * 100).toFixed(0)}%`);
      risksAr.push("تركيز مرتفع في أصل واحد يزيد مخاطر المحفظة");
      confidence = 70;
    } else if (w < cap * 0.4 && a.asset_class !== "other") {
      action = "increase";
      factorsAr.push(`وزن منخفض (${(w * 100).toFixed(1)}%) مقارنة بالسقف المسموح`);
      confidence = 58;
    }

    // Asset-class overlays
    if (a.asset_class === "crypto") {
      factorsAr.push(`تقلب سنوي مرتفع (${Math.round(ANNUAL_VOL.crypto * 100)}%)`);
      risksAr.push("حساسية عالية للمعنويات والسيولة العالمية");
      if (volF > 30 && action !== "reduce") { action = "watch"; confidence = Math.max(confidence, 60); }
    }
    if (a.asset_class === "us_stock" || a.asset_class === "etf") {
      factorsAr.push(`اتجاه السوق الأمريكي: ${trendF > 10 ? "إيجابي" : trendF < -10 ? "سلبي" : "محايد"}`);
      if (trendF < -20 && action === "hold") { action = "watch"; }
      if (newsF > 30 && action === "hold") confidence = Math.max(confidence, 60);
    }
    if (a.asset_class === "bond" || a.asset_class === "metal" || a.asset_class === "cash") {
      factorsAr.push("أصل دفاعي يدعم استقرار المحفظة");
      if (stance === "defensive" && action === "hold") action = "increase";
    }

    // P&L driven
    if (a.pnlPct <= -15) {
      factorsAr.push(`خسارة غير محققة ${a.pnlPct.toFixed(1)}%`);
      risksAr.push("استمرار الضعف قد يؤثر على رأس المال");
      if (action === "hold") action = "watch";
    } else if (a.pnlPct >= 25 && action !== "reduce") {
      factorsAr.push(`ربح غير محقق ${a.pnlPct.toFixed(1)}% — فرصة لجني جزئي`);
    }

    const target = clamp(cap, 0.02, 0.6);
    const rationaleAr =
      action === "increase" ? "الوزن الحالي أقل من السقف المناسب لطبيعة هذا الأصل."
      : action === "reduce" ? "الوزن الحالي يتجاوز السقف الموصى به لتقليل التركيز."
      : action === "watch" ? "هناك مؤشرات تستدعي المراقبة قبل أي إجراء."
      : "الوزن الحالي ضمن النطاق المستهدف ولا حاجة لإجراء.";

    if (a.data_mode === "mock") {
      risksAr.push("بيانات تجريبية — لا تعتمد عليها لاتخاذ قرار حقيقي");
      confidence = Math.min(confidence, 45);
    } else if (a.data_mode === "manual") {
      risksAr.push("سعر مدخل يدوياً — حدّث القيم بانتظام");
      confidence = Math.min(confidence, 60);
    }

    return {
      id: a.id, symbol: a.symbol, name: a.name ?? a.symbol,
      assetClass: a.asset_class, weight: w, targetWeight: target,
      marketValue: a.marketValue, pnl: a.pnl, pnlPct: a.pnlPct,
      action, actionAr: ACTION_AR[action],
      confidence, rationaleAr, factorsAr, risksAr, triggerAr,
      dataMode: a.priceMode,
    };
  });

  // Summary opportunities / risks
  const topRisksAr: string[] = [];
  if (cryptoPct > 0.25) topRisksAr.push(`تركيز الكريبتو ${(cryptoPct * 100).toFixed(0)}% أعلى من الحد الموصى به`);
  if (defensivePct < 0.15 && totalValue > 0) topRisksAr.push("تغطية دفاعية منخفضة (نقد/سندات/معادن < 15%)");
  if (varPct && varPct > 3) topRisksAr.push(`خسارة يومية محتملة بثقة 95% تبلغ ${varPct}%`);
  if (diversification < 40) topRisksAr.push("تنويع ضعيف — معظم القيمة في عدد قليل من الأصول");
  if (assets.some((a) => a.priceMode === "mock")) topRisksAr.push("توجد بيانات تجريبية ضمن المحفظة");

  const topOpportunitiesAr: string[] = [];
  if (trendF > 20 && equityPct < 0.3) topOpportunitiesAr.push("اتجاه أسهم إيجابي مع وزن منخفض حالياً");
  if (newsF > 25) topOpportunitiesAr.push("معنويات السوق إيجابية — متابعة فرص الزخم");
  const winners = recommendations.filter((r) => r.action === "increase").slice(0, 3);
  if (winners.length) topOpportunitiesAr.push(`زيادة محتملة في: ${winners.map((w) => w.symbol).join(", ")}`);
  if (cashPct > 0.4) topOpportunitiesAr.push("نسبة نقد مرتفعة — يمكن توزيعها تدريجياً عند تحسن الإشارات");

  while (topRisksAr.length < 3) topRisksAr.push("لا توجد مخاطر إضافية ملحوظة حالياً");
  while (topOpportunitiesAr.length < 3) topOpportunitiesAr.push("بانتظار إشارات أوضح من السوق");

  const reducers = recommendations.filter((r) => r.action === "reduce");
  const bestActionAr =
    reducers.length ? `تخفيف التركيز في ${reducers[0].symbol} نحو ${(reducers[0].targetWeight * 100).toFixed(0)}%`
    : winners.length ? `زيادة تدريجية في ${winners[0].symbol} ضمن الحدود`
    : stance === "defensive" ? "رفع التغطية الدفاعية (سندات/نقد) قليلاً"
    : "الإبقاء على التوزيع الحالي مع المراقبة";

  const summaryConfidence = clamp(
    Math.round(50 + (intel?.confidence?.average ?? 0) * 0.3 + diversification * 0.15 - (varPct ?? 0) * 3),
    20, 90,
  );

  return {
    metrics: {
      totalValue, totalCost, pnl, pnlPct,
      riskScore, varPct, sharpe, diversification,
      cashPct, cryptoPct, equityPct, defensivePct,
    },
    recommendations,
    factors,
    summary: {
      stance, stanceAr,
      topRisksAr: topRisksAr.slice(0, 3),
      topOpportunitiesAr: topOpportunitiesAr.slice(0, 3),
      bestActionAr,
      confidence: summaryConfidence,
    },
    disclaimerAr: "اقتراح تحليلي غير ملزم — لا يُعد توصية مالية. القرار النهائي مسؤوليتك.",
  };
}

export const CLASS_LABEL_AR_MAP = CLASS_LABEL_AR;
