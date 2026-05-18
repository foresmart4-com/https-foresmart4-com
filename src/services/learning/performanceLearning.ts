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
