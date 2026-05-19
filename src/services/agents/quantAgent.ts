// Quantitative Intelligence Agent — Sharpe, beta, VaR, drawdown, correlation
// matrix and a lightweight Monte Carlo simulation on the quote history.
import type { AgentContext, AgentSignal } from "./types";
import type { MarketQuote } from "@/services/market/marketData";

function returns(h: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < h.length; i++) {
    const prev = h[i - 1];
    if (prev > 0) r.push((h[i] - prev) / prev);
  }
  return r;
}

function mean(x: number[]) { return x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0; }
function stdev(x: number[]) {
  if (x.length < 2) return 0;
  const m = mean(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
}
function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const d = Math.sqrt(da * db);
  return d > 0 ? num / d : 0;
}

export interface QuantMetrics {
  symbol: string;
  sharpe: number;
  beta: number;        // vs market basket
  var95: number;       // 1-period parametric VaR, fraction (e.g. -0.024 = -2.4%)
  cvar95: number;
  maxDrawdownPct: number;
  monteCarlo: { p05: number; p50: number; p95: number; horizon: number };
}

function maxDrawdown(h: number[]): number {
  let peak = -Infinity, dd = 0;
  for (const p of h) { peak = Math.max(peak, p); if (peak > 0) dd = Math.min(dd, (p - peak) / peak); }
  return dd; // negative fraction
}

function monteCarlo(r: number[], horizon = 20, paths = 400) {
  const m = mean(r), sd = stdev(r) || 1e-9;
  const out: number[] = [];
  for (let p = 0; p < paths; p++) {
    let cum = 1;
    for (let i = 0; i < horizon; i++) {
      const u = Math.random() || 1e-9, v = Math.random();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); // Box-Muller
      cum *= 1 + (m + sd * z);
    }
    out.push(cum - 1);
  }
  out.sort((a, b) => a - b);
  const q = (p: number) => out[Math.max(0, Math.min(out.length - 1, Math.floor(out.length * p)))];
  return { p05: q(0.05), p50: q(0.5), p95: q(0.95), horizon };
}

export function computeQuantMetrics(quotes: MarketQuote[]): {
  perAsset: QuantMetrics[];
  correlationMatrix: { symbols: string[]; matrix: number[][] };
  portfolioVaR95: number;
} {
  const valid = quotes.filter((q) => q.history?.length >= 8);
  // Synthetic market basket = equal-weighted return of all valid assets
  const allReturns = valid.map((q) => returns(q.history));
  const minLen = Math.min(...allReturns.map((r) => r.length), Infinity);
  const market: number[] = [];
  for (let i = 0; i < minLen; i++) {
    let s = 0; for (const r of allReturns) s += r[i];
    market.push(s / Math.max(1, allReturns.length));
  }
  const mktVar = stdev(market) ** 2 || 1e-9;

  const perAsset: QuantMetrics[] = valid.map((q, i) => {
    const r = allReturns[i];
    const sd = stdev(r) || 1e-9;
    const m = mean(r);
    const sharpe = +(m / sd * Math.sqrt(252)).toFixed(2);
    // beta = cov(r, market) / var(market)
    const n = Math.min(r.length, market.length);
    let cov = 0;
    const mr = mean(r.slice(0, n)), mm = mean(market.slice(0, n));
    for (let k = 0; k < n; k++) cov += (r[k] - mr) * (market[k] - mm);
    cov /= Math.max(1, n - 1);
    const beta = +(cov / mktVar).toFixed(2);
    const z95 = 1.645;
    const var95 = -(m - z95 * sd);
    // CVaR ≈ mean of returns below -VaR
    const tail = r.filter((x) => x <= -var95);
    const cvar95 = tail.length ? -mean(tail) : var95;
    return {
      symbol: q.key,
      sharpe: isFinite(sharpe) ? sharpe : 0,
      beta: isFinite(beta) ? beta : 0,
      var95: +var95.toFixed(4),
      cvar95: +cvar95.toFixed(4),
      maxDrawdownPct: +(maxDrawdown(q.history) * 100).toFixed(2),
      monteCarlo: monteCarlo(r),
    };
  });

  // Correlation matrix
  const symbols = valid.map((q) => q.key);
  const matrix = symbols.map((_, i) =>
    symbols.map((_, j) => +corr(allReturns[i], allReturns[j]).toFixed(2)),
  );

  // Portfolio VaR = equal-weighted sum * sqrt term (simplified — uses market basket VaR)
  const portfolioVaR95 = +(-(mean(market) - 1.645 * stdev(market))).toFixed(4);

  return { perAsset, correlationMatrix: { symbols, matrix }, portfolioVaR95 };
}

export function runQuantAgent({ intel }: AgentContext): AgentSignal & { metrics: ReturnType<typeof computeQuantMetrics> } {
  const metrics = computeQuantMetrics(intel.quotes);
  const drivers: string[] = [];
  const flags: string[] = [];

  const avgSharpe = metrics.perAsset.reduce((s, x) => s + x.sharpe, 0) / Math.max(1, metrics.perAsset.length);
  const worstDD = Math.min(0, ...metrics.perAsset.map((x) => x.maxDrawdownPct));
  const avgBeta = metrics.perAsset.reduce((s, x) => s + Math.abs(x.beta), 0) / Math.max(1, metrics.perAsset.length);

  drivers.push(`Avg Sharpe ${avgSharpe.toFixed(2)} · portfolio 1-period VaR(95) ${(metrics.portfolioVaR95 * 100).toFixed(2)}%`);
  drivers.push(`Worst drawdown in book: ${worstDD.toFixed(2)}%`);
  drivers.push(`Avg |beta| vs basket ${avgBeta.toFixed(2)}`);

  if (worstDD < -25) flags.push("Drawdown >25% in at least one asset — review sizing");
  if (avgBeta > 1.4) flags.push("Book is high-beta — amplifies regime swings");

  const score = Math.max(-100, Math.min(100,
    avgSharpe * 35 + worstDD * 0.8 - (avgBeta - 1) * 15,
  ));
  const bias = score > 10 ? "bullish" : score < -10 ? "bearish" : "neutral";
  const confidence = Math.min(95, 50 + Math.abs(score) * 0.4);

  return {
    id: "quant", label: "Quantitative Intelligence",
    bias, score, confidence, weight: 0.2,
    headline: `Risk-adjusted profile: Sharpe ${avgSharpe.toFixed(2)}, max DD ${worstDD.toFixed(1)}%`,
    drivers, flags, metrics,
  };
}
