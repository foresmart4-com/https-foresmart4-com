// Liquidity flow — tracks capital rotation across asset buckets.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type FlowBias = "risk-on" | "risk-off" | "defensive" | "neutral";

export interface SectorFlow {
  sector: string;
  members: AssetKey[];
  flowScore: number; // -100..100
  share: number;     // 0-100 share of absolute flow
}

export interface LiquidityFlowReport {
  bias: FlowBias;
  cryptoInflow: number;       // -100..100
  defensiveRotation: number;  // 0-100
  riskOn: number;             // 0-100
  riskOff: number;            // 0-100
  strongestSector: string;
  weakestSector: string;
  concentration: number;      // 0-100  Herfindahl-like concentration
  sectors: SectorFlow[];
  note: string;
}

const SECTORS: Array<{ sector: string; members: AssetKey[]; kind: "risk" | "safe" | "macro" }> = [
  { sector: "Crypto",     members: ["BTC", "ETH"],  kind: "risk" },
  { sector: "Equities",   members: ["SPX", "NDX"],  kind: "risk" },
  { sector: "Safe Haven", members: ["XAU"],         kind: "safe" },
  { sector: "Dollar",     members: ["DXY"],         kind: "safe" },
  { sector: "Energy",     members: ["OIL"],         kind: "macro" },
];

export function analyzeLiquidityFlow(quotes: MarketQuote[]): LiquidityFlowReport {
  const map = new Map<AssetKey, MarketQuote>();
  quotes.forEach((q) => map.set(q.key, q));

  const sectors: SectorFlow[] = SECTORS.map(({ sector, members }) => {
    const vals = members.map((m) => map.get(m)?.changePct ?? 0);
    const avg = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
    return { sector, members, flowScore: +Math.max(-100, Math.min(100, avg * 12)).toFixed(1), share: 0 };
  });

  const totalAbs = sectors.reduce((s, x) => s + Math.abs(x.flowScore), 0) || 1;
  sectors.forEach((s) => (s.share = Math.round((Math.abs(s.flowScore) / totalAbs) * 100)));
  // Herfindahl concentration (0-100)
  const concentration = Math.round(sectors.reduce((s, x) => s + (x.share / 100) ** 2, 0) * 100);

  const flowOf = (name: string) => sectors.find((s) => s.sector === name)?.flowScore ?? 0;
  const cryptoInflow = Math.round(flowOf("Crypto"));
  const equities = flowOf("Equities");
  const safeHaven = flowOf("Safe Haven");
  const dollar = flowOf("Dollar");

  const riskOn = Math.max(0, Math.min(100, Math.round((cryptoInflow + equities) / 2 + 50)));
  const riskOff = Math.max(0, Math.min(100, Math.round((safeHaven + dollar) / 2 + 50)));
  const defensiveRotation = Math.max(0, Math.min(100, Math.round(riskOff - riskOn + 50)));

  let bias: FlowBias = "neutral";
  if (riskOn - riskOff > 12) bias = "risk-on";
  else if (riskOff - riskOn > 12) bias = "risk-off";
  else if (safeHaven > 5 && cryptoInflow < 0) bias = "defensive";

  const sorted = [...sectors].sort((a, b) => b.flowScore - a.flowScore);
  const strongestSector = sorted[0]?.sector ?? "—";
  const weakestSector = sorted[sorted.length - 1]?.sector ?? "—";

  const note = bias === "risk-on"
    ? `Capital rotating into ${strongestSector}; risk appetite improving.`
    : bias === "risk-off"
      ? `Defensive flow into ${strongestSector}; risk appetite contracting.`
      : bias === "defensive"
        ? `Quiet defensive rotation; ${strongestSector} accumulating bid.`
        : `Flows balanced; no decisive rotation signal.`;

  return {
    bias, cryptoInflow, defensiveRotation, riskOn, riskOff,
    strongestSector, weakestSector, concentration, sectors, note,
  };
}
