// Provider registry — declarative description of each data source.
import type { AssetClass, SourceKind } from "./types";

export interface ProviderSpec {
  id: string;
  label: string;
  kind: SourceKind;
  assetClasses: AssetClass[];
  priority: number;            // higher = preferred
  staleAfterMs: number;        // datum considered stale after this
  pollMs?: number;             // for polling providers
  baseLatencyMs: number;       // expected latency (for simulator + scoring)
  reliability: number;         // 0..1 baseline reliability
}

export const PROVIDERS: ProviderSpec[] = [
  { id: "binance",       label: "Binance",        kind: "websocket", assetClasses: ["crypto"],                  priority: 90, staleAfterMs: 4_000,  baseLatencyMs: 35,  reliability: 0.98 },
  { id: "coinbase",      label: "Coinbase",       kind: "websocket", assetClasses: ["crypto"],                  priority: 80, staleAfterMs: 5_000,  baseLatencyMs: 60,  reliability: 0.97 },
  { id: "kraken",        label: "Kraken",         kind: "polling",   assetClasses: ["crypto"],                  priority: 60, pollMs: 2_000, staleAfterMs: 6_000, baseLatencyMs: 120, reliability: 0.94 },
  { id: "polygon",       label: "Polygon.io",     kind: "websocket", assetClasses: ["equity", "etf"],           priority: 90, staleAfterMs: 5_000,  baseLatencyMs: 80,  reliability: 0.97 },
  { id: "iex",           label: "IEX Cloud",      kind: "polling",   assetClasses: ["equity", "etf"],           priority: 70, pollMs: 3_000, staleAfterMs: 8_000, baseLatencyMs: 150, reliability: 0.95 },
  { id: "alpaca",        label: "Alpaca",         kind: "websocket", assetClasses: ["equity", "etf", "crypto"], priority: 75, staleAfterMs: 6_000,  baseLatencyMs: 90,  reliability: 0.95 },
  { id: "oanda",         label: "OANDA",          kind: "websocket", assetClasses: ["forex", "commodity"],      priority: 85, staleAfterMs: 5_000,  baseLatencyMs: 70,  reliability: 0.97 },
  { id: "fxcm",          label: "FXCM",           kind: "polling",   assetClasses: ["forex"],                   priority: 65, pollMs: 2_000, staleAfterMs: 6_000, baseLatencyMs: 140, reliability: 0.93 },
  { id: "twelvedata",    label: "TwelveData",     kind: "polling",   assetClasses: ["equity", "forex", "etf", "commodity"], priority: 55, pollMs: 5_000, staleAfterMs: 12_000, baseLatencyMs: 220, reliability: 0.92 },
  { id: "lme",           label: "LME Feed",       kind: "polling",   assetClasses: ["commodity"],               priority: 70, pollMs: 4_000, staleAfterMs: 12_000, baseLatencyMs: 200, reliability: 0.93 },
];

export function providersFor(assetClass: AssetClass): ProviderSpec[] {
  return PROVIDERS
    .filter((p) => p.assetClasses.includes(assetClass))
    .sort((a, b) => b.priority - a.priority);
}

export function getProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
