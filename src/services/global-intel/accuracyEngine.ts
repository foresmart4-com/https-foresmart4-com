// Accuracy, drift and hallucination tracking using persistent ring buffers.
import type { AccuracyMetrics, ConsensusDecision } from "./types";

const KEY = "global_intel_accuracy_v1";
const MAX = 500;

interface Record {
  ts: number;
  symbol: string;
  predicted: number;   // -1..1 score
  realized?: number;   // if scored later
  conf: number;
  surprised?: boolean; // flagged hallucination
}

function load(): Record[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(rs: Record[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rs.slice(-MAX))); } catch { /* quota */ }
}

export function recordPredictions(decisions: ConsensusDecision[]) {
  const rs = load();
  for (const d of decisions) rs.push({ ts: Date.now(), symbol: d.symbol, predicted: d.score, conf: d.confidence });
  save(rs);
}

export function scoreOutcome(symbol: string, realized: number) {
  const rs = load();
  const recent = [...rs].reverse().find((r) => r.symbol === symbol && r.realized === undefined);
  if (!recent) return;
  recent.realized = realized;
  recent.surprised = Math.sign(realized) !== Math.sign(recent.predicted) && recent.conf > 0.7;
  save(rs);
}

export function metrics(): AccuracyMetrics {
  const rs = load().filter((r) => r.realized !== undefined);
  if (!rs.length) {
    return { hitRate: 0.5, brier: 0.25, drift: 0, hallucinationRate: 0, sampleSize: 0 };
  }
  const hits = rs.filter((r) => Math.sign(r.realized!) === Math.sign(r.predicted)).length;
  const brier = rs.reduce((a, r) => a + Math.pow((r.predicted > 0 ? 1 : 0) - (r.realized! > 0 ? 1 : 0), 2), 0) / rs.length;
  const halu = rs.filter((r) => r.surprised).length / rs.length;
  const half = Math.floor(rs.length / 2);
  const a = rs.slice(0, half), b = rs.slice(half);
  const meanA = a.reduce((s, r) => s + r.predicted, 0) / (a.length || 1);
  const meanB = b.reduce((s, r) => s + r.predicted, 0) / (b.length || 1);
  const drift = Math.min(1, Math.abs(meanA - meanB));
  return {
    hitRate: +(hits / rs.length).toFixed(3),
    brier: +brier.toFixed(3),
    drift: +drift.toFixed(3),
    hallucinationRate: +halu.toFixed(3),
    sampleSize: rs.length,
  };
}

// Backtest replay against a sequence of historical scores (for benchmarking calibration).
export function replay(history: Array<{ predicted: number; realized: number; conf: number }>): AccuracyMetrics {
  if (!history.length) return { hitRate: 0, brier: 0, drift: 0, hallucinationRate: 0, sampleSize: 0 };
  const hits = history.filter((r) => Math.sign(r.realized) === Math.sign(r.predicted)).length;
  const brier = history.reduce((a, r) => a + Math.pow((r.predicted > 0 ? 1 : 0) - (r.realized > 0 ? 1 : 0), 2), 0) / history.length;
  const halu = history.filter((r) => Math.sign(r.realized) !== Math.sign(r.predicted) && r.conf > 0.7).length / history.length;
  return {
    hitRate: +(hits / history.length).toFixed(3),
    brier: +brier.toFixed(3),
    drift: 0,
    hallucinationRate: +halu.toFixed(3),
    sampleSize: history.length,
  };
}
