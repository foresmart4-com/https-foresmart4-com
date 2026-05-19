// Dynamic AI Brain — unifies live trend, confidence, anomaly, personalization,
// explainability, memory, and economic impact into one client-safe engine.
// Pure functions over scanned assets; deterministic when given the same inputs.

import { scanMarket, type ScannedAsset } from "./marketScanner";
import { aiMemory, type TradeMemoryEntry } from "@/services/learning/aiMemory";

export type Bias = "long" | "short" | "neutral";

export interface TrendReading {
  symbol: string;
  bias: Bias;
  strength: number;          // 0-100
  volatility: number;        // %
  momentum: number;          // -100..100
  changedAt: number;
}

export interface ConfidenceScore {
  symbol: string;
  score: number;             // 0-100
  components: { trend: number; momentum: number; volume: number; sentiment: number; memory: number };
  rationale: string[];
}

export interface AnomalyEvent {
  symbol: string;
  kind: "volume_spike" | "volatility_burst" | "trend_break" | "sentiment_shock";
  severity: "info" | "warn" | "critical";
  detail: string;
  ts: number;
}

export interface PortfolioRiskReading {
  exposure: number;          // 0-100
  diversification: number;   // 0-100
  drawdownRisk: number;      // 0-100
  netBias: Bias;
  warnings: string[];
}

export interface UserPersona {
  riskTolerance: "low" | "medium" | "high";
  horizon: "intraday" | "swing" | "long";
  preferredClasses: string[];
}

export interface PersonalizedRec {
  symbol: string;
  action: "watch" | "accumulate" | "trim" | "avoid";
  confidence: number;
  reason: string;
}

export interface MarketSummary {
  generatedAt: number;
  headline: string;
  bullets: string[];
  regime: "risk_on" | "risk_off" | "mixed" | "volatile";
}

export interface EconomicImpact {
  event: string;
  impact: "low" | "medium" | "high";
  affected: string[];
  note: string;
}

// ---------- Trend ----------
export function readTrend(a: ScannedAsset): TrendReading {
  const bias: Bias = a.trend === "bullish" ? "long" : a.trend === "bearish" ? "short" : "neutral";
  const strength = Math.min(100, Math.abs(a.momentum) * 0.6 + a.confidence * 0.4);
  return {
    symbol: a.symbol, bias, strength: Math.round(strength),
    volatility: a.volatility, momentum: a.momentum, changedAt: Date.now(),
  };
}

// ---------- Confidence ----------
export function scoreConfidence(a: ScannedAsset, memory: TradeMemoryEntry[] = []): ConfidenceScore {
  const trend = Math.min(100, Math.abs(a.momentum) * 0.8 + 20);
  const momentum = Math.min(100, Math.abs(a.macd.hist) * 800 + 30);
  const volume = Math.min(100, a.volumeSpike * 50);
  const sentiment = Math.min(100, (a.sentiment + 100) / 2);
  const symMem = memory.filter((m) => m.symbol === a.symbol);
  const wins = symMem.filter((m) => m.outcome === "win").length;
  const mem = symMem.length ? Math.round((wins / symMem.length) * 100) : 50;
  const score = Math.round(trend * 0.3 + momentum * 0.25 + volume * 0.15 + sentiment * 0.15 + mem * 0.15);
  const rationale: string[] = [];
  if (trend > 70) rationale.push(`Strong ${a.trend} momentum (${a.momentum.toFixed(0)})`);
  if (volume > 75) rationale.push(`Volume spike ${a.volumeSpike.toFixed(1)}x avg`);
  if (sentiment > 70) rationale.push(`Positive sentiment ${a.sentiment.toFixed(0)}`);
  else if (sentiment < 30) rationale.push(`Bearish sentiment ${a.sentiment.toFixed(0)}`);
  if (symMem.length >= 3) rationale.push(`Historical win-rate ${mem}% on ${symMem.length} trades`);
  return { symbol: a.symbol, score, components: { trend, momentum, volume, sentiment, memory: mem }, rationale };
}

// ---------- Anomaly ----------
export function detectAnomalies(assets: ScannedAsset[]): AnomalyEvent[] {
  const out: AnomalyEvent[] = [];
  const ts = Date.now();
  for (const a of assets) {
    if (a.volumeSpike > 2) out.push({ symbol: a.symbol, kind: "volume_spike",
      severity: a.volumeSpike > 3 ? "critical" : "warn",
      detail: `Volume ${a.volumeSpike.toFixed(1)}x average`, ts });
    if (a.volatility > 60) out.push({ symbol: a.symbol, kind: "volatility_burst",
      severity: a.volatility > 90 ? "critical" : "warn",
      detail: `Volatility ${a.volatility.toFixed(0)}% annualized`, ts });
    if (Math.abs(a.changePct) > 8) out.push({ symbol: a.symbol, kind: "trend_break",
      severity: "warn", detail: `Price moved ${a.changePct.toFixed(1)}% in session`, ts });
    if (Math.abs(a.sentiment) > 80) out.push({ symbol: a.symbol, kind: "sentiment_shock",
      severity: "info", detail: `Extreme sentiment ${a.sentiment.toFixed(0)}`, ts });
  }
  return out;
}

