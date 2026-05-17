// Market Intelligence Engine — ForeSmart
// Computes technical indicators + risk factors and generates a structured
// AI trading decision. All news/macro signals are MOCK and clearly labeled.
// Designed to be easily wired later to: Finnhub News, GDELT, NewsAPI,
// Twelve Data, Alpha Vantage, etc.

export type SentimentLabel = "positive" | "neutral" | "negative";
export type TrendDirection = "up" | "down" | "side";
export type MarketCategory = "saudi" | "us" | "crypto" | "commodities" | "fx" | "other";

export type TechnicalIndicators = {
  rsi: number;
  ma20: number;
  ma50: number;
  trend: TrendDirection;
  support: number;
  resistance: number;
  volumeSignal: "high" | "normal" | "low" | "n/a";
  momentum: number;     // % over last n samples
  volatility: number;   // stdev pct
};

export type MacroSnapshot = {
  interestRate: number;     // %
  inflation: number;        // %
  dxy: number;              // USD index
  oilWti: number;           // USD/bbl
  gold: number;             // USD/oz
  source: "mock";
};

export type NewsSentiment = {
  label: SentimentLabel;
  score: number; // -1..1
  headline_ar: string;
  headline_en: string;
  source: "mock";
};

export type RiskFlags = {
  highVolatility: boolean;
  sharpDrop: boolean;
  overboughtRally: boolean;
  conflictingSignals: boolean;
  lowLiquidity: boolean;
};

export type AssetContext = {
  symbol: string;
  name_ar?: string;
  name_en?: string;
  category: MarketCategory;
  price: number;
  change24h: number;
  high24h?: number;
  low24h?: number;
  history?: number[];      // recent close prices, oldest -> newest
  volume?: number;
  avgVolume?: number;
  currency?: string;
};

export type TradingAction =
  | "BUY"
  | "SELL"
  | "HOLD"
  | "STOP_LOSS"
  | "TAKE_PROFIT";

export type ScoreBreakdown = {
  trendScore: number;
  momentumScore: number;
  rsiScore: number;
  volatilityScore: number;
  sentimentScore: number;
  macroScore: number;
  supportResistanceScore: number;
  riskPenalty: number;
  total: number; // -100..+100
};

export type TradingDecision = {
  asset: string;
  category: MarketCategory;
  action: TradingAction;
  confidence: number; // 0..100
  decisionScore: number; // -100..+100
  scoreBreakdown: ScoreBreakdown;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reasonSummary: string;
  supportingFactors: string[];
  warningFactors: string[];
  suggestedStopLoss: number;
  suggestedTakeProfit: number;
  suggestedPositionSize: number; // % of capital
  timeHorizon: "short" | "medium" | "long";
  mode: "analysis_only";
  indicators: TechnicalIndicators;
  sentiment: NewsSentiment;
  macro: MacroSnapshot;
  risk: RiskFlags;
  generatedAt: number;
  disclaimer: string;
};

const DISCLAIMER =
  "هذا تحليل مساعد وليس توصية مالية ملزمة. القرار النهائي مسؤولية المستخدم.";

