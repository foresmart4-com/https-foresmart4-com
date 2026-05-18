/**
 * Capital Manager — institutional capital allocation rules.
 * Pure functions, no external deps. Safe to import on client or server.
 */

export type Regime =
  | "trending_bull"
  | "trending_bear"
  | "ranging"
  | "volatile"
  | "panic"
  | "risk_off"
  | "recovery"
  | "neutral";

export interface CapitalConfig {
  totalCapital: number;
  maxCapitalExposurePct: number;   // 0-1
  maxPerTradePct: number;          // 0-1
  maxSectorPct: number;            // 0-1
  maxCorrelatedPct: number;        // 0-1
  reservedCashPct: number;         // 0-1
}

export const DEFAULT_CAPITAL_CONFIG: CapitalConfig = {
  totalCapital: 0,
  maxCapitalExposurePct: 0.6,
  maxPerTradePct: 0.08,
  maxSectorPct: 0.35,
  maxCorrelatedPct: 0.4,
  reservedCashPct: 0.15,
};

const REGIME_MULTIPLIER: Record<Regime, number> = {
  trending_bull: 1.0,
  recovery: 0.85,
  ranging: 0.7,
  neutral: 0.7,
  trending_bear: 0.5,
  volatile: 0.45,
  risk_off: 0.3,
  panic: 0.15,
};

export function regimeAllocationCap(cfg: CapitalConfig, regime: Regime): number {
  const m = REGIME_MULTIPLIER[regime] ?? 0.6;
  return cfg.totalCapital * cfg.maxCapitalExposurePct * m;
}

export function availableDeployable(
  cfg: CapitalConfig,
  regime: Regime,
  currentExposure: number,
): number {
  const cap = regimeAllocationCap(cfg, regime);
  const reserve = cfg.totalCapital * cfg.reservedCashPct;
  return Math.max(0, Math.min(cap, cfg.totalCapital - reserve) - currentExposure);
}

export function perTradeCap(cfg: CapitalConfig, regime: Regime): number {
  const m = REGIME_MULTIPLIER[regime] ?? 0.6;
  return cfg.totalCapital * cfg.maxPerTradePct * m;
}
