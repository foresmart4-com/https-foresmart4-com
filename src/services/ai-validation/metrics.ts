// Aggregate analytics: accuracy, precision/recall, calibration, drift,
// false-positives, Sharpe, PnL, aging, regime & agent splits, hallucination.
import type { CombinedRecord } from "./types";

export interface AccuracyScorecard {
  total: number;
  resolved: number;
  pending: number;
  hitRate: number;          // 0..100
  precisionBuy: number;
  precisionSell: number;
  recallUp: number;
  recallDown: number;
  f1: number;
  brier: number;            // 0..1 lower better
  edge: number;             // hitRate - 50
  avgConfidenceWhenRight: number;
  avgConfidenceWhenWrong: number;
  highConfHitRate: number;  // conf >= 75
  lowConfHitRate: number;   // conf < 50
}

export interface CalibrationBucket {
  range: string; lower: number; upper: number;
  count: number; correct: number; accuracy: number;
}

export interface CalibrationReport {
  buckets: CalibrationBucket[];
  ece: number;          // expected calibration error
  overconfidence: number;
  reliability: "excellent" | "good" | "fair" | "poor";
}

export interface DriftReport {
  recentHitRate: number;
  baselineHitRate: number;
  delta: number;
  status: "stable" | "warning" | "critical";
}

export interface FalsePositiveReport {
  falsePositives: number;       // predicted up but actual down
  falseNegatives: number;       // predicted down but actual up
  fpRate: number;               // 0..100
  fnRate: number;
  topOffendingAgents: Array<{ agent: string; fp: number; fn: number }>;
}

export interface PerformanceReport {
  cumulativePnl: number;     // % sum
  avgReturnPerTrade: number;
  winLossRatio: number;
  sharpe: number;            // annualized-ish, assuming daily-ish samples
  sortino: number;
  maxDrawdown: number;       // % equity drawdown
  benchmarkPnl: number;      // buy-and-hold equivalent
  excessReturn: number;
}

export interface AgingBucket { range: string; count: number; hitRate: number; avgReturn: number; }
export interface RegimeBucket { regime: string; count: number; hitRate: number; avgReturn: number; }
export interface AgentBucket { agent: string; count: number; hitRate: number; sharpe: number; brier: number; }

export interface HallucinationReport {
  flagged: number;
  rate: number;            // 0..1
  notes: string[];
}

const RESOLVED = (r: CombinedRecord) => !!r.outcome;

