// Take-Profit Engine — staged TP ladder with profit protection.
export interface TakeProfitInput {
  entryPrice: number;
  side: "long" | "short";
  expectedMovePct: number;    // expected favourable move
  aggressiveness: number;     // 0-100
}

export interface TakeProfitLevel {
  price: number;
  sizePct: number;
  label: "T1" | "T2" | "T3";
}

export interface TakeProfitPlan {
  levels: TakeProfitLevel[];
  protection: { trigger: number; lockInPct: number };
  rationale: string;
}

export function computeTakeProfit(i: TakeProfitInput): TakeProfitPlan {
  const move = Math.max(0.5, i.expectedMovePct);
  const aggr = Math.max(0, Math.min(100, i.aggressiveness));
  const stretchFactor = 1 + (aggr / 100) * 0.6;

  const offsets = [move * 0.5, move * 1.0, move * 1.6 * stretchFactor];
  const sizes: [number, number, number] =
    aggr > 70 ? [25, 30, 45] : aggr < 30 ? [50, 30, 20] : [40, 35, 25];

  const levels: TakeProfitLevel[] = offsets.map((o, idx) => ({
    label: (["T1", "T2", "T3"] as const)[idx],
    sizePct: sizes[idx],
    price: +((i.side === "long" ? i.entryPrice * (1 + o / 100) : i.entryPrice * (1 - o / 100))).toFixed(4),
  }));

  const protection = {
    trigger: levels[0].price,
    lockInPct: 40,
  };

  return { levels, protection, rationale: `Move ${move.toFixed(2)}% · aggr ${aggr}` };
}
