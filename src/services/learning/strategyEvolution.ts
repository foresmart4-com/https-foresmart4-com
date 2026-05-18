/** Strategy evolution — bandit-style score per strategy, adapts allocation. */
const KEY = "strategy_scores_v1";
type Scores = Record<string, { wins: number; losses: number; pnl: number }>;
function read(): Scores {
  if (typeof localStorage === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function write(s: Scores) { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(s)); }

export const strategyEvolution = {
  record(strategy: string, pnl: number) {
    const s = read();
    s[strategy] ??= { wins: 0, losses: 0, pnl: 0 };
    s[strategy].pnl += pnl;
    if (pnl >= 0) s[strategy].wins++; else s[strategy].losses++;
    write(s);
  },
  allocations(): Record<string, number> {
    const s = read();
    const keys = Object.keys(s);
    if (!keys.length) return {};
    const scores = keys.map((k) => {
      const r = s[k];
      const total = r.wins + r.losses;
      const rate = total ? r.wins / total : 0.5;
      return { k, score: Math.max(0.05, rate + r.pnl * 0.001) };
    });
    const sum = scores.reduce((a, b) => a + b.score, 0) || 1;
    return Object.fromEntries(scores.map((s) => [s.k, s.score / sum]));
  },
};