// ---------- Core accuracy ----------
export function buildScorecard(records: CombinedRecord[]): AccuracyScorecard {
  const resolved = records.filter(RESOLVED);
  const total = records.length;
  const pending = total - resolved.length;
  const actionable = resolved.filter((r) => r.predictedDirection !== "flat");

  const hits = actionable.filter((r) => r.outcome!.correct).length;
  const hitRate = actionable.length ? (hits / actionable.length) * 100 : 0;

  const buy = actionable.filter((r) => r.action === "buy");
  const sell = actionable.filter((r) => r.action === "sell");
  const precisionBuy = buy.length ? (buy.filter((r) => r.outcome!.correct).length / buy.length) * 100 : 0;
  const precisionSell = sell.length ? (sell.filter((r) => r.outcome!.correct).length / sell.length) * 100 : 0;

  const ups = actionable.filter((r) => r.outcome!.actualDirection === "up");
  const downs = actionable.filter((r) => r.outcome!.actualDirection === "down");
  const recallUp = ups.length ? (ups.filter((r) => r.action === "buy").length / ups.length) * 100 : 0;
  const recallDown = downs.length ? (downs.filter((r) => r.action === "sell").length / downs.length) * 100 : 0;

  const precAvg = (precisionBuy + precisionSell) / 2;
  const recAvg = (recallUp + recallDown) / 2;
  const f1 = precAvg + recAvg > 0 ? (2 * precAvg * recAvg) / (precAvg + recAvg) : 0;

  let brierSum = 0;
  for (const r of actionable) {
    const p = r.confidence / 100;
    const y = r.outcome!.correct ? 1 : 0;
    brierSum += (p - y) ** 2;
  }
  const brier = actionable.length ? brierSum / actionable.length : 0;

  const right = actionable.filter((r) => r.outcome!.correct);
  const wrong = actionable.filter((r) => !r.outcome!.correct);
  const avgR = right.length ? right.reduce((s, r) => s + r.confidence, 0) / right.length : 0;
  const avgW = wrong.length ? wrong.reduce((s, r) => s + r.confidence, 0) / wrong.length : 0;
  const hi = actionable.filter((r) => r.confidence >= 75);
  const lo = actionable.filter((r) => r.confidence < 50);
  const hiHit = hi.length ? (hi.filter((r) => r.outcome!.correct).length / hi.length) * 100 : 0;
  const loHit = lo.length ? (lo.filter((r) => r.outcome!.correct).length / lo.length) * 100 : 0;

  return {
    total, resolved: resolved.length, pending,
    hitRate: +hitRate.toFixed(2),
    precisionBuy: +precisionBuy.toFixed(2),
    precisionSell: +precisionSell.toFixed(2),
    recallUp: +recallUp.toFixed(2),
    recallDown: +recallDown.toFixed(2),
    f1: +f1.toFixed(2),
    brier: +brier.toFixed(4),
    edge: +(hitRate - 50).toFixed(2),
    avgConfidenceWhenRight: +avgR.toFixed(1),
    avgConfidenceWhenWrong: +avgW.toFixed(1),
    highConfHitRate: +hiHit.toFixed(2),
    lowConfHitRate: +loHit.toFixed(2),
  };
}

// ---------- Calibration ----------
const BUCKETS = [[0,30],[30,50],[50,65],[65,80],[80,90],[90,101]] as const;

export function buildCalibration(records: CombinedRecord[]): CalibrationReport {
  const considered = records.filter(RESOLVED).filter((r) => r.predictedDirection !== "flat");
  const buckets: CalibrationBucket[] = BUCKETS.map(([lo, hi]) => ({
    range: `${lo}-${hi >= 101 ? 100 : hi}`, lower: lo, upper: hi, count: 0, correct: 0, accuracy: 0,
  }));
  for (const r of considered) {
    const b = buckets.find((b) => r.confidence >= b.lower && r.confidence < b.upper) ?? buckets.at(-1)!;
    b.count++; if (r.outcome!.correct) b.correct++;
  }
  for (const b of buckets) b.accuracy = b.count ? +((b.correct / b.count) * 100).toFixed(1) : 0;
  const n = considered.length || 1;
  const ece = buckets.reduce((s, b) => {
    if (!b.count) return s;
    const meanConf = (b.lower + Math.min(100, b.upper)) / 2 / 100;
    const meanAcc = b.correct / b.count;
    return s + (b.count / n) * Math.abs(meanConf - meanAcc);
  }, 0);
  const avgConf = considered.reduce((s, r) => s + r.confidence, 0) / n;
  const avgAcc = (considered.filter((r) => r.outcome!.correct).length / n) * 100;
  const over = +(avgConf - avgAcc).toFixed(2);
  const reliability: CalibrationReport["reliability"] =
    ece < 0.05 ? "excellent" : ece < 0.1 ? "good" : ece < 0.2 ? "fair" : "poor";
  return { buckets, ece: +ece.toFixed(4), overconfidence: over, reliability };
}

// ---------- Drift detection ----------
export function detectDrift(records: CombinedRecord[]): DriftReport {
  const resolved = records.filter(RESOLVED).filter((r) => r.predictedDirection !== "flat");
  if (resolved.length < 20) {
    return { recentHitRate: 0, baselineHitRate: 0, delta: 0, status: "stable" };
  }
  const sorted = [...resolved].sort((a, b) => a.ts - b.ts);
  const half = Math.floor(sorted.length * 0.7);
  const baseline = sorted.slice(0, half);
  const recent = sorted.slice(half);
  const hit = (rs: CombinedRecord[]) => (rs.filter((r) => r.outcome!.correct).length / rs.length) * 100;
  const b = hit(baseline);
  const rc = hit(recent);
  const delta = +(rc - b).toFixed(2);
  const status: DriftReport["status"] =
    Math.abs(delta) < 5 ? "stable" : Math.abs(delta) < 12 ? "warning" : "critical";
  return { recentHitRate: +rc.toFixed(2), baselineHitRate: +b.toFixed(2), delta, status };
}