// ---------- Portfolio Risk ----------
export function analyzePortfolioRisk(
  positions: { symbol: string; notional: number; klass?: string }[],
  assets: ScannedAsset[],
): PortfolioRiskReading {
  const total = positions.reduce((s, p) => s + Math.abs(p.notional), 0) || 1;
  const exposure = Math.min(100, total / 10000);
  const classes = new Set(positions.map((p) => p.klass ?? "x"));
  const diversification = Math.min(100, classes.size * 22);
  let drawdownRisk = 0, netLong = 0, netShort = 0;
  for (const p of positions) {
    const a = assets.find((x) => x.symbol === p.symbol);
    if (!a) continue;
    drawdownRisk += (a.volatility / 100) * (Math.abs(p.notional) / total) * 100;
    if (p.notional > 0) netLong += p.notional; else netShort += Math.abs(p.notional);
  }
  const netBias: Bias = netLong > netShort * 1.2 ? "long" : netShort > netLong * 1.2 ? "short" : "neutral";
  const warnings: string[] = [];
  if (diversification < 40) warnings.push("Low diversification — concentrated in few asset classes");
  if (drawdownRisk > 50) warnings.push("High drawdown risk from volatile holdings");
  if (exposure > 80) warnings.push("Exposure near maximum — consider trimming");
  return { exposure: Math.round(exposure), diversification, drawdownRisk: Math.round(drawdownRisk), netBias, warnings };
}

// ---------- Personalization ----------
export function personalize(persona: UserPersona, assets: ScannedAsset[]): PersonalizedRec[] {
  const out: PersonalizedRec[] = [];
  for (const a of assets) {
    if (persona.preferredClasses.length && !persona.preferredClasses.includes(a.klass)) continue;
    const volOk = persona.riskTolerance === "high" ? true
      : persona.riskTolerance === "medium" ? a.volatility < 70 : a.volatility < 35;
    if (!volOk) { out.push({ symbol: a.symbol, action: "avoid", confidence: 60,
      reason: `Volatility ${a.volatility.toFixed(0)}% exceeds your ${persona.riskTolerance} tolerance` }); continue; }
    if (a.trend === "bullish" && a.confidence > 65)
      out.push({ symbol: a.symbol, action: "accumulate", confidence: a.confidence,
        reason: `Bullish trend with confidence ${a.confidence}` });
    else if (a.trend === "bearish" && persona.horizon !== "long")
      out.push({ symbol: a.symbol, action: "trim", confidence: a.confidence,
        reason: `Bearish near-term — reduce exposure` });
    else out.push({ symbol: a.symbol, action: "watch", confidence: 50, reason: "Neutral conditions" });
  }
  return out.sort((x, y) => y.confidence - x.confidence).slice(0, 8);
}

// ---------- Market Summary ----------
export function summarizeMarket(assets: ScannedAsset[]): MarketSummary {
  const bull = assets.filter((a) => a.trend === "bullish").length;
  const bear = assets.filter((a) => a.trend === "bearish").length;
  const vol = assets.reduce((s, a) => s + a.volatility, 0) / (assets.length || 1);
  let regime: MarketSummary["regime"] = "mixed";
  if (vol > 60) regime = "volatile";
  else if (bull > bear * 1.5) regime = "risk_on";
  else if (bear > bull * 1.5) regime = "risk_off";
  const top = [...assets].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 3);
  return {
    generatedAt: Date.now(),
    headline:
      regime === "risk_on" ? "Risk-on tone: breadth favors buyers"
      : regime === "risk_off" ? "Risk-off pressure: defensive posture warranted"
      : regime === "volatile" ? "Elevated volatility — reduce sizing"
      : "Mixed tape — selectivity required",
    bullets: [
      `${bull} bullish vs ${bear} bearish across ${assets.length} tracked assets`,
      `Average volatility ${vol.toFixed(0)}%`,
      ...top.map((t) => `${t.symbol} ${t.changePct >= 0 ? "+" : ""}${t.changePct.toFixed(2)}% (${t.trend})`),
    ],
    regime,
  };
}

// ---------- Economic / News impact ----------
const ECON_EVENTS: { event: string; impact: EconomicImpact["impact"]; affected: string[]; note: string }[] = [
  { event: "FOMC Decision", impact: "high", affected: ["DXY", "SPX", "XAU", "BTC"], note: "Rate decisions drive cross-asset volatility" },
  { event: "CPI Release", impact: "high", affected: ["DXY", "XAU", "SPX"], note: "Inflation print shapes rate-cut odds" },
  { event: "NFP", impact: "medium", affected: ["DXY", "SPX"], note: "Labor data steers Fed stance" },
  { event: "OPEC Meeting", impact: "medium", affected: ["WTI", "BRENT"], note: "Supply policy shifts crude" },
];
export function economicImpact(): EconomicImpact[] { return ECON_EVENTS; }

// ---------- Aggregator ----------
export interface BrainSnapshot {
  generatedAt: number;
  summary: MarketSummary;
  trends: TrendReading[];
  confidence: ConfidenceScore[];
  anomalies: AnomalyEvent[];
  economic: EconomicImpact[];
}

export function generateBrainSnapshot(): BrainSnapshot {
  const assets = scanMarket();
  const memory = aiMemory.list();
  return {
    generatedAt: Date.now(),
    summary: summarizeMarket(assets),
    trends: assets.map(readTrend),
    confidence: assets.map((a) => scoreConfidence(a, memory)).sort((a, b) => b.score - a.score),
    anomalies: detectAnomalies(assets),
    economic: economicImpact(),
  };
}
