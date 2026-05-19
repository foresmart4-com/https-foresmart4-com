// Cross-market correlation and institutional flow detection (synthetic but
// deterministic over a stable seed so the UI is meaningful in demo mode).
import type { CorrelationLink, FlowSignal, RawFeed } from "./types";

const CORR_MAP: Record<string, Array<{ partner: string; correlation: number; meaning: string }>> = {
  BTCUSDT: [
    { partner: "ETHUSDT", correlation: 0.84, meaning: "Crypto beta cluster" },
    { partner: "QQQ", correlation: 0.42, meaning: "Risk-on tech alignment" },
    { partner: "DXY", correlation: -0.38, meaning: "Inverse to USD strength" },
  ],
  ETHUSDT: [
    { partner: "BTCUSDT", correlation: 0.84, meaning: "Crypto beta cluster" },
    { partner: "QQQ", correlation: 0.46, meaning: "Risk-on tech alignment" },
  ],
  SPY: [
    { partner: "QQQ", correlation: 0.92, meaning: "US large-cap proxy" },
    { partner: "DXY", correlation: -0.28, meaning: "Inverse to dollar" },
  ],
  QQQ: [
    { partner: "NVDA", correlation: 0.74, meaning: "AI mega-cap driver" },
    { partner: "BTCUSDT", correlation: 0.42, meaning: "Risk-on alignment" },
  ],
  GOLD: [
    { partner: "DXY", correlation: -0.55, meaning: "Classic inverse-dollar" },
    { partner: "WTI", correlation: 0.25, meaning: "Commodity reflation" },
  ],
  WTI: [
    { partner: "BRENT", correlation: 0.97, meaning: "Crude benchmark twin" },
    { partner: "NATGAS", correlation: 0.32, meaning: "Energy complex" },
  ],
  EURUSD: [
    { partner: "DXY", correlation: -0.95, meaning: "Mechanical inverse of DXY" },
  ],
};

export function correlationsFor(symbol: string): CorrelationLink[] {
  const base = CORR_MAP[symbol] ?? [];
  return base.map((c) => ({ symbol, ...c }));
}

/** Detect "institutional flow" proxy from volume z-score / funding / surprise signals. */
export function detectFlow(symbol: string, feeds: RawFeed[]): FlowSignal | null {
  const related = feeds.filter((f) => f.symbol === symbol);
  if (!related.length) return null;
  const volZ = Number(related[0].payload?.volZ ?? 0);
  const change = Number(related[0].payload?.changePct ?? 0);
  const funding = Number(related[0].payload?.fundingBps ?? 0);
  const surprise = related.reduce((s, f) => s + Number(f.payload?.surprise ?? 0), 0);
  const raw = volZ * 0.35 + Math.tanh(change / 2) * 0.4 + Math.tanh(funding / 12) * 0.15 + Math.tanh(surprise) * 0.1;
  const netFlow = Math.max(-1, Math.min(1, +raw.toFixed(2)));
  if (Math.abs(netFlow) < 0.15) return null;
  const drivers: string[] = [];
  if (Math.abs(volZ) > 1.5) drivers.push(`volume z=${volZ.toFixed(1)}`);
  if (Math.abs(change) > 1) drivers.push(`tape ${change > 0 ? "+" : ""}${change.toFixed(2)}%`);
  if (Math.abs(funding) > 5) drivers.push(`funding ${funding.toFixed(1)}bps`);
  if (Math.abs(surprise) > 0.5) drivers.push("macro surprise stacking");
  return {
    symbol, netFlow,
    conviction: Math.min(1, Math.abs(netFlow) + 0.2),
    drivers,
  };
}