// ---------- False positive / negative ----------
export function falsePositiveAnalysis(records: CombinedRecord[]): FalsePositiveReport {
  const resolved = records.filter(RESOLVED).filter((r) => r.predictedDirection !== "flat");
  let fp = 0, fn = 0;
  const byAgent = new Map<string, { fp: number; fn: number }>();
  for (const r of resolved) {
    const isFP = r.predictedDirection === "up" && r.outcome!.actualDirection === "down";
    const isFN = r.predictedDirection === "down" && r.outcome!.actualDirection === "up";
    if (isFP) fp++; if (isFN) fn++;
    if (!byAgent.has(r.agent)) byAgent.set(r.agent, { fp: 0, fn: 0 });
    const a = byAgent.get(r.agent)!;
    if (isFP) a.fp++; if (isFN) a.fn++;
  }
  const n = resolved.length || 1;
  return {
    falsePositives: fp, falseNegatives: fn,
    fpRate: +((fp / n) * 100).toFixed(2),
    fnRate: +((fn / n) * 100).toFixed(2),
    topOffendingAgents: [...byAgent.entries()]
      .map(([agent, v]) => ({ agent, fp: v.fp, fn: v.fn }))
      .sort((a, b) => (b.fp + b.fn) - (a.fp + a.fn))
      .slice(0, 6),
  };
}

// ---------- Performance / PnL / Sharpe ----------
function signedReturn(r: CombinedRecord): number {
  if (!r.outcome) return 0;
  if (r.action === "buy") return r.outcome.realizedReturnPct;
  if (r.action === "sell") return -r.outcome.realizedReturnPct;
  return 0;
}

function stdev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1));
}

