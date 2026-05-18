/** Backtest & simulation lab — historical, Monte Carlo, stress, crisis replay. */

export interface Bar { ts: number; open: number; high: number; low: number; close: number; volume?: number; }
export interface Signal { ts: number; side: "buy"|"sell"|"flat"; }
export interface BacktestResult {
  trades: number; winRate: number; pnlPct: number; maxDrawdownPct: number;
  sharpe: number; equityCurve: { ts: number; equity: number }[];
}

export function backtest(bars: Bar[], signals: Signal[], startEquity = 10000): BacktestResult {
  let cash = startEquity, pos = 0, entry = 0;
  let wins = 0, trades = 0;
  const curve: { ts: number; equity: number }[] = [];
  const returns: number[] = [];
  const sigMap = new Map(signals.map((s) => [s.ts, s.side]));
  for (const b of bars) {
    const s = sigMap.get(b.ts);
    if (s === "buy" && pos === 0) { pos = cash / b.close; entry = b.close; cash = 0; }
    else if (s === "sell" && pos > 0) {
      cash = pos * b.close; trades++; if (b.close > entry) wins++;
      pos = 0;
    }
    const eq = cash + pos * b.close;
    curve.push({ ts: b.ts, equity: eq });
    if (curve.length > 1) returns.push((eq - curve[curve.length-2].equity) / curve[curve.length-2].equity);
  }
  const last = curve.at(-1)?.equity ?? startEquity;
  let peak = startEquity, maxDd = 0;
  for (const p of curve) { peak = Math.max(peak, p.equity); maxDd = Math.max(maxDd, (peak - p.equity) / peak); }
  const mean = returns.reduce((s,x)=>s+x,0) / (returns.length || 1);
  const std = Math.sqrt(returns.reduce((s,x)=>s+(x-mean)**2,0) / (returns.length || 1)) || 1e-9;
  return {
    trades, winRate: trades ? wins / trades : 0,
    pnlPct: (last - startEquity) / startEquity,
    maxDrawdownPct: maxDd, sharpe: (mean / std) * Math.sqrt(252),
    equityCurve: curve,
  };
}

export function monteCarlo(expectedReturn: number, volatility: number, days: number, runs = 500, start = 10000) {
  const out: number[] = [];
  for (let r = 0; r < runs; r++) {
    let eq = start;
    for (let d = 0; d < days; d++) {
      const z = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
      eq *= 1 + expectedReturn / 252 + volatility / Math.sqrt(252) * z;
    }
    out.push(eq);
  }
  out.sort((a,b) => a-b);
  return {
    median: out[Math.floor(out.length / 2)],
    p5: out[Math.floor(out.length * 0.05)],
    p95: out[Math.floor(out.length * 0.95)],
    worst: out[0], best: out[out.length-1],
  };
}

export function stressTest(equity: number, scenarios = { crash: -0.2, spike: 0.1, flash: -0.08 }) {
  return Object.fromEntries(Object.entries(scenarios).map(([k, v]) => [k, equity * (1 + v)]));
}

export function crisisReplay(name: "2008"|"covid"|"2022") {
  const map = { "2008": -0.38, "covid": -0.34, "2022": -0.25 };
  return { name, expectedDrawdown: map[name] };
}
