/**
 * Exposure Controller — sector + correlation aggregation and limits.
 */

export interface ExposureItem {
  symbol: string;
  sector?: string;
  notional: number;
  correlationGroup?: string;
}

export interface ExposureBreakdown {
  total: number;
  bySector: Record<string, number>;
  byCorrelation: Record<string, number>;
  largestSector: { name: string; pct: number };
  largestCorrelated: { name: string; pct: number };
}

export function aggregateExposure(items: ExposureItem[]): ExposureBreakdown {
  const bySector: Record<string, number> = {};
  const byCorrelation: Record<string, number> = {};
  let total = 0;
  for (const it of items) {
    total += it.notional;
    if (it.sector) bySector[it.sector] = (bySector[it.sector] ?? 0) + it.notional;
    if (it.correlationGroup) {
      byCorrelation[it.correlationGroup] =
        (byCorrelation[it.correlationGroup] ?? 0) + it.notional;
    }
  }
  const pick = (m: Record<string, number>) => {
    let name = "—", val = 0;
    for (const [k, v] of Object.entries(m)) if (v > val) { name = k; val = v; }
    return { name, pct: total > 0 ? val / total : 0 };
  };
  return {
    total,
    bySector,
    byCorrelation,
    largestSector: pick(bySector),
    largestCorrelated: pick(byCorrelation),
  };
}

export interface ExposureCheck {
  allowed: boolean;
  reason?: string;
  utilization: {
    capital: number;
    sector: number;
    correlated: number;
  };
}

export function checkExposureLimit(args: {
  totalCapital: number;
  maxCapitalExposurePct: number;
  maxSectorPct: number;
  maxCorrelatedPct: number;
  current: ExposureBreakdown;
  addNotional: number;
  sector?: string;
  correlationGroup?: string;
}): ExposureCheck {
  const newTotal = args.current.total + args.addNotional;
  const newSector =
    (args.sector ? (args.current.bySector[args.sector] ?? 0) : 0) + args.addNotional;
  const newCorr =
    (args.correlationGroup ? (args.current.byCorrelation[args.correlationGroup] ?? 0) : 0) +
    args.addNotional;

  const capUtil = args.totalCapital > 0 ? newTotal / args.totalCapital : 1;
  const secUtil = newTotal > 0 ? newSector / newTotal : 0;
  const corUtil = newTotal > 0 ? newCorr / newTotal : 0;

  if (capUtil > args.maxCapitalExposurePct)
    return { allowed: false, reason: "Max capital exposure exceeded",
      utilization: { capital: capUtil, sector: secUtil, correlated: corUtil } };
  if (secUtil > args.maxSectorPct)
    return { allowed: false, reason: "Max sector concentration exceeded",
      utilization: { capital: capUtil, sector: secUtil, correlated: corUtil } };
  if (corUtil > args.maxCorrelatedPct)
    return { allowed: false, reason: "Max correlated exposure exceeded",
      utilization: { capital: capUtil, sector: secUtil, correlated: corUtil } };

  return { allowed: true, utilization: { capital: capUtil, sector: secUtil, correlated: corUtil } };
}
