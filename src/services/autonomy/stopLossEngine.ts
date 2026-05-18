// Stop-Loss Engine — adaptive and trailing stops.
export interface StopLossInput {
  entryPrice: number;
  side: "long" | "short";
  volatilityPct: number;     // 0-100
  riskBudgetPct: number;     // % of entry price to risk
}

export interface StopLossPlan {
  hardStop: number;
  trailingTrigger: number;
  trailingDistancePct: number;
  rationale: string;
}

export function computeStopLoss(i: StopLossInput): StopLossPlan {
  const baseRisk = Math.max(i.riskBudgetPct, 0.5);
  // Scale risk with volatility.
  const adj = baseRisk * (1 + i.volatilityPct / 200);
  const hardStop = i.side === "long"
    ? i.entryPrice * (1 - adj / 100)
    : i.entryPrice * (1 + adj / 100);

  const trailingTrigger = i.side === "long"
    ? i.entryPrice * (1 + adj / 100)
    : i.entryPrice * (1 - adj / 100);
  const trailingDistancePct = +(adj * 0.6).toFixed(2);

  return {
    hardStop: +hardStop.toFixed(4),
    trailingTrigger: +trailingTrigger.toFixed(4),
    trailingDistancePct,
    rationale: `Risk ${adj.toFixed(2)}% scaled by vol ${i.volatilityPct.toFixed(0)}`,
  };
}

export function trailStop(currentStop: number, lastPrice: number, side: "long" | "short", distancePct: number): number {
  if (side === "long") {
    const candidate = lastPrice * (1 - distancePct / 100);
    return Math.max(currentStop, candidate);
  }
  const candidate = lastPrice * (1 + distancePct / 100);
  return Math.min(currentStop, candidate);
}