export function buildPerformance(records: CombinedRecord[]): PerformanceReport {
  const resolved = records.filter(RESOLVED).filter((r) => r.action !== "hold");
  if (!resolved.length) {
    return { cumulativePnl: 0, avgReturnPerTrade: 0, winLossRatio: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, benchmarkPnl: 0, excessReturn: 0 };
  }
  const returns = resolved.map(signedReturn);
  const cumulativePnl = +returns.reduce((s, v) => s + v, 0).toFixed(2);
  const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
  const wins = returns.filter((v) => v > 0).length;
  const losses = returns.filter((v) => v < 0).length;
  const winLossRatio = losses ? +(wins / losses).toFixed(2) : wins;

  const sd = stdev(returns, avg);
  const downSd = stdev(returns.filter((v) => v < 0), 0);
  const sharpe = sd ? (avg / sd) * Math.sqrt(252) : 0;
  const sortino = downSd ? (avg / downSd) * Math.sqrt(252) : 0;

  // Equity curve / drawdown
  let peak = 0, equity = 0, maxDD = 0;
  for (const r of returns) {
    equity += r;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  // Benchmark: buy & hold (long-only realized returns regardless of action)
  const benchmark = resolved.reduce((s, r) => s + (r.outcome?.realizedReturnPct ?? 0), 0);
  return {
    cumulativePnl,
    avgReturnPerTrade: +avg.toFixed(3),
    winLossRatio,
    sharpe: +sharpe.toFixed(2),
    sortino: +sortino.toFixed(2),
    maxDrawdown: +maxDD.toFixed(2),
    benchmarkPnl: +benchmark.toFixed(2),
    excessReturn: +(cumulativePnl - benchmark).toFixed(2),
  };
}

// ---------- Aging ----------
const AGE_BUCKETS = [[0,4],[4,12],[12,24],[24,72],[72,168],[168,99999]] as const;
export function agingAnalytics(records: CombinedRecord[]): AgingBucket[] {
  const resolved = records.filter(RESOLVED);
  return AGE_BUCKETS.map(([lo, hi]) => {
    const slice = resolved.filter((r) => r.outcome!.ageHrs >= lo && r.outcome!.ageHrs < hi);
    const hits = slice.filter((r) => r.outcome!.correct).length;
    const avg = slice.length ? slice.reduce((s, r) => s + signedReturn(r), 0) / slice.length : 0;
    return {
      range: hi >= 99999 ? `${lo}h+` : `${lo}-${hi}h`,
      count: slice.length,
      hitRate: slice.length ? +((hits / slice.length) * 100).toFixed(2) : 0,
      avgReturn: +avg.toFixed(2),
    };
  });
}

// ---------- Regime split ----------
export function regimeAnalytics(records: CombinedRecord[]): RegimeBucket[] {
  const resolved = records.filter(RESOLVED).filter((r) => r.regime);
  const groups = new Map<string, CombinedRecord[]>();
  for (const r of resolved) {
    const k = r.regime!;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  return [...groups.entries()].map(([regime, arr]) => {
    const hits = arr.filter((r) => r.outcome!.correct).length;
    const avg = arr.reduce((s, r) => s + signedReturn(r), 0) / arr.length;
    return {
      regime,
      count: arr.length,
      hitRate: +((hits / arr.length) * 100).toFixed(2),
      avgReturn: +avg.toFixed(2),
    };
  }).sort((a, b) => b.count - a.count);
}

// ---------- Agent split ----------
export function agentAnalytics(records: CombinedRecord[]): AgentBucket[] {
  const resolved = records.filter(RESOLVED);
  const groups = new Map<string, CombinedRecord[]>();
  for (const r of resolved) {
    if (!groups.has(r.agent)) groups.set(r.agent, []);
    groups.get(r.agent)!.push(r);
  }
  return [...groups.entries()].map(([agent, arr]) => {
    const actionable = arr.filter((r) => r.predictedDirection !== "flat");
    const hits = actionable.filter((r) => r.outcome!.correct).length;
    const rets = arr.filter((r) => r.action !== "hold").map(signedReturn);
    const m = rets.length ? rets.reduce((s, v) => s + v, 0) / rets.length : 0;
    const sd = stdev(rets, m);
    const sharpe = sd ? +(m / sd).toFixed(2) : 0;
    const brier = actionable.length
      ? actionable.reduce((s, r) => s + ((r.confidence / 100) - (r.outcome!.correct ? 1 : 0)) ** 2, 0) / actionable.length
      : 0;
    return {
      agent,
      count: arr.length,
      hitRate: actionable.length ? +((hits / actionable.length) * 100).toFixed(2) : 0,
      sharpe,
      brier: +brier.toFixed(4),
    };
  }).sort((a, b) => b.hitRate - a.hitRate);
}

// ---------- Hallucination ----------
export function hallucinationAnalytics(records: CombinedRecord[]): HallucinationReport {
  const resolved = records.filter(RESOLVED).filter((r) => r.predictedDirection !== "flat");
  const flagged = resolved.filter((r) =>
    r.confidence >= 80 && !r.outcome!.correct && Math.abs(r.outcome!.realizedReturnPct) >= 1
  );
  const notes: string[] = [];
  const byAgent = new Map<string, number>();
  for (const r of flagged) byAgent.set(r.agent, (byAgent.get(r.agent) ?? 0) + 1);
  for (const [agent, n] of byAgent) {
    if (n >= 2) notes.push(`${agent}: ${n} high-confidence wrong signals — suppress agent until calibrated`);
  }
  return {
    flagged: flagged.length,
    rate: resolved.length ? +(flagged.length / resolved.length).toFixed(3) : 0,
    notes,
  };
}

// ---------- Low-confidence suppression ----------
export function suppressLowConfidence<T extends { confidence: number }>(items: T[], threshold = 55): T[] {
  return items.filter((i) => i.confidence >= threshold);
}
