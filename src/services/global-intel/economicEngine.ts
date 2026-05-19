import type { EconEvent, RawSignal, Bias } from "./types";

const IMPACT_MAP: Record<EconEvent["indicator"], (surprise: number) => Bias> = {
  CPI: (s) => (s > 0.2 ? "bearish" : s < -0.2 ? "bullish" : "neutral"),
  GDP: (s) => (s > 0.1 ? "bullish" : s < -0.1 ? "bearish" : "neutral"),
  UNEMPLOYMENT: (s) => (s > 0.1 ? "bearish" : s < -0.1 ? "bullish" : "neutral"),
  RATE: (s) => (s > 0 ? "bearish" : s < 0 ? "bullish" : "neutral"),
  OIL_INV: (s) => (s > 0 ? "bearish" : "bullish"),
  BOND_10Y: (s) => (s > 0 ? "bearish" : "bullish"),
  INFLATION: (s) => (s > 0.1 ? "bearish" : s < -0.1 ? "bullish" : "neutral"),
};

export function processEconomic(signals: RawSignal[]): EconEvent[] {
  const econ = signals.filter((s) => s.category === "economic");
  const out: EconEvent[] = [];
  for (const s of econ) {
    const indicator = (s.payload?.indicator as EconEvent["indicator"]) ?? "CPI";
    const value = Number(s.payload?.value ?? 0);
    const surprise = Number(s.payload?.surprise ?? 0);
    const impact = (IMPACT_MAP[indicator] ?? IMPACT_MAP.CPI)(surprise);
    out.push({
      id: `${s.source}-${indicator}-${s.ts}`,
      indicator, region: s.region ?? "GLOBAL", value, surprise, marketImpact: impact, ts: s.ts,
    });
  }
  return out;
}