// ============= Technical helpers =============
function sma(arr: number[], period: number): number {
  if (arr.length === 0) return 0;
  const slice = arr.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function rsi(arr: number[], period = 14): number {
  if (arr.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = arr.length - period; i < arr.length; i++) {
    const diff = arr[i] - arr[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function stdevPct(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return (Math.sqrt(variance) / mean) * 100;
}

function trendOf(ma20: number, ma50: number, price: number): TrendDirection {
  if (price > ma20 && ma20 > ma50) return "up";
  if (price < ma20 && ma20 < ma50) return "down";
  return "side";
}

function synthHistory(price: number, change24h: number): number[] {
  // Build a plausible 60-point series ending at `price`.
  const n = 60;
  const start = price / (1 + change24h / 100);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const trend = start + (price - start) * t;
    const noise = (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * (price * 0.004);
    out.push(Math.max(0.0001, trend + noise));
  }
  return out;
}

export function computeIndicators(ctx: AssetContext): TechnicalIndicators {
  const hist = ctx.history && ctx.history.length >= 20 ? ctx.history : synthHistory(ctx.price, ctx.change24h);
  const ma20 = sma(hist, 20);
  const ma50 = sma(hist, 50);
  const rsiVal = rsi(hist, 14);
  const recent = hist.slice(-20);
  const support = Math.min(...recent);
  const resistance = Math.max(...recent);
  const momentum = ((hist[hist.length - 1] - hist[hist.length - 10]) / hist[hist.length - 10]) * 100;
  const volatility = stdevPct(recent);
  let volumeSignal: TechnicalIndicators["volumeSignal"] = "n/a";
  if (ctx.volume && ctx.avgVolume) {
    const ratio = ctx.volume / ctx.avgVolume;
    if (ratio > 1.4) volumeSignal = "high";
    else if (ratio < 0.6) volumeSignal = "low";
    else volumeSignal = "normal";
  }
  return {
    rsi: Number(rsiVal.toFixed(1)),
    ma20: Number(ma20.toFixed(4)),
    ma50: Number(ma50.toFixed(4)),
    trend: trendOf(ma20, ma50, ctx.price),
    support: Number(support.toFixed(4)),
    resistance: Number(resistance.toFixed(4)),
    volumeSignal,
    momentum: Number(momentum.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
  };
}

// ============= Mock macro / news =============
export function getMockMacro(): MacroSnapshot {
  return {
    interestRate: 5.25,
    inflation: 2.9,
    dxy: 104.2,
    oilWti: 78.2,
    gold: 2418,
    source: "mock",
  };
}

const NEWS_POOL: Record<SentimentLabel, { ar: string; en: string }[]> = {
  positive: [
    { ar: "تدفقات شراء قوية على القطاع", en: "Strong buying inflows across the sector" },
    { ar: "نتائج ربعية تفوق التوقعات", en: "Earnings beat expectations" },
    { ar: "ترقية من بنك استثماري بارز", en: "Upgrade from a major investment bank" },
  ],
  neutral: [
    { ar: "تداول ضمن نطاق فني محدود", en: "Trading within a tight technical range" },
    { ar: "غياب محفزات قصيرة المدى", en: "Lack of near-term catalysts" },
  ],
  negative: [
    { ar: "ضغط بيعي وضعف في الزخم", en: "Selling pressure and weak momentum" },
    { ar: "مخاوف تنظيمية تثقل القطاع", en: "Regulatory concerns weigh on the sector" },
    { ar: "خفض توصية من محلل بارز", en: "Analyst downgrade weighs on the name" },
  ],
};

export function getMockNewsSentiment(ctx: AssetContext): NewsSentiment {
  let label: SentimentLabel = "neutral";
  if (ctx.change24h > 1.5) label = "positive";
  else if (ctx.change24h < -1.5) label = "negative";
  // small deterministic variability by symbol
  const seed = ctx.symbol.charCodeAt(0) % 3;
  const pick = NEWS_POOL[label][seed % NEWS_POOL[label].length];
  const score = label === "positive" ? 0.6 : label === "negative" ? -0.6 : 0;
  return { label, score, headline_ar: pick.ar, headline_en: pick.en, source: "mock" };
}

// ============= Risk flags =============
export function computeRisk(ctx: AssetContext, ind: TechnicalIndicators): RiskFlags {
  const highVol = ind.volatility > 4;
  const sharpDrop = ctx.change24h < -5 || ind.momentum < -6;
  const overboughtRally = ind.rsi > 75 && ctx.change24h > 4;
  const conflict =
    (ind.trend === "up" && ind.rsi > 70) ||
    (ind.trend === "down" && ind.rsi < 35);
  const lowLiq = ind.volumeSignal === "low";
  return {
    highVolatility: highVol,
    sharpDrop,
    overboughtRally,
    conflictingSignals: conflict,
    lowLiquidity: lowLiq,
  };
}

function riskLevel(risk: RiskFlags, ind: TechnicalIndicators): TradingDecision["riskLevel"] {
  const flags = Object.values(risk).filter(Boolean).length;
  if (flags >= 3 || ind.volatility > 6) return "HIGH";
  if (flags >= 1 || ind.volatility > 3) return "MEDIUM";
  return "LOW";
}

// ============= Decision engine =============
export function generateTradingDecision(ctx: AssetContext): TradingDecision {
  const indicators = computeIndicators(ctx);
  const sentiment = getMockNewsSentiment(ctx);
  const macro = getMockMacro();
  const risk = computeRisk(ctx, indicators);
  const rl = riskLevel(risk, indicators);

  const supporting: string[] = [];
  const warning: string[] = [];

  if (indicators.trend === "up") supporting.push("الاتجاه الفني صاعد فوق MA20/MA50");
  if (indicators.trend === "down") warning.push("الاتجاه الفني هابط تحت المتوسطات");
  if (indicators.rsi < 35) supporting.push(`RSI منخفض (${indicators.rsi}) — منطقة تشبع بيع`);
  if (indicators.rsi > 70) warning.push(`RSI مرتفع (${indicators.rsi}) — تشبع شراء`);
  if (indicators.momentum > 2) supporting.push(`زخم إيجابي ${indicators.momentum}%`);
  if (indicators.momentum < -2) warning.push(`زخم سلبي ${indicators.momentum}%`);
  if (sentiment.label === "positive") supporting.push(`معنويات إيجابية: ${sentiment.headline_ar}`);
  if (sentiment.label === "negative") warning.push(`معنويات سلبية: ${sentiment.headline_ar}`);
  if (risk.highVolatility) warning.push(`تقلب مرتفع (${indicators.volatility}%)`);
  if (risk.sharpDrop) warning.push("هبوط حاد قصير المدى");
  if (risk.overboughtRally) warning.push("صعود مبالغ فيه");
  if (risk.conflictingSignals) warning.push("إشارات فنية متضاربة");
  if (risk.lowLiquidity) warning.push("سيولة منخفضة");

  // Score-based action
  let score = 0;
  if (indicators.trend === "up") score += 2;
  if (indicators.trend === "down") score -= 2;
  if (indicators.rsi < 35) score += 1;
  if (indicators.rsi > 70) score -= 1;
  if (indicators.momentum > 2) score += 1;
  if (indicators.momentum < -2) score -= 1;
  if (sentiment.label === "positive") score += 1;
  if (sentiment.label === "negative") score -= 1;
  if (ctx.price > indicators.resistance * 0.995) score += 0; // near resistance, neutral
  if (ctx.price < indicators.support * 1.005) score -= 0;

  let action: TradingAction;
  if (ctx.change24h <= -7) action = "STOP_LOSS";
  else if (ctx.change24h >= 12 && indicators.rsi > 70) action = "TAKE_PROFIT";
  else if (risk.conflictingSignals) action = "HOLD";
  else if (score >= 3) action = "BUY";
  else if (score <= -3) action = "SELL";
  else action = "HOLD";

  // Confidence
  let confidence = Math.min(100, Math.max(10, 50 + score * 8 - (risk.highVolatility ? 8 : 0) - (risk.conflictingSignals ? 10 : 0)));
  if (action === "HOLD") confidence = Math.min(confidence, 55);
  if (rl === "HIGH" && action === "BUY" && confidence < 86) {
    action = "HOLD";
    warning.push("تم تحويل القرار إلى انتظار بسبب ارتفاع المخاطر مع ثقة غير كافية");
    confidence = Math.min(confidence, 55);
  }

  // Stop / Target / Position size
  const stopPct = rl === "HIGH" ? 0.06 : rl === "MEDIUM" ? 0.04 : 0.025;
  const tpPct = rl === "HIGH" ? 0.12 : rl === "MEDIUM" ? 0.08 : 0.05;
  const suggestedStopLoss = Number((ctx.price * (1 - stopPct)).toFixed(4));
  const suggestedTakeProfit = Number((ctx.price * (1 + tpPct)).toFixed(4));
  const suggestedPositionSize = rl === "HIGH" ? 2 : rl === "MEDIUM" ? 5 : 8; // % of capital

  const timeHorizon: TradingDecision["timeHorizon"] =
    indicators.trend === "side" ? "short" : rl === "LOW" ? "long" : "medium";

  const reasonMap: Record<TradingAction, string> = {
    BUY: "إشارات فنية ومعنويات داعمة مع مخاطر مقبولة.",
    SELL: "زخم سلبي ومعنويات ضعيفة وكسر مستويات مهمة.",
    HOLD: "الإشارات متضاربة، ينصح بالانتظار حتى وضوح الاتجاه.",
    STOP_LOSS: "هبوط حاد تجاوز حد الخسارة المحدد.",
    TAKE_PROFIT: "وصول السعر لمنطقة ربح مع تشبع شرائي.",
  };

  return {
    asset: ctx.symbol,
    category: ctx.category,
    action,
    confidence: Math.round(confidence),
    riskLevel: rl,
    reasonSummary: reasonMap[action],
    supportingFactors: supporting,
    warningFactors: warning,
    suggestedStopLoss,
    suggestedTakeProfit,
    suggestedPositionSize,
    timeHorizon,
    mode: "analysis_only",
    indicators,
    sentiment,
    macro,
    risk,
    generatedAt: Date.now(),
    disclaimer: DISCLAIMER,
  };
}

export function batchDecisions(items: AssetContext[]): TradingDecision[] {
  return items.map(generateTradingDecision);
}

// ============= Scenario builders for QA =============
export type ScenarioId = "sharp_drop" | "strong_rally" | "high_volatility" | "conflicting" | "stop_loss_break";

export type Scenario = {
  id: ScenarioId;
  name_ar: string;
  name_en: string;
  description_ar: string;
  context: AssetContext;
};

function makeHistory(start: number, end: number, pattern: "linear" | "volatile" | "spike" = "linear"): number[] {
  const n = 60;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let v = start + (end - start) * t;
    if (pattern === "volatile") v += Math.sin(i * 0.9) * (end * 0.05) + Math.cos(i * 1.7) * (end * 0.04);
    if (pattern === "spike") v += i > n - 5 ? (end - start) * 0.3 : 0;
    out.push(Math.max(0.01, v));
  }
  return out;
}

export const QA_SCENARIOS: Scenario[] = [
  {
    id: "sharp_drop",
    name_ar: "هبوط حاد",
    name_en: "Sharp drop",
    description_ar: "السعر هبط -8% خلال 24س بعد اتجاه صاعد سابق.",
    context: {
      symbol: "TEST-DROP", name_ar: "اختبار هبوط", category: "us",
      price: 92, change24h: -8, history: makeHistory(100, 92, "linear"), currency: "USD",
    },
  },
  {
    id: "strong_rally",
    name_ar: "صعود قوي",
    name_en: "Strong rally",
    description_ar: "صعود متواصل +6% مع زخم إيجابي.",
    context: {
      symbol: "TEST-RALLY", name_ar: "اختبار صعود", category: "crypto",
      price: 106, change24h: 6, history: makeHistory(95, 106, "linear"), currency: "USD",
    },
  },
  {
    id: "high_volatility",
    name_ar: "تذبذب عالي",
    name_en: "High volatility",
    description_ar: "تذبذب حاد بدون اتجاه واضح.",
    context: {
      symbol: "TEST-VOL", name_ar: "اختبار تذبذب", category: "crypto",
      price: 100, change24h: 0.4, history: makeHistory(98, 100, "volatile"), currency: "USD",
    },
  },
  {
    id: "conflicting",
    name_ar: "إشارات متضاربة",
    name_en: "Conflicting signals",
    description_ar: "اتجاه صاعد لكن RSI متضخم في منطقة تشبع شراء.",
    context: {
      symbol: "TEST-CONF", name_ar: "اختبار تضارب", category: "us",
      price: 110, change24h: 1.2, history: makeHistory(85, 110, "spike"), currency: "USD",
    },
  },
  {
    id: "stop_loss_break",
    name_ar: "كسر وقف الخسارة",
    name_en: "Stop-loss break",
    description_ar: "السعر تجاوز عتبة الخسارة المحددة (-9%).",
    context: {
      symbol: "TEST-SL", name_ar: "اختبار وقف", category: "saudi",
      price: 91, change24h: -9, history: makeHistory(100, 91, "linear"), currency: "SAR",
    },
  },
];
