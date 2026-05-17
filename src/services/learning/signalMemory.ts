// Signal memory — lightweight ring buffer of recently generated signals with
// follow-up performance evaluation. Persists to localStorage when available.
import type { Signal } from "@/services/signals/signalEngine";
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export interface SignalMemoryEntry {
  id: string;
  asset: AssetKey;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  risk: number;
  regime: string;
  sentiment: number;
  volatility: number;
  entryPrice: number;
  timestamp: number;
  // Filled in on subsequent updates
  followPrice?: number;
  followTimestamp?: number;
  pnlPct?: number;
  outcome?: "success" | "failure" | "neutral" | "pending";
}

const KEY = "foresmart.signal.memory.v1";
const MAX = 200;
let mem: SignalMemoryEntry[] = [];
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) mem = JSON.parse(raw) as SignalMemoryEntry[];
  } catch { /* ignore */ }
}

function persist() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(mem.slice(-MAX))); } catch { /* ignore */ }
}

function evaluate(entry: SignalMemoryEntry): SignalMemoryEntry["outcome"] {
  if (entry.pnlPct == null) return "pending";
  const dir = entry.action === "BUY" ? 1 : entry.action === "SELL" ? -1 : 0;
  if (dir === 0) return Math.abs(entry.pnlPct) < 0.5 ? "neutral" : "failure";
  const adj = entry.pnlPct * dir;
  if (adj >= 0.5) return "success";
  if (adj <= -0.5) return "failure";
  return "neutral";
}

export function recordSignals(
  signals: Signal[],
  quotes: MarketQuote[],
  regime: RegimeReport,
  sentiment: MarketSentimentScore,
): void {
  load();
  const quoteMap = new Map(quotes.map((q) => [q.key, q]));
  const now = Date.now();

  // Update follow-up performance for entries older than ~2 min
  for (const e of mem) {
    if (e.outcome && e.outcome !== "pending") continue;
    const q = quoteMap.get(e.asset);
    if (!q) continue;
    if (now - e.timestamp < 2 * 60_000) continue;
    e.followPrice = q.price;
    e.followTimestamp = now;
    e.pnlPct = +(((q.price - e.entryPrice) / e.entryPrice) * 100).toFixed(3);
    e.outcome = evaluate(e);
  }

  // Add new signals (avoid duplicates within 5 min for same asset+action)
  for (const s of signals) {
    const q = quoteMap.get(s.asset);
    if (!q) continue;
    const recent = mem.find(
      (e) => e.asset === s.asset && e.action === s.action && now - e.timestamp < 5 * 60_000,
    );
    if (recent) continue;
    mem.push({
      id: `${s.asset}-${s.action}-${now}-${Math.random().toString(36).slice(2, 6)}`,
      asset: s.asset, action: s.action,
      confidence: s.confidence, risk: s.risk,
      regime: regime.regime, sentiment: sentiment.score,
      volatility: q.volatility, entryPrice: q.price,
      timestamp: now, outcome: "pending",
    });
  }

  if (mem.length > MAX) mem = mem.slice(-MAX);
  persist();
}

export function getMemory(): SignalMemoryEntry[] {
  load();
  return [...mem];
}

export interface MemoryStats {
  total: number;
  evaluated: number;
  successes: number;
  failures: number;
  winRate: number;
  byRegime: Array<{ regime: string; count: number; winRate: number }>;
  byVolBucket: Array<{ bucket: string; count: number; winRate: number }>;
  byAsset: Array<{ asset: AssetKey; count: number; winRate: number }>;
}

function bucketVol(v: number): string {
  if (v < 30) return "Low";
  if (v < 60) return "Medium";
  return "High";
}

export function computeStats(): MemoryStats {
  load();
  const evaluated = mem.filter((e) => e.outcome && e.outcome !== "pending");
  const successes = evaluated.filter((e) => e.outcome === "success").length;
  const failures = evaluated.filter((e) => e.outcome === "failure").length;
  const winRate = evaluated.length ? Math.round((successes / evaluated.length) * 100) : 0;

  function group<K extends string>(picker: (e: SignalMemoryEntry) => K) {
    const map = new Map<K, { count: number; success: number }>();
    for (const e of evaluated) {
      const k = picker(e);
      const cur = map.get(k) ?? { count: 0, success: 0 };
      cur.count++;
      if (e.outcome === "success") cur.success++;
      map.set(k, cur);
    }
    return [...map.entries()].map(([k, v]) => ({
      key: k, count: v.count,
      winRate: v.count ? Math.round((v.success / v.count) * 100) : 0,
    }));
  }

  return {
    total: mem.length, evaluated: evaluated.length, successes, failures, winRate,
    byRegime: group((e) => e.regime).map((g) => ({ regime: g.key, count: g.count, winRate: g.winRate })),
    byVolBucket: group((e) => bucketVol(e.volatility)).map((g) => ({ bucket: g.key, count: g.count, winRate: g.winRate })),
    byAsset: group((e) => e.asset).map((g) => ({ asset: g.key, count: g.count, winRate: g.winRate })),
  };
}

export function clearMemory() {
  mem = [];
  persist();
}
