// Risk-adjusted performance metrics for an equity curve.
export interface EquityPoint { ts: number; equity: number; }

export interface RiskMetrics {
  totalReturnPct: number;
  cagr: number;
  volatilityPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdownPct: number;
  avgDrawdownPct: number;
  recoveryBars: number;
  ulcerIndex: number;
}

const ANNUAL = 252;

export function computeRiskMetrics(curve: EquityPoint[], rfAnnual = 0): RiskMetrics {
  if (curve.length < 2) {
    return { totalReturnPct: 0, cagr: 0, volatilityPct: 0, sharpe: 0, sortino: 0,
      calmar: 0, maxDrawdownPct: 0, avgDrawdownPct: 0, recoveryBars: 0, ulcerIndex: 0 };
  }
  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    rets.push((curve[i].equity - curve[i - 1].equity) / curve[i - 1].equity);
  }
  const first = curve[0].equity, last = curve.at(-1)!.equity;
  const totalReturn = (last - first) / first;
  const years = Math.max((curve.at(-1)!.ts - curve[0].ts) / (365 * 86_400_000), 1 / 365);
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length;
  const std = Math.sqrt(variance);
  const downside = Math.sqrt(rets.reduce((s, x) => s + (x < 0 ? x * x : 0), 0) / rets.length);
  const rfDaily = rfAnnual / ANNUAL;
  const sharpe = std > 0 ? ((mean - rfDaily) / std) * Math.sqrt(ANNUAL) : 0;
  const sortino = downside > 0 ? ((mean - rfDaily) / downside) * Math.sqrt(ANNUAL) : 0;

  let peak = first, maxDd = 0, ddSum = 0, ddCount = 0, ulcerSq = 0;
  let recoveryBars = 0, currentRunStart = -1;
  for (let i = 0; i < curve.length; i++) {
    const eq = curve[i].equity;
    if (eq > peak) {
      peak = eq;
      if (currentRunStart >= 0) { recoveryBars = Math.max(recoveryBars, i - currentRunStart); currentRunStart = -1; }
    } else {
      if (currentRunStart < 0) currentRunStart = i;
    }
    const dd = (peak - eq) / peak;
    if (dd > 0) { ddSum += dd; ddCount++; ulcerSq += dd * dd; }
    if (dd > maxDd) maxDd = dd;
  }
  const calmar = maxDd > 0 ? cagr / maxDd : 0;
  return {
    totalReturnPct: +(totalReturn * 100).toFixed(2),
    cagr: +(cagr * 100).toFixed(2),
    volatilityPct: +(std * Math.sqrt(ANNUAL) * 100).toFixed(2),
    sharpe: +sharpe.toFixed(2),
    sortino: +sortino.toFixed(2),
    calmar: +calmar.toFixed(2),
    maxDrawdownPct: +(maxDd * 100).toFixed(2),
    avgDrawdownPct: +(ddCount ? (ddSum / ddCount) * 100 : 0).toFixed(2),
    recoveryBars,
    ulcerIndex: +(Math.sqrt(ulcerSq / curve.length) * 100).toFixed(2),
  };
}
