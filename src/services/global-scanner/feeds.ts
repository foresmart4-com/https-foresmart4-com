// Synthetic deterministic feed aggregator. In production this would tap into
// live providers; for now it produces a realistic multi-domain stream so the
// scanner runs end-to-end without external dependencies.
import type { RawFeed, Bias } from "./types";

const EQUITIES = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "AMZN"];
const CRYPTO = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const FOREX = ["EURUSD", "USDJPY", "GBPUSD", "DXY"];
const COMMODITIES = ["GOLD", "SILVER", "WTI", "BRENT", "NATGAS", "WHEAT", "CORN"];

const REGIONS = ["United States", "China", "Eurozone", "Middle East", "Russia", "Japan", "Brazil"];
const CB_SPEAKERS = ["Powell", "Lagarde", "Ueda", "Bailey", "Macklem"];

function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }
function rngFactory(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function bias(rng: () => number): Bias {
  const r = rng();
  return r < 0.4 ? "bullish" : r < 0.75 ? "bearish" : "neutral";
}

export async function ingestAllFeeds(now = Date.now()): Promise<{ feeds: RawFeed[]; latencyMs: number; sources: string[] }> {
  const t0 = performance.now();
  // Seed by quarter-hour bucket so successive calls within 15 min are stable.
  const rng = rngFactory(Math.floor(now / 9e5));
  const feeds: RawFeed[] = [];

  const push = (f: Omit<RawFeed, "id" | "ts">) => {
    const id = `${f.source}-${f.category}-${(f.symbol ?? "x").toLowerCase()}-${feeds.length}`;
    feeds.push({ ...f, id, ts: now - Math.floor(rng() * 25) * 60_000 });
  };

  for (const s of EQUITIES) push({
    source: "equity-tape", category: "equities", symbol: s,
    headline: `${s} intraday tape`, importance: 0.4 + rng() * 0.5, bias: bias(rng),
    payload: { changePct: +(rng() * 4 - 2).toFixed(2), volZ: +(rng() * 3).toFixed(2) },
  });
  for (const s of CRYPTO) push({
    source: "crypto-aggregator", category: "crypto", symbol: s,
    headline: `${s} cross-exchange composite`, importance: 0.5 + rng() * 0.4, bias: bias(rng),
    payload: { changePct: +(rng() * 6 - 3).toFixed(2), fundingBps: +(rng() * 20 - 10).toFixed(1) },
  });
  for (const s of FOREX) push({
    source: "fx-feed", category: "forex", symbol: s,
    headline: `${s} session move`, importance: 0.3 + rng() * 0.5, bias: bias(rng),
    payload: { changePct: +(rng() * 1.2 - 0.6).toFixed(3) },
  });
  for (const s of COMMODITIES) push({
    source: "commodities-feed", category: "commodities", symbol: s,
    headline: `${s} spot composite`, importance: 0.4 + rng() * 0.5, bias: bias(rng),
    payload: { changePct: +(rng() * 3 - 1.5).toFixed(2) },
  });

  // Macro prints
  for (const ev of ["CPI", "NFP", "PMI", "Retail Sales"]) {
    if (rng() > 0.55) push({
      source: "macro-calendar", category: "macro",
      headline: `${ev} release surprise`,
      importance: 0.6 + rng() * 0.4, bias: bias(rng),
      payload: { surprise: +(rng() * 2 - 1).toFixed(2) },
    });
  }

  // Earnings
  for (const s of EQUITIES) if (rng() > 0.75) push({
    source: "earnings-wire", category: "earnings", symbol: s,
    headline: `${s} earnings beat/miss`,
    importance: 0.55 + rng() * 0.4, bias: bias(rng),
    payload: { epsSurprisePct: +(rng() * 20 - 10).toFixed(2) },
  });

  // CB speeches
  if (rng() > 0.5) push({
    source: "central-bank-wire", category: "cb_speech",
    headline: `${pick(CB_SPEAKERS, rng)} hints at policy stance shift`,
    importance: 0.65 + rng() * 0.3, bias: bias(rng),
  });

  // Geopolitical
  for (let i = 0; i < 2; i++) if (rng() > 0.4) push({
    source: "geopolitical-wire", category: "geopolitical",
    headline: `${pick(REGIONS, rng)}: tensions escalate around energy corridor`,
    importance: 0.5 + rng() * 0.5, bias: bias(rng),
    payload: { region: pick(REGIONS, rng) },
  });

  // Weather disruptions
  if (rng() > 0.55) push({
    source: "weather-wire", category: "weather",
    headline: `Storm system threatens Gulf production`,
    importance: 0.45 + rng() * 0.4, bias: "bullish",
    payload: { affected: "WTI,NATGAS" },
  });

  // Breaking news
  for (let i = 0; i < 3; i++) if (rng() > 0.45) push({
    source: "newswire", category: "breaking_news",
    headline: `Headline ${i + 1}: market-moving development reported`,
    importance: 0.4 + rng() * 0.5, bias: bias(rng),
  });

  const sources = Array.from(new Set(feeds.map((f) => f.source)));
  return { feeds, latencyMs: performance.now() - t0, sources };
}
