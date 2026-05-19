/**
 * Market Intelligence Engine — deterministic, server-safe.
 *
 * Pure functions only. All data fetching happens in `market-intelligence.functions.ts`
 * which then passes the raw frames here for scoring.
 *
 * Outputs a unified `IntelligenceReport` consumed by the /market-intelligence UI.
 */

export type Timeframe = "5min" | "15min" | "1h" | "1day";

export interface Bar { datetime: string; open: number; high: number; low: number; close: number; volume?: number }

export interface TimeframeStat {
  timeframe: Timeframe;
  bars: number;
  changePct: number;       // last close vs first close in window
  trend: "up" | "down" | "flat";
  trendStrength: number;   // 0..100
  volatilityPct: number;   // stdev of returns × √N, %
  high: number;
  low: number;
  last: number;
}

export interface SentimentBreakdown {
  score: number;          // -100..100
  label: "very_bearish" | "bearish" | "neutral" | "bullish" | "very_bullish";
  bullishHits: number;
  bearishHits: number;
  total: number;
  topHeadlines: Array<{ headline: string; source: string; polarity: number; url?: string }>;
}

export interface RegimeDetection {
  regime: "trending_up" | "trending_down" | "range_bound" | "high_volatility" | "low_volatility";
  confidence: number;     // 0..100
  reason: string;
}

export interface RiskScore {
  score: number;          // 0..100 (higher = riskier)
  band: "low" | "moderate" | "elevated" | "high";
  drivers: string[];
}

export interface ExplainNode {
  label: string;
  weight: number;         // 0..1
  contribution: number;   // -100..100 signed
  detail: string;
}

export interface SmartAlert {
  kind: "breakout" | "breakdown" | "volatility_spike" | "regime_shift" | "news_shock" | "calendar_window";
  severity: "info" | "warn" | "critical";
  message: string;
}

export interface CalendarImpact {
  upcoming: Array<{ event: string; country: string; impact: "low" | "medium" | "high"; whenISO: string; expectedEffect: string }>;
  riskWindowHours: number;
}

export interface IntelligenceReport {
  symbol: string;
  generatedAt: number;
  price: number;
  changePct: number;
  timeframes: TimeframeStat[];
  trendScore: number;          // -100..100 (combined directional)
  volatilityScore: number;     // 0..100
  sentiment: SentimentBreakdown;
  regime: RegimeDetection;
  risk: RiskScore;
  confidencePct: number;       // 0..100 overall AI confidence
  recommendation: "strong_buy" | "buy" | "hold" | "reduce" | "sell";
  rationale: string;
  rationaleAr: string;
  explain: ExplainNode[];
  smartAlerts: SmartAlert[];
  calendar: CalendarImpact;
}

// ---------- Pure helpers ----------

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function analyseTimeframe(timeframe: Timeframe, bars: Bar[]): TimeframeStat | null {
  if (!bars.length) return null;
  const sorted = [...bars].sort((a, b) => a.datetime.localeCompare(b.datetime));
  const first = sorted[0].close;
  const last = sorted.at(-1)!.close;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1].close, c = sorted[i].close;
    if (p > 0) returns.push((c - p) / p);
  }
  const sd = stdev(returns);
  const volPct = sd * Math.sqrt(sorted.length) * 100;
  const trend: TimeframeStat["trend"] =
    Math.abs(changePct) < 0.3 ? "flat" : changePct > 0 ? "up" : "down";
  const trendStrength = Math.min(100, Math.round(Math.abs(changePct) / Math.max(0.1, volPct) * 50));
  const high = Math.max(...sorted.map((b) => b.high));
  const low = Math.min(...sorted.map((b) => b.low));
  return { timeframe, bars: sorted.length, changePct, trend, trendStrength, volatilityPct: volPct, high, low, last };
}

// Sentiment lexicon — small but effective for finance headlines.
const POS = [
  "beat", "beats", "surge", "soar", "rally", "record", "upgrade", "upgraded",
  "bullish", "growth", "profit", "gain", "rise", "rises", "rose", "boost",
  "approval", "approved", "expand", "expansion", "buyback", "outperform",
  "strong", "exceeded", "exceeds", "raises", "raised",
];
const NEG = [
  "miss", "misses", "plunge", "tumble", "crash", "downgrade", "downgraded",
  "bearish", "loss", "losses", "decline", "declines", "drop", "drops",
  "fall", "falls", "fell", "cut", "cuts", "lawsuit", "fraud", "probe",
  "investigation", "weak", "warning", "warns", "halt", "halted", "delisted",
  "default", "bankruptcy",
];

