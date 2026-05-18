/** Performance learning — computes win rate, expectancy, edge per setup/regime. */
import { aiMemory, type TradeMemoryEntry } from "./aiMemory";

export interface PerfStats {
  trades: number; wins: number; losses: number; winRate: number;
  avgWin: number; avgLoss: number; expectancy: number; profitFactor: number;
}

export function statsFor(rows: TradeMemoryEntry[]): PerfStats {
  const closed = rows.filter((r) => r.outcome === "win" || r.outcome === "loss");
  const wins = closed.filter((r) => r.outcome === "win");
  const losses = closed.filter((r) => r.outcome === "loss");
  const sum = (arr: TradeMemoryEntry[]) => arr.reduce((s, x) => s + (x.pnlPct ?? 0), 0);
  const avgWin = wins.length ? sum(wins) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(sum(losses) / losses.length) : 0;
  const winRate = closed.length ? wins.length / closed.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const grossW = sum(wins);
  const grossL = Math.abs(sum(losses)) || 1e-9;
  return { trades: closed.length, wins: wins.length, losses: losses.length,
    winRate, avgWin, avgLoss, expectancy, profitFactor: grossW / grossL };
}

export function statsByRegime(): Record<string, PerfStats> {
  const out: Record<string, PerfStats> = {};
  const rows = aiMemory.list();
  const groups: Record<string, TradeMemoryEntry[]> = {};
  for (const r of rows) (groups[r.regime ?? "unknown"] ??= []).push(r);
  for (const [k, v] of Object.entries(groups)) out[k] = statsFor(v);
  return out;
}

/* ---------- Legacy API (kept for backward compatibility) ---------- */

export interface PerformanceLearningObservation { label: string; detail?: string; }
export interface PerformanceLearningModifier { label: string; delta: string; }
export interface PerformanceLearningReport {
  hint: string;
  highConfAccuracy: number;       // 0-100
  falseBreakoutRate: number;      // 0-100
  observations: PerformanceLearningObservation[];
  modifiers: PerformanceLearningModifier[];
  stats: PerfStats;
}

export function buildPerformanceLearning(): PerformanceLearningReport {
  const rows = aiMemory.list();
  const stats = statsFor(rows);
  const highConf = rows.filter((r) => (r.confidence ?? 0) >= 0.7 && r.outcome !== "open");
  const highWin = highConf.filter((r) => r.outcome === "win").length;
  const highConfAccuracy = highConf.length ? Math.round((highWin / highConf.length) * 100) : 0;

  // False breakout heuristic: tagged "breakout" trades that lost
  const brk = rows.filter((r) => r.tags?.includes("breakout") && r.outcome !== "open");
  const brkLoss = brk.filter((r) => r.outcome === "loss").length;
  const falseBreakoutRate = brk.length ? Math.round((brkLoss / brk.length) * 100) : 0;

  const observations: PerformanceLearningObservation[] = [];
  if (stats.trades === 0) observations.push({ label: "No closed trades yet" });
  if (stats.profitFactor > 1.5) observations.push({ label: "Profit factor strong", detail: stats.profitFactor.toFixed(2) });
  if (stats.profitFactor < 1) observations.push({ label: "Profit factor below 1 — strategy under review" });
  if (highConfAccuracy >= 70) observations.push({ label: "High-confidence setups outperform" });
  if (falseBreakoutRate > 50) observations.push({ label: "Breakout false-positive rate elevated" });

  const modifiers: PerformanceLearningModifier[] = [];
  if (stats.winRate > 0.55) modifiers.push({ label: "Confidence", delta: "+5%" });
  if (stats.winRate < 0.45) modifiers.push({ label: "Confidence", delta: "−10%" });
  if (falseBreakoutRate > 50) modifiers.push({ label: "Breakout setups", delta: "−15%" });
  if (stats.expectancy > 0.01) modifiers.push({ label: "Size", delta: "+10%" });

  const hint = stats.trades === 0
    ? "Awaiting trade history to begin self-learning"
    : stats.winRate >= 0.55
      ? "Edge detected — system reinforcing winning patterns"
      : "Edge thin — system tightening filters";

  return { hint, highConfAccuracy, falseBreakoutRate, observations, modifiers, stats };
}
