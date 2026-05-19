/**
 * Self-Learning Engine
 * ----------------------------------------------------------------
 * Deterministic, browser-side self-learning layer on top of aiMemory.
 *
 * Capabilities:
 *  1. Recommendation outcome tracking
 *  2. Confidence calibration learning (reliability bins)
 *  3. Reinforcement scoring (per strategy / agent)
 *  4. Strategy ranking (leaderboard)
 *  5. Regime-aware adaptation
 *  6. Drift auto-detection (rolling vs lifetime baseline)
 *  7. Agent performance weighting (softmax over reinforcement)
 *  8. Historical replay simulation
 *  9. Continuous learning memory
 * 10. Meta-learning optimization (auto-tune confidence threshold)
 *
 * All math is deterministic and side-effect free except for the
 * localStorage-backed `aiMemory` and a small calibration cache.
 */
import { aiMemory, type TradeMemoryEntry } from "./aiMemory";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────
export type Outcome = "win" | "loss" | "open";

export interface Recommendation {
  id: string;
  ts: number;
  symbol: string;
  side: "buy" | "sell";
  strategy: string;
  agent: string;
  confidence: number; // 0..1
  regime?: string;
  entry: number;
}

export interface AgentScore {
  agent: string;
  trades: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  sharpe: number;
  reinforcement: number; // composite reward
  weight: number;        // softmax-normalized
}

export interface StrategyScore extends Omit<AgentScore, "agent"> {
  strategy: string;
  bestRegime?: string;
  rank: number;
}

export interface CalibrationBin {
  bucket: string;       // "0-10" .. "90-100"
  predicted: number;    // mean predicted prob
  observed: number;     // empirical win-rate
  count: number;
  gap: number;          // observed - predicted
}

export interface DriftReport {
  isDrifting: boolean;
  recentWinRate: number;
  baselineWinRate: number;
  delta: number;
  z: number;
  window: number;
}

export interface ReplayResult {
  trades: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  equity: number[];     // cumulative pnl curve (pct)
  maxDD: number;
}

// ───────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

function stats(rows: TradeMemoryEntry[]) {
  const closed = rows.filter((r) => r.outcome === "win" || r.outcome === "loss");
  const wins = closed.filter((r) => r.outcome === "win");
  const losses = closed.filter((r) => r.outcome === "loss");
  const totalWin = wins.reduce((s, r) => s + (r.pnlPct ?? 0), 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + (r.pnlPct ?? 0), 0));
  const winRate = safeDiv(wins.length, closed.length);
  const avgWin = safeDiv(totalWin, wins.length);
  const avgLoss = safeDiv(totalLoss, losses.length);
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const profitFactor = safeDiv(totalWin, totalLoss || 1);
  const pnls = closed.map((r) => r.pnlPct ?? 0);
  const mean = safeDiv(pnls.reduce((s, x) => s + x, 0), pnls.length);
  const variance = safeDiv(pnls.reduce((s, x) => s + (x - mean) ** 2, 0), pnls.length || 1);
  const sharpe = variance > 0 ? mean / Math.sqrt(variance) : 0;
  return { trades: closed.length, winRate, expectancy, profitFactor, sharpe, avgWin, avgLoss };
}

function softmax(values: number[], temperature = 1): number[] {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / Math.max(temperature, 1e-6)));
  const sum = exps.reduce((s, x) => s + x, 0) || 1;
  return exps.map((e) => e / sum);
}

// ───────────────────────────────────────────────────────────────
// Time-window helpers
// ───────────────────────────────────────────────────────────────
/** Returns memory rows; if `sinceMs` is provided, only rows with ts >= cutoff. */
function listSince(sinceMs?: number): TradeMemoryEntry[] {
  const rows = aiMemory.list();
  if (!sinceMs) return rows;
  const cutoff = Date.now() - sinceMs;
  return rows.filter((r) => r.ts >= cutoff);
}

// ───────────────────────────────────────────────────────────────
// 1. Outcome tracking (delegates to aiMemory)
// ───────────────────────────────────────────────────────────────
export function recordRecommendation(rec: Omit<Recommendation, "id" | "ts">) {
  aiMemory.record({
    symbol: rec.symbol,
    side: rec.side,
    entry: rec.entry,
    regime: rec.regime,
    confidence: rec.confidence,
    tags: [`strategy:${rec.strategy}`, `agent:${rec.agent}`],
    outcome: "open",
  });
}

export function closeRecommendation(id: string, exitPrice: number) {
  aiMemory.closeOpen(id, exitPrice);
}