export function analyseSentiment(items: Array<{ headline: string; source: string; url?: string }>): SentimentBreakdown {
  let bull = 0, bear = 0;
  const scored = items.map((it) => {
    const h = (it.headline || "").toLowerCase();
    let s = 0;
    for (const w of POS) if (h.includes(w)) s += 1;
    for (const w of NEG) if (h.includes(w)) s -= 1;
    if (s > 0) bull += s; else if (s < 0) bear += -s;
    return { ...it, polarity: s };
  });
  const total = items.length;
  const raw = bull - bear;
  const denom = Math.max(1, bull + bear);
  const score = Math.max(-100, Math.min(100, Math.round((raw / denom) * 100)));
  const label: SentimentBreakdown["label"] =
    score >= 60 ? "very_bullish" :
    score >= 20 ? "bullish" :
    score <= -60 ? "very_bearish" :
    score <= -20 ? "bearish" : "neutral";
  const topHeadlines = scored
    .filter((s) => s.polarity !== 0)
    .sort((a, b) => Math.abs(b.polarity) - Math.abs(a.polarity))
    .slice(0, 5);
  return { score, label, bullishHits: bull, bearishHits: bear, total, topHeadlines };
}

export function detectRegime(stats: TimeframeStat[]): RegimeDetection {
  if (!stats.length) return { regime: "range_bound", confidence: 0, reason: "insufficient data" };
  const day = stats.find((s) => s.timeframe === "1day") ?? stats.at(-1)!;
  const intra = stats.find((s) => s.timeframe === "1h") ?? stats[0];
  const avgVol = stats.reduce((a, s) => a + s.volatilityPct, 0) / stats.length;
  if (avgVol > 4) return { regime: "high_volatility", confidence: Math.min(100, Math.round(avgVol * 15)), reason: `avg volatility ${avgVol.toFixed(2)}% across timeframes` };
  if (avgVol < 0.8) return { regime: "low_volatility", confidence: Math.round(60 + (1 - avgVol) * 20), reason: `compressed volatility ${avgVol.toFixed(2)}%` };
  if (day.trend === "up" && intra.trend === "up") return { regime: "trending_up", confidence: Math.min(100, 50 + day.trendStrength / 2), reason: "aligned uptrend on intraday and daily" };
  if (day.trend === "down" && intra.trend === "down") return { regime: "trending_down", confidence: Math.min(100, 50 + day.trendStrength / 2), reason: "aligned downtrend on intraday and daily" };
  return { regime: "range_bound", confidence: 55, reason: "mixed timeframe signals" };
}

export function scoreTrend(stats: TimeframeStat[]): number {
  if (!stats.length) return 0;
  const weights: Record<Timeframe, number> = { "5min": 0.1, "15min": 0.15, "1h": 0.25, "1day": 0.5 };
  let w = 0, sum = 0;
  for (const s of stats) {
    const ww = weights[s.timeframe] ?? 0.1;
    const dir = s.trend === "up" ? 1 : s.trend === "down" ? -1 : 0;
    sum += dir * s.trendStrength * ww;
    w += ww;
  }
  return Math.max(-100, Math.min(100, Math.round(sum / Math.max(0.1, w))));
}

export function scoreVolatility(stats: TimeframeStat[]): number {
  if (!stats.length) return 0;
  const avg = stats.reduce((a, s) => a + s.volatilityPct, 0) / stats.length;
  return Math.min(100, Math.round(avg * 18));
}

