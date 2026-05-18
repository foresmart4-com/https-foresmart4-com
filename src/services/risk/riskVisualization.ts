/**
 * Risk Visualization — pure data builders for heatmap, matrix, radar, alerts.
 */

import type { ExposureBreakdown } from "./exposureController";

export interface HeatCell { label: string; pct: number; risk: "low"|"med"|"high"|"critical"; }

export function buildHeatmap(breakdown: ExposureBreakdown): HeatCell[] {
  const cells: HeatCell[] = [];
  for (const [k, v] of Object.entries(breakdown.bySector)) {
    const pct = breakdown.total > 0 ? v / breakdown.total : 0;
    cells.push({ label: k, pct, risk: pct > 0.5 ? "critical" : pct > 0.35 ? "high" : pct > 0.2 ? "med" : "low" });
  }
  return cells.sort((a, b) => b.pct - a.pct);
}

export interface RiskRadarPoint { axis: string; value: number; } // 0-1

export function buildRiskRadar(args: {
  capitalUtil: number;
  sectorUtil: number;
  correlatedUtil: number;
  volatility: number;       // %
  drawdownPct: number;
  liquidityScore: number;   // 0-1
  confidence: number;       // 0-1
}): RiskRadarPoint[] {
  const norm = (v: number, max: number) => Math.min(1, Math.max(0, v / max));
  return [
    { axis: "Capital Use", value: norm(args.capitalUtil, 1) },
    { axis: "Sector", value: norm(args.sectorUtil, 1) },
    { axis: "Correlation", value: norm(args.correlatedUtil, 1) },
    { axis: "Volatility", value: norm(args.volatility, 0.08) },
    { axis: "Drawdown", value: norm(args.drawdownPct, 0.15) },
    { axis: "Illiquidity", value: 1 - args.liquidityScore },
    { axis: "Conf. Decay", value: 1 - args.confidence },
  ];
}

export interface RiskAlert {
  id: string;
  level: "info" | "warn" | "critical";
  category: "concentration" | "volatility" | "liquidity" | "confidence";
  message: string;
}

export function buildAlerts(args: {
  breakdown: ExposureBreakdown;
  volatility: number;
  liquidityScore: number;
  confidence: number;
}): RiskAlert[] {
  const out: RiskAlert[] = [];
  if (args.breakdown.largestSector.pct > 0.4)
    out.push({ id: "sec", level: "critical", category: "concentration",
      message: `Sector "${args.breakdown.largestSector.name}" exceeds 40% of book` });
  else if (args.breakdown.largestSector.pct > 0.3)
    out.push({ id: "sec", level: "warn", category: "concentration",
      message: `Sector "${args.breakdown.largestSector.name}" elevated` });

  if (args.breakdown.largestCorrelated.pct > 0.45)
    out.push({ id: "cor", level: "critical", category: "concentration",
      message: `Correlated cluster "${args.breakdown.largestCorrelated.name}" too heavy` });

  if (args.volatility > 0.06)
    out.push({ id: "vol", level: "critical", category: "volatility",
      message: "Realized volatility extreme — defensive sizing" });
  else if (args.volatility > 0.04)
    out.push({ id: "vol", level: "warn", category: "volatility",
      message: "Volatility elevated" });

  if (args.liquidityScore < 0.4)
    out.push({ id: "liq", level: "critical", category: "liquidity",
      message: "Liquidity thin — slippage risk high" });
  else if (args.liquidityScore < 0.6)
    out.push({ id: "liq", level: "warn", category: "liquidity",
      message: "Liquidity below comfort band" });

  if (args.confidence < 0.4)
    out.push({ id: "cf", level: "warn", category: "confidence",
      message: "AI confidence degraded — narrow setups" });
  return out;
}