// ───────────────────────────────────────────────────────────────
// 2. Confidence calibration (10 bins of 10%)
// ───────────────────────────────────────────────────────────────
export function calibration(sinceMs?: number): CalibrationBin[] {
  const rows = listSince(sinceMs).filter((r) => r.outcome !== "open" && typeof r.confidence === "number");
  const bins: CalibrationBin[] = Array.from({ length: 10 }, (_, i) => ({
    bucket: `${i * 10}-${(i + 1) * 10}`,
    predicted: 0,
    observed: 0,
    count: 0,
    gap: 0,
  }));
  for (const r of rows) {
    const c = Math.max(0, Math.min(0.9999, r.confidence ?? 0));
    const idx = Math.floor(c * 10);
    bins[idx].count += 1;
    bins[idx].predicted += c;
    bins[idx].observed += r.outcome === "win" ? 1 : 0;
  }
  for (const b of bins) {
    if (b.count > 0) {
      b.predicted = b.predicted / b.count;
      b.observed = b.observed / b.count;
      b.gap = b.observed - b.predicted;
    }
  }
  return bins;
}

/** Expected Calibration Error (lower is better). */
export function ece(sinceMs?: number): number {
  const bins = calibration(sinceMs);
  const total = bins.reduce((s, b) => s + b.count, 0) || 1;
  return bins.reduce((s, b) => s + (b.count / total) * Math.abs(b.gap), 0);
}

// ───────────────────────────────────────────────────────────────
// 3 + 7. Reinforcement scoring + Agent weighting
// ───────────────────────────────────────────────────────────────
function tagValue(tags: string[] | undefined, prefix: string): string | undefined {
  return tags?.find((t) => t.startsWith(prefix))?.slice(prefix.length);
}

export function agentScores(sinceMs?: number): AgentScore[] {
  const rows = listSince(sinceMs);
  const byAgent = new Map<string, TradeMemoryEntry[]>();
  for (const r of rows) {
    const a = tagValue(r.tags, "agent:") ?? "unknown";
    if (!byAgent.has(a)) byAgent.set(a, []);
    byAgent.get(a)!.push(r);
  }
  const raw = Array.from(byAgent.entries()).map(([agent, rs]) => {
    const s = stats(rs);
    const reinforcement =
      s.profitFactor * (1 + Math.max(-1, Math.min(1, s.sharpe))) * Math.log1p(s.trades);
    return { agent, ...s, reinforcement, weight: 0 };
  });
  const weights = softmax(raw.map((r) => r.reinforcement), 1.5);
  return raw
    .map((r, i) => ({ ...r, weight: weights[i] ?? 0 }))
    .sort((a, b) => b.reinforcement - a.reinforcement);
}