export function scoreRisk(input: { volatility: number; sentiment: number; regime: RegimeDetection; calendarHigh: number }): RiskScore {
  const drivers: string[] = [];
  let score = 0;
  score += input.volatility * 0.45;
  if (input.volatility > 60) drivers.push("Elevated multi-timeframe volatility");
  if (input.sentiment < -30) { score += 15; drivers.push("Negative news sentiment"); }
  if (input.regime.regime === "high_volatility") { score += 15; drivers.push("High-volatility regime"); }
  if (input.regime.regime === "trending_down") { score += 10; drivers.push("Downtrending regime"); }
  if (input.calendarHigh > 0) { score += Math.min(20, input.calendarHigh * 7); drivers.push(`${input.calendarHigh} high-impact event(s) ahead`); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: RiskScore["band"] =
    score >= 75 ? "high" : score >= 50 ? "elevated" : score >= 25 ? "moderate" : "low";
  if (!drivers.length) drivers.push("Stable conditions");
  return { score, band, drivers };
}

export function computeConfidence(input: { stats: TimeframeStat[]; sentiment: SentimentBreakdown; regime: RegimeDetection }): number {
  const alignment = (() => {
    const dirs: number[] = input.stats.map((s) => (s.trend === "up" ? 1 : s.trend === "down" ? -1 : 0));
    if (!dirs.length) return 0;
    const sum = Math.abs(dirs.reduce<number>((a, b) => a + b, 0));
    return Math.round((sum / dirs.length) * 100);
  })();
  const sentimentWeight = Math.min(100, input.sentiment.total * 6);
  const regimeWeight = input.regime.confidence;
  const conf = Math.round(alignment * 0.5 + sentimentWeight * 0.2 + regimeWeight * 0.3);
  return Math.max(5, Math.min(98, conf));
}

export function recommend(trendScore: number, sentiment: number, risk: number): IntelligenceReport["recommendation"] {
  const composite = trendScore * 0.6 + sentiment * 0.4 - (risk - 50) * 0.4;
  if (composite >= 55) return "strong_buy";
  if (composite >= 20) return "buy";
  if (composite <= -55) return "sell";
  if (composite <= -20) return "reduce";
  return "hold";
}

export function buildExplain(stats: TimeframeStat[], sentiment: SentimentBreakdown, regime: RegimeDetection, risk: RiskScore): ExplainNode[] {
  const nodes: ExplainNode[] = [];
  for (const s of stats) {
    const dir = s.trend === "up" ? 1 : s.trend === "down" ? -1 : 0;
    nodes.push({
      label: `Trend ${s.timeframe}`,
      weight: { "5min": 0.1, "15min": 0.15, "1h": 0.25, "1day": 0.5 }[s.timeframe],
      contribution: Math.round(dir * s.trendStrength),
      detail: `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% over ${s.bars} bars; vol ${s.volatilityPct.toFixed(2)}%`,
    });
  }
  nodes.push({
    label: "News sentiment",
    weight: 0.2,
    contribution: sentiment.score,
    detail: `${sentiment.bullishHits} bullish vs ${sentiment.bearishHits} bearish across ${sentiment.total} headlines`,
  });
  nodes.push({
    label: "Market regime",
    weight: 0.25,
    contribution: regime.regime === "trending_up" ? 60 : regime.regime === "trending_down" ? -60 : regime.regime === "high_volatility" ? -30 : 0,
    detail: `${regime.regime.replace(/_/g, " ")} (${regime.confidence}% conf): ${regime.reason}`,
  });
  nodes.push({
    label: "Risk overlay",
    weight: 0.3,
    contribution: -risk.score,
    detail: `${risk.band} risk: ${risk.drivers.join("; ")}`,
  });
  return nodes;
}

export function buildSmartAlerts(stats: TimeframeStat[], sentiment: SentimentBreakdown, regime: RegimeDetection, calendar: CalendarImpact): SmartAlert[] {
  const out: SmartAlert[] = [];
  const intra = stats.find((s) => s.timeframe === "1h");
  if (intra && intra.last >= intra.high * 0.999 && intra.trend === "up") {
    out.push({ kind: "breakout", severity: "warn", message: `Price tagging 1h session high (${intra.high.toFixed(2)})` });
  }
  if (intra && intra.last <= intra.low * 1.001 && intra.trend === "down") {
    out.push({ kind: "breakdown", severity: "warn", message: `Price tagging 1h session low (${intra.low.toFixed(2)})` });
  }
  const avgVol = stats.reduce((a, s) => a + s.volatilityPct, 0) / Math.max(1, stats.length);
  if (avgVol > 5) out.push({ kind: "volatility_spike", severity: "critical", message: `Average volatility ${avgVol.toFixed(2)}% — size positions down` });
  if (regime.regime === "trending_up" || regime.regime === "trending_down") {
    out.push({ kind: "regime_shift", severity: "info", message: `Regime: ${regime.regime.replace(/_/g, " ")} (${regime.confidence}%)` });
  }
  if (Math.abs(sentiment.score) >= 60 && sentiment.total >= 5) {
    out.push({ kind: "news_shock", severity: sentiment.score < 0 ? "critical" : "warn", message: `${sentiment.label.replace("_", " ")} headline cluster (${sentiment.bullishHits}↑/${sentiment.bearishHits}↓)` });
  }
  if (calendar.riskWindowHours > 0 && calendar.upcoming.some((e) => e.impact === "high")) {
    out.push({ kind: "calendar_window", severity: "warn", message: `High-impact event within ${calendar.riskWindowHours}h — expect volatility` });
  }
  return out;
}

export function generateRationale(report: Omit<IntelligenceReport, "rationale" | "rationaleAr">): { en: string; ar: string } {
  const dir = report.recommendation;
  const trendWord = report.trendScore > 20 ? "constructive uptrend" : report.trendScore < -20 ? "persistent downtrend" : "range-bound action";
  const sent = report.sentiment.label.replace("_", " ");
  const en = `${report.symbol}: ${dir.toUpperCase().replace("_", " ")} — ${trendWord} across timeframes with ${sent} headline flow. Regime ${report.regime.regime.replace(/_/g, " ")} (${report.regime.confidence}% conf). Risk band ${report.risk.band} (${report.risk.score}/100). AI confidence ${report.confidencePct}%.`;
  const arDir = ({ strong_buy: "شراء قوي", buy: "شراء", hold: "احتفاظ", reduce: "تخفيض", sell: "بيع" } as const)[dir];
  const arRegime = ({ trending_up: "اتجاه صاعد", trending_down: "اتجاه هابط", range_bound: "تداول عرضي", high_volatility: "تذبذب مرتفع", low_volatility: "تذبذب منخفض" } as const)[report.regime.regime];
  const arSent = ({ very_bullish: "إيجابية جداً", bullish: "إيجابية", neutral: "محايدة", bearish: "سلبية", very_bearish: "سلبية جداً" } as const)[report.sentiment.label];
  const ar = `${report.symbol}: ${arDir} — ${arRegime} (ثقة ${report.regime.confidence}%) مع تدفق أخبار ${arSent}. مستوى المخاطرة ${report.risk.score}/100. ثقة الذكاء الاصطناعي ${report.confidencePct}%.`;
  return { en, ar };
}
