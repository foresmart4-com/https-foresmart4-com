// Global Risk Engine — capital preservation guardrails.
export interface RiskLimits {
  maxDailyLossPct: number;     // % of equity
  maxPortfolioExposurePct: number;
  maxPositionPct: number;
  volatilityShutdown: number;   // 0-100
  drawdownShutdownPct: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLossPct: 3,
  maxPortfolioExposurePct: 40,
  maxPositionPct: 8,
  volatilityShutdown: 85,
  drawdownShutdownPct: 8,
};

export interface RiskInputs {
  equity: number;
  dailyPnl: number;          // negative = loss
  drawdownPct: number;       // 0-100
  exposurePct: number;       // 0-100
  marketVolatility: number;  // 0-100
  panic: boolean;
}

export type RiskState = "normal" | "caution" | "defensive" | "shutdown";

export interface RiskReport {
  state: RiskState;
  warnings: string[];
  triggers: string[];
  autoReduce: boolean;
  blockNewEntries: boolean;
  recommendedExposurePct: number;
  limits: RiskLimits;
}

export function evaluateRisk(input: RiskInputs, limits: RiskLimits = DEFAULT_RISK_LIMITS): RiskReport {
  const warnings: string[] = [];
  const triggers: string[] = [];
  let state: RiskState = "normal";

  const dailyLossPct = input.equity > 0 ? Math.max(0, -input.dailyPnl / input.equity * 100) : 0;

  if (dailyLossPct >= limits.maxDailyLossPct) {
    triggers.push(`Daily loss ${dailyLossPct.toFixed(1)}% ≥ ${limits.maxDailyLossPct}%`);
    state = "shutdown";
  } else if (dailyLossPct >= limits.maxDailyLossPct * 0.7) {
    warnings.push(`Daily loss approaching limit (${dailyLossPct.toFixed(1)}%)`);
    state = "defensive";
  }

  if (input.drawdownPct >= limits.drawdownShutdownPct) {
    triggers.push(`Drawdown ${input.drawdownPct.toFixed(1)}% ≥ ${limits.drawdownShutdownPct}%`);
    state = "shutdown";
  }

  if (input.marketVolatility >= limits.volatilityShutdown) {
    triggers.push(`Volatility ${input.marketVolatility} ≥ ${limits.volatilityShutdown}`);
    state = state === "shutdown" ? state : "defensive";
  } else if (input.marketVolatility >= 65) {
    warnings.push("Elevated market volatility");
    if (state === "normal") state = "caution";
  }

  if (input.exposurePct > limits.maxPortfolioExposurePct) {
    warnings.push(`Exposure ${input.exposurePct.toFixed(0)}% > limit ${limits.maxPortfolioExposurePct}%`);
    if (state === "normal") state = "defensive";
  }

  if (input.panic) {
    triggers.push("Panic regime detected");
    state = "shutdown";
  }

  const autoReduce = state === "defensive" || state === "shutdown";
  const blockNewEntries = state === "shutdown" || (state === "defensive" && input.exposurePct > limits.maxPortfolioExposurePct * 0.8);
  const recommendedExposurePct = state === "shutdown" ? 0
    : state === "defensive" ? Math.min(input.exposurePct, limits.maxPortfolioExposurePct * 0.5)
    : state === "caution" ? Math.min(input.exposurePct, limits.maxPortfolioExposurePct * 0.8)
    : limits.maxPortfolioExposurePct;

  return { state, warnings, triggers, autoReduce, blockNewEntries, recommendedExposurePct, limits };
}
