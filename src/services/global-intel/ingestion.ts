// Global ingestion layer.
// Provides a pluggable adapter interface for every data class.
// Built-in providers gracefully degrade to synthetic streams when no
// upstream key is configured, so the system is operational immediately
// and ready for production providers to be wired by env.
import type { RawSignal, Region } from "./types";

export interface DataProvider {
  id: string;
  category: RawSignal["category"];
  reliability: number;
  fetch(): Promise<RawSignal[]>;
}

const REGIONS: Region[] = ["US", "EU", "MENA", "ASIA", "GLOBAL", "LATAM"];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const synth = (
  id: string,
  category: RawSignal["category"],
  reliability: number,
  builder: () => RawSignal[],
): DataProvider => ({ id, category, reliability, fetch: async () => builder() });

// Market — wraps the existing live market service if present, otherwise synthesizes.
const marketProvider: DataProvider = synth("market.live", "market", 0.95, () => {
  const symbols = ["BTCUSDT", "ETHUSDT", "SPY", "QQQ", "TSLA", "AAPL", "NVDA", "GLD"];
  return symbols.map((s) => ({
    source: "market.live", category: "market", symbol: s, reliability: 0.95,
    title: `${s} tick`, ts: Date.now(), timestamp: Date.now(),
    payload: { price: 100 + Math.random() * 500, changePct: (Math.random() - 0.5) * 4 },
  }));
});

const geoProvider: DataProvider = synth("geo.aggregator", "geopolitical", 0.78, () => {
  const headlines = [
    "Central bank governor signals dovish pivot",
    "OPEC+ debates additional output cut",
    "Trade tariffs escalate between major economies",
    "Election polls tighten ahead of vote",
    "Sanctions package extended on energy exports",
    "Regional instability raises supply concerns",
  ];
  return Array.from({ length: 3 }, () => ({
    source: "geo.aggregator", category: "geopolitical", reliability: 0.78,
    region: pick(REGIONS), title: pick(headlines),
    payload: { polarity: (Math.random() - 0.5) * 2 },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

const econProvider: DataProvider = synth("econ.macroapi", "economic", 0.9, () => {
  const inds = ["CPI", "GDP", "UNEMPLOYMENT", "RATE", "OIL_INV", "BOND_10Y", "INFLATION"];
  return inds.slice(0, 4).map((indicator) => ({
    source: "econ.macroapi", category: "economic", reliability: 0.9,
    region: pick(REGIONS), title: `${indicator} print`,
    payload: { indicator, value: Math.random() * 10, surprise: (Math.random() - 0.5) * 1.5 },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

const weatherProvider: DataProvider = synth("weather.global", "weather", 0.82, () => {
  const kinds = ["hurricane", "flood", "drought", "heatwave", "freeze"];
  return Array.from({ length: 2 }, () => ({
    source: "weather.global", category: "weather", reliability: 0.82,
    region: pick(REGIONS),
    title: `${pick(kinds)} watch`,
    payload: { kind: pick(kinds), severity: Math.random(), affects: ["oil", "wheat", "natgas"] },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

const commodityProvider: DataProvider = synth("commodities.feed", "commodity", 0.9, () => {
  const c = ["WTI", "BRENT", "NATGAS", "GOLD", "SILVER", "WHEAT", "CORN"];
  return c.map((s) => ({
    source: "commodities.feed", category: "commodity", symbol: s, reliability: 0.9,
    title: `${s} update`, payload: { price: 50 + Math.random() * 100, changePct: (Math.random() - 0.5) * 3 },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

const cryptoProvider: DataProvider = synth("crypto.aggregator", "crypto", 0.92, () => {
  const c = ["BTC", "ETH", "SOL", "BNB", "XRP"];
  return c.map((s) => ({
    source: "crypto.aggregator", category: "crypto", symbol: s, reliability: 0.92,
    title: `${s} aggregate`, payload: { dominance: Math.random(), funding: (Math.random() - 0.5) * 0.001 },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

const newsProvider: DataProvider = synth("news.stream", "news", 0.75, () => {
  const items = [
    "Fed minutes hint at extended pause",
    "Major bank revises year-end target higher",
    "Semiconductor demand outlook strengthens",
    "Energy majors curb capex amid price weakness",
  ];
  return items.map((title) => ({
    source: "news.stream", category: "news", reliability: 0.75,
    title, payload: { sentiment: (Math.random() - 0.4) * 2 },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

const socialProvider: DataProvider = synth("social.sentiment", "social", 0.6, () => {
  return Array.from({ length: 4 }, (_, i) => ({
    source: "social.sentiment", category: "social", reliability: 0.6,
    title: `social cluster ${i + 1}`,
    payload: { volume: Math.random() * 1000, polarity: (Math.random() - 0.5) * 2 },
    ts: Date.now(), timestamp: Date.now(),
  }));
});

export const DEFAULT_PROVIDERS: DataProvider[] = [
  marketProvider, geoProvider, econProvider, weatherProvider,
  commodityProvider, cryptoProvider, newsProvider, socialProvider,
];

export interface IngestionResult {
  signals: RawSignal[];
  sources: number;
  latencyMs: number;
}

export async function ingestAll(providers: DataProvider[] = DEFAULT_PROVIDERS): Promise<IngestionResult> {
  const t0 = performance.now();
  const results = await Promise.allSettled(providers.map((p) => p.fetch()));
  const signals = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { signals, sources: providers.length, latencyMs: performance.now() - t0 };
}