// ───────────────────────────────────────────────────────────────
// 4 + 5. Strategy ranking + Regime adaptation
// ───────────────────────────────────────────────────────────────
export function strategyScores(sinceMs?: number): StrategyScore[] {
  const rows = listSince(sinceMs);
  const byStrat = new Map<string, TradeMemoryEntry[]>();
  for (const r of rows) {
    const s = tagValue(r.tags, "strategy:") ?? "default";
    if (!byStrat.has(s)) byStrat.set(s, []);
    byStrat.get(s)!.push(r);
  }
  const raw = Array.from(byStrat.entries()).map(([strategy, rs]) => {
    const s = stats(rs);
    const byRegime = new Map<string, TradeMemoryEntry[]>();
    for (const r of rs) {
      const k = r.regime ?? "unknown";
      if (!byRegime.has(k)) byRegime.set(k, []);
      byRegime.get(k)!.push(r);
    }
    let bestRegime: string | undefined;
    let bestWR = -1;
    for (const [reg, list] of byRegime.entries()) {
      const ss = stats(list);
      if (ss.trades >= 3 && ss.winRate > bestWR) {
        bestWR = ss.winRate;
        bestRegime = reg;
      }
    }
    const reinforcement = s.profitFactor * (1 + Math.max(-1, Math.min(1, s.sharpe))) * Math.log1p(s.trades);
    return { strategy, ...s, bestRegime, reinforcement, weight: 0, rank: 0 };
  });
  const weights = softmax(raw.map((r) => r.reinforcement), 1.5);
  return raw
    .map((r, i) => ({ ...r, weight: weights[i] ?? 0 }))
    .sort((a, b) => b.reinforcement - a.reinforcement)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ───────────────────────────────────────────────────────────────
// 6. Drift auto-detection
// Compares the most recent `sinceMs` window against everything older.
// Falls back to count-based split when no time window is given.
// ───────────────────────────────────────────────────────────────
export function driftReport(windowSize = 30, sinceMs?: number): DriftReport {
  const all = aiMemory.list().filter((r) => r.outcome !== "open");
  let recent: TradeMemoryEntry[];
  let baseline: TradeMemoryEntry[];
  if (sinceMs) {
    const cutoff = Date.now() - sinceMs;
    recent = all.filter((r) => r.ts >= cutoff);
    baseline = all.filter((r) => r.ts < cutoff);
  } else {
    recent = all.slice(0, windowSize);
    baseline = all.slice(windowSize);
  }
  const s1 = stats(recent);
  const s0 = stats(baseline.length ? baseline : all);
  const p = s0.winRate || 0.5;
  const n = Math.max(1, s1.trades);
  const se = Math.sqrt((p * (1 - p)) / n);
  const z = se > 0 ? (s1.winRate - p) / se : 0;
  return {
    isDrifting: Math.abs(z) > 2 && s1.trades >= 10,
    recentWinRate: s1.winRate,
    baselineWinRate: s0.winRate,
    delta: s1.winRate - s0.winRate,
    z,
    window: sinceMs ?? windowSize,
  };
}

// ───────────────────────────────────────────────────────────────
// 8. Historical replay simulation
// ───────────────────────────────────────────────────────────────
export function replay(
  filter?: { strategy?: string; agent?: string; regime?: string },
  sinceMs?: number,
): ReplayResult {
  let rows = listSince(sinceMs).filter((r) => r.outcome !== "open");
  if (filter?.strategy) rows = rows.filter((r) => tagValue(r.tags, "strategy:") === filter.strategy);
  if (filter?.agent) rows = rows.filter((r) => tagValue(r.tags, "agent:") === filter.agent);
  if (filter?.regime) rows = rows.filter((r) => r.regime === filter.regime);
  rows = [...rows].sort((a, b) => a.ts - b.ts);
  const s = stats(rows);
  let eq = 0;
  let peak = 0;
  let maxDD = 0;
  const equity: number[] = [];
  for (const r of rows) {
    eq += (r.pnlPct ?? 0) * 100;
    equity.push(eq);
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    trades: s.trades,
    winRate: s.winRate,
    expectancy: s.expectancy,
    profitFactor: s.profitFactor,
    equity,
    maxDD,
  };
}

// ───────────────────────────────────────────────────────────────
// 9. Continuous learning memory — accessor + retention summary
// ───────────────────────────────────────────────────────────────
export function memorySummary(sinceMs?: number) {
  const rows = listSince(sinceMs);
  const open = rows.filter((r) => r.outcome === "open").length;
  const closed = rows.length - open;
  const oldest = rows.length ? Math.min(...rows.map((r) => r.ts)) : Date.now();
  return {
    total: rows.length,
    open,
    closed,
    spanDays: Math.max(1, Math.round((Date.now() - oldest) / 86400000)),
  };
}

// ───────────────────────────────────────────────────────────────
// 10. Meta-learning — auto-tune confidence threshold
// ───────────────────────────────────────────────────────────────
export interface MetaTune {
  threshold: number;
  expectancy: number;
  trades: number;
  improvement: number;
}

export function metaTuneThreshold(sinceMs?: number): MetaTune {
  const rows = listSince(sinceMs).filter((r) => r.outcome !== "open" && typeof r.confidence === "number");
  const baseline = stats(rows).expectancy;
  let best: MetaTune = { threshold: 0, expectancy: baseline, trades: rows.length, improvement: 0 };
  for (let t = 0.1; t <= 0.95; t += 0.05) {
    const filtered = rows.filter((r) => (r.confidence ?? 0) >= t);
    if (filtered.length < 5) continue;
    const s = stats(filtered);
    if (s.expectancy > best.expectancy) {
      best = {
        threshold: +t.toFixed(2),
        expectancy: s.expectancy,
        trades: s.trades,
        improvement: s.expectancy - baseline,
      };
    }
  }
  return best;
}

// ───────────────────────────────────────────────────────────────
// Failure & false-positive analysis
// ───────────────────────────────────────────────────────────────
export interface FailureRow {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  pnlPct: number;
  confidence: number;
  regime?: string;
  strategy?: string;
  agent?: string;
  reason: string;
}

export function failureAnalysis(limit = 10, sinceMs?: number): FailureRow[] {
  const rows = listSince(sinceMs).filter((r) => r.outcome === "loss");
  return rows
    .map<FailureRow>((r) => ({
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      pnlPct: r.pnlPct ?? 0,
      confidence: r.confidence ?? 0,
      regime: r.regime,
      strategy: tagValue(r.tags, "strategy:"),
      agent: tagValue(r.tags, "agent:"),
      reason: (r.confidence ?? 0) > 0.7 ? "high-confidence miss" : "low-confidence loss",
    }))
    .sort((a, b) => a.pnlPct - b.pnlPct)
    .slice(0, limit);
}

/** False positives: high confidence (>=0.7) that resulted in losses. */
export function falsePositives(sinceMs?: number): FailureRow[] {
  return failureAnalysis(50, sinceMs).filter((r) => r.confidence >= 0.7);
}

// ───────────────────────────────────────────────────────────────
// Regime stats over a time window (mirrors statsByRegime but windowed)
// ───────────────────────────────────────────────────────────────
export function regimeStatsSince(sinceMs?: number) {
  const rows = listSince(sinceMs);
  const groups: Record<string, TradeMemoryEntry[]> = {};
  for (const r of rows) (groups[r.regime ?? "unknown"] ??= []).push(r);
  const out: Record<string, ReturnType<typeof stats>> = {};
  for (const [k, v] of Object.entries(groups)) out[k] = stats(v);
  return out;
}

/** Overall stats (windowed). */
export function overallStats(sinceMs?: number) {
  return stats(listSince(sinceMs));
}
