import { routeQuote, resolveAsset } from "./router";

export interface MarketSnapshot {
  id: string;
  timestamp: string;
  symbols: SnapshotEntry[];
  providerHealth: Record<string, string>;
}

export interface SnapshotEntry {
  symbol: string;
  provider: string | null;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;
  dataMode: string;
  assetClass: string;
  success: boolean;
}

const SNAPSHOT_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "2222.SR", "1120.SR",
  "BTCUSDT", "ETHUSDT", "XAUUSD", "WTI", "EURUSD",
  "0700.HK", "HSBA.L", "SAP.DE",
];

const snapshots: MarketSnapshot[] = [];

export async function runMarketSnapshot(): Promise<MarketSnapshot> {
  const entries: SnapshotEntry[] = [];
  for (const sym of SNAPSHOT_SYMBOLS) {
    try {
      const resolved = resolveAsset(sym);
      const q = await routeQuote(sym);
      entries.push({
        symbol: sym, provider: q.provider, price: q.price,
        changePercent: q.changePercent, volume: q.volume,
        timestamp: q.timestamp, dataMode: q.mode,
        assetClass: resolved.assetClass, success: q.success,
      });
    } catch {
      entries.push({
        symbol: sym, provider: null, price: null,
        changePercent: null, volume: null,
        timestamp: Date.now(), dataMode: "error",
        assetClass: resolveAsset(sym).assetClass, success: false,
      });
    }
  }

  const snapshot: MarketSnapshot = {
    id: `SNAP-${Date.now()}`,
    timestamp: new Date().toISOString(),
    symbols: entries,
    providerHealth: {},
  };
  snapshots.unshift(snapshot);
  if (snapshots.length > 100) snapshots.length = 100;
  return snapshot;
}

export function getLatestSnapshot(): MarketSnapshot | null {
  return snapshots[0] ?? null;
}

export function getSnapshotHistory(period: "daily" | "monthly" = "daily", limit = 30): MarketSnapshot[] {
  return snapshots.slice(0, limit);
}
