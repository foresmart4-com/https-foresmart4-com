// Rebalance Engine — diff current portfolio vs target allocation.
export interface RebalanceHolding { asset: string; weightPct: number; valueUSDT: number; }
export interface RebalanceTarget   { asset: string; weightPct: number; }

export interface RebalanceTrade {
  asset: string;
  side: "BUY" | "SELL";
  deltaPct: number;
  notionalUSDT: number;
  priority: number;
}

export interface RebalanceReport {
  trades: RebalanceTrade[];
  totalDriftPct: number;
  rebalanceNeeded: boolean;
}

export function diffPortfolio(
  current: RebalanceHolding[],
  target: RebalanceTarget[],
  totalEquityUSDT: number,
  driftThresholdPct = 3,
): RebalanceReport {
  const map = new Map(current.map((h) => [h.asset, h]));
  const tradeList: RebalanceTrade[] = [];
  let totalDrift = 0;

  for (const t of target) {
    const cur = map.get(t.asset);
    const curPct = cur?.weightPct ?? 0;
    const drift = t.weightPct - curPct;
    totalDrift += Math.abs(drift);
    if (Math.abs(drift) >= driftThresholdPct) {
      tradeList.push({
        asset: t.asset,
        side: drift > 0 ? "BUY" : "SELL",
        deltaPct: +drift.toFixed(2),
        notionalUSDT: +(totalEquityUSDT * Math.abs(drift) / 100).toFixed(2),
        priority: Math.abs(drift),
      });
    }
  }

  // Sell off assets not in target.
  const targetSet = new Set(target.map((t) => t.asset));
  for (const h of current) {
    if (!targetSet.has(h.asset) && h.weightPct > 0.5) {
      tradeList.push({
        asset: h.asset, side: "SELL", deltaPct: -h.weightPct,
        notionalUSDT: h.valueUSDT, priority: h.weightPct,
      });
      totalDrift += h.weightPct;
    }
  }

  tradeList.sort((a, b) => b.priority - a.priority);
  return {
    trades: tradeList,
    totalDriftPct: +totalDrift.toFixed(2),
    rebalanceNeeded: tradeList.length > 0,
  };
}
