import type { WeatherEvent, RawSignal, Severity } from "./types";

function sev(score: number): Severity {
  if (score >= 0.85) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

export function processWeather(signals: RawSignal[]): WeatherEvent[] {
  return signals
    .filter((s) => s.category === "weather")
    .map((s) => {
      const severity = Number(s.payload?.severity ?? Math.random());
      const kind = (s.payload?.kind as WeatherEvent["kind"]) ?? "flood";
      const affects = (s.payload?.affects as string[]) ?? ["oil", "wheat"];
      return {
        id: `${s.source}-${kind}-${s.ts}`,
        kind,
        region: s.region ?? "GLOBAL",
        severity: sev(severity),
        supplyChainRisk: Math.min(1, severity * (kind === "hurricane" || kind === "freeze" ? 1.1 : 0.8)),
        affectedCommodities: affects,
        ts: s.ts,
      } satisfies WeatherEvent;
    });
}
