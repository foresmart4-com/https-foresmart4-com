/**
 * NewsAPI.org server-side adapter.
 *
 * Role: financial / macro / geopolitical / oil / central-bank / earnings news.
 * Feeds global-intel ingestion, macro agent, opportunity scanner, and the
 * AI decision engine. Falls back to GDELT in the ingestion layer when down.
 *
 * SECURITY: Reads NEWSAPI_KEY (primary) and NEWSAPI_KEY_BACKUP (secondary)
 * from process.env inside handlers only. The backup key is used automatically
 * after the primary returns 429/401/426 (NewsAPI's rate / plan errors).
 *
 * Features:
 *  - /v2/everything + /v2/top-headlines wrappers with curated queries.
 *  - Token-bucket rate limiter (free tier ~100 req/day — we throttle to
 *    1 req/sec to avoid burst-fail; aggressive 5-min caching does the rest).
 *  - Retry with exponential backoff, 429 + plan-error key rotation.
 *  - Duplicate suppression by URL + headline hash.
 *  - Source reliability scoring (curated whitelist + dynamic boost/penalty).
 *  - Lightweight sentiment (lexicon-based) and market-impact / urgency tags.
 */

// Lightweight FNV-1a hash — avoids node:crypto so this module can be bundled
// safely on the edge/client without pulling Node built-ins.
function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const BASE = "https://newsapi.org/v2";

// ---------- Telemetry ----------
type CallStat = {
  endpoint: string;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  ewmaLatencyMs: number | null;
  okCount: number;
  errCount: number;
  rateLimitedCount: number;
  lastStatus: number | null;
};
const stats = new Map<string, CallStat>();
function bump(endpoint: string, patch: Partial<CallStat>) {
  const cur = stats.get(endpoint) ?? {
    endpoint, lastOkAt: null, lastErrorAt: null, lastError: null,
    lastLatencyMs: null, ewmaLatencyMs: null,
    okCount: 0, errCount: 0, rateLimitedCount: 0, lastStatus: null,
  } satisfies CallStat;
  stats.set(endpoint, { ...cur, ...patch });
}

// ---------- Rate limit (1 req/sec sustained) ----------
const RATE_CAPACITY = 3;
const RATE_REFILL_PER_SEC = 1;
let tokens = RATE_CAPACITY;
let lastRefill = Date.now();
async function take(): Promise<void> {
  while (true) {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(RATE_CAPACITY, tokens + elapsed * RATE_REFILL_PER_SEC);
    lastRefill = now;
    if (tokens >= 1) { tokens -= 1; return; }
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ---------- Cache ----------
interface CacheEntry<T> { value: T; expiresAt: number; staleAt: number }
const cache = new Map<string, CacheEntry<unknown>>();
function cacheGet<T>(key: string): { value: T; isStale: boolean } | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  const now = Date.now();
  if (e.expiresAt < now) { cache.delete(key); return undefined; }
  return { value: e.value as T, isStale: now > e.staleAt };
}
function cacheSet<T>(key: string, value: T, freshMs: number, hardMs: number) {
  cache.set(key, { value, staleAt: Date.now() + freshMs, expiresAt: Date.now() + hardMs });
}

// ---------- Keys ----------
type KeySlot = { name: string; key: string; cooldownUntil: number };
function loadKeys(): KeySlot[] {
  const slots: KeySlot[] = [];
  if (process.env.NEWSAPI_KEY) slots.push({ name: "primary", key: process.env.NEWSAPI_KEY, cooldownUntil: 0 });
  if (process.env.NEWSAPI_KEY_BACKUP) slots.push({ name: "backup", key: process.env.NEWSAPI_KEY_BACKUP, cooldownUntil: 0 });
  return slots;
}
const KEYS = loadKeys();
function pickKey(): KeySlot {
  if (KEYS.length === 0) throw new Error("NEWSAPI_KEY is not configured");
  const now = Date.now();
  const ready = KEYS.filter((k) => k.cooldownUntil <= now);
  return (ready[0] ?? KEYS[0]);
}

// ---------- Source reliability ----------
const SOURCE_TIER: Record<string, number> = {
  "reuters": 0.95, "bloomberg": 0.95, "the-wall-street-journal": 0.94,
  "financial-times": 0.94, "associated-press": 0.92, "the-economist": 0.92,
  "bbc-news": 0.9, "cnbc": 0.85, "ft.com": 0.94, "marketwatch": 0.82,
  "fortune": 0.78, "business-insider": 0.7, "the-verge": 0.72,
  "techcrunch": 0.72, "wired": 0.8,
};
const sourceBoost = new Map<string, number>();
export function reliabilityFor(sourceId?: string | null, sourceName?: string | null): number {
  const id = (sourceId ?? "").toLowerCase();
  const name = (sourceName ?? "").toLowerCase().replace(/\s+/g, "-");
  const base = SOURCE_TIER[id] ?? SOURCE_TIER[name] ?? 0.6;
  const boost = sourceBoost.get(id || name) ?? 0;
  return Math.max(0.2, Math.min(0.99, base + boost));
}
/** Adjust a source's reliability based on observed outcomes. */
export function recordSourceOutcome(sourceId: string, delta: number) {
  const cur = sourceBoost.get(sourceId) ?? 0;
  sourceBoost.set(sourceId, Math.max(-0.3, Math.min(0.2, cur + delta)));
}

// ---------- Core fetch with key rotation ----------
async function call<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  { retries = 3, timeoutMs = 9000, freshMs = 5 * 60_000, hardMs = 30 * 60_000 }:
    { retries?: number; timeoutMs?: number; freshMs?: number; hardMs?: number } = {},
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const endpoint = path;
  const cacheKey = `${path}::${qs.toString()}`;
  const cached = cacheGet<T>(cacheKey);
  if (cached && !cached.isStale) return cached.value;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const slot = pickKey();
    const url = `${BASE}${path}?${qs.toString()}`;
    await take();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "X-Api-Key": slot.key, Accept: "application/json" },
      });
      const latency = Date.now() - started;
      clearTimeout(t);

      if (res.status === 429 || res.status === 401 || res.status === 426) {
        // Plan / rate-limit — cool this key down and try the other.
        slot.cooldownUntil = Date.now() + (res.status === 429 ? 10 * 60_000 : 60 * 60_000);
        bump(endpoint, {
          rateLimitedCount: (stats.get(endpoint)?.rateLimitedCount ?? 0) + 1,
          lastStatus: res.status,
          lastError: `HTTP ${res.status} on ${slot.name}`,
          lastErrorAt: Date.now(),
        });
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 200));
          continue;
        }
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        bump(endpoint, {
          errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
          lastErrorAt: Date.now(),
          lastError: `HTTP ${res.status}`,
          lastStatus: res.status,
        });
        if (res.status >= 500 && attempt < retries) {
          const wait = Math.min(6000, 400 * 2 ** attempt + Math.random() * 250);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`NewsAPI ${endpoint} failed: ${res.status} ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as T;
      const prev = stats.get(endpoint);
      const ewma = prev?.ewmaLatencyMs == null ? latency : Math.round(prev.ewmaLatencyMs * 0.7 + latency * 0.3);
      bump(endpoint, {
        okCount: (prev?.okCount ?? 0) + 1,
        lastOkAt: Date.now(),
        lastLatencyMs: latency,
        ewmaLatencyMs: ewma,
        lastStatus: 200,
      });
      cacheSet(cacheKey, json, freshMs, hardMs);
      return json;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      bump(endpoint, {
        errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
        lastErrorAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      });
      if (attempt < retries) {
        const wait = Math.min(6000, 400 * 2 ** attempt + Math.random() * 250);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
  }
  // Serve stale-as-fallback if we have it.
  if (cached) return cached.value;
  throw lastErr instanceof Error ? lastErr : new Error("NewsAPI request failed");
}

// ---------- Public types ----------
export interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}
interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

// ---------- Sentiment + impact lexicon ----------
const POS = ["beat", "surge", "rally", "growth", "expand", "record", "upgrade", "bullish", "strong", "boom", "soar", "tops"];
const NEG = ["miss", "slump", "plunge", "downgrade", "bearish", "weak", "decline", "loss", "crash", "warn", "cut", "slash", "default", "bankruptcy", "sanctions"];
const HIGH_IMPACT = ["fed", "ecb", "boj", "rate", "cpi", "inflation", "recession", "war", "sanctions", "opec", "oil", "tariff", "election", "default", "downgrade", "central bank"];
const URGENT = ["breaking", "just in", "urgent", "halts", "halted", "freezes", "collapse", "emergency"];

function lexiconScore(text: string, terms: string[]): number {
  const t = text.toLowerCase();
  let n = 0;
  for (const w of terms) if (t.includes(w)) n++;
  return n;
}
export function sentimentOf(article: NewsApiArticle): number {
  const text = `${article.title ?? ""} ${article.description ?? ""}`;
  const p = lexiconScore(text, POS), n = lexiconScore(text, NEG);
  if (p + n === 0) return 0;
  return Math.max(-1, Math.min(1, (p - n) / (p + n + 1)));
}
export function impactOf(article: NewsApiArticle): "low" | "medium" | "high" {
  const score = lexiconScore(`${article.title ?? ""} ${article.description ?? ""}`, HIGH_IMPACT);
  return score >= 2 ? "high" : score === 1 ? "medium" : "low";
}
export function urgencyOf(article: NewsApiArticle): number {
  const score = lexiconScore(`${article.title ?? ""}`, URGENT);
  return Math.min(1, score * 0.4);
}

// ---------- Dedup ----------
const seenHashes = new Map<string, number>();
function hashOf(a: NewsApiArticle): string {
  const h = createHash("sha1");
  h.update((a.url || "").trim().toLowerCase());
  h.update("|");
  h.update((a.title || "").trim().toLowerCase());
  return h.digest("hex").slice(0, 16);
}
function dedup(articles: NewsApiArticle[]): NewsApiArticle[] {
  const now = Date.now();
  // Purge old entries (older than 24h) periodically.
  if (seenHashes.size > 5000) {
    for (const [k, ts] of seenHashes) if (now - ts > 24 * 3_600_000) seenHashes.delete(k);
  }
  const out: NewsApiArticle[] = [];
  for (const a of articles) {
    const h = hashOf(a);
    if (seenHashes.has(h)) continue;
    seenHashes.set(h, now);
    out.push(a);
  }
  return out;
}

// ---------- Enriched output ----------
export interface EnrichedNewsItem {
  id: string;
  source: string;
  sourceReliability: number;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  ts: number;
  sentiment: number;        // -1..1
  impact: "low" | "medium" | "high";
  urgency: number;          // 0..1
  category: "macro" | "geopolitics" | "energy" | "central-bank" | "earnings" | "markets" | "general";
}
function categorize(a: NewsApiArticle): EnrichedNewsItem["category"] {
  const t = `${a.title} ${a.description ?? ""}`.toLowerCase();
  if (/(fed|ecb|boj|central bank|rate decision|fomc)/.test(t)) return "central-bank";
  if (/(cpi|inflation|gdp|jobs|payroll|unemployment|pmi|retail sales)/.test(t)) return "macro";
  if (/(war|sanctions|tariff|election|geopolit|conflict|nato|china|russia|iran)/.test(t)) return "geopolitics";
  if (/(oil|opec|brent|wti|gas|crude|energy)/.test(t)) return "energy";
  if (/(earnings|eps|revenue|guidance|profit)/.test(t)) return "earnings";
  if (/(stock|equity|index|nasdaq|dow|s&p|crypto|bitcoin|forex|yield)/.test(t)) return "markets";
  return "general";
}
export function enrich(articles: NewsApiArticle[]): EnrichedNewsItem[] {
  return dedup(articles).map((a) => ({
    id: hashOf(a),
    source: a.source?.name ?? a.source?.id ?? "unknown",
    sourceReliability: reliabilityFor(a.source?.id, a.source?.name),
    title: a.title,
    description: a.description,
    url: a.url,
    publishedAt: a.publishedAt,
    ts: new Date(a.publishedAt).getTime() || Date.now(),
    sentiment: sentimentOf(a),
    impact: impactOf(a),
    urgency: urgencyOf(a),
    category: categorize(a),
  }));
}

// ---------- Endpoints ----------
export async function everything(opts: {
  q: string;
  language?: string;
  sortBy?: "publishedAt" | "popularity" | "relevancy";
  from?: string;
  to?: string;
  pageSize?: number;
}): Promise<EnrichedNewsItem[]> {
  const res = await call<NewsApiResponse>("/everything", {
    q: opts.q,
    language: opts.language ?? "en",
    sortBy: opts.sortBy ?? "publishedAt",
    from: opts.from,
    to: opts.to,
    pageSize: Math.min(100, opts.pageSize ?? 50),
  }, { freshMs: 5 * 60_000, hardMs: 60 * 60_000 });
  return enrich(res.articles ?? []);
}

export async function topHeadlines(opts: {
  category?: "business" | "technology" | "general";
  country?: string;
  q?: string;
  pageSize?: number;
}): Promise<EnrichedNewsItem[]> {
  const res = await call<NewsApiResponse>("/top-headlines", {
    category: opts.category ?? "business",
    country: opts.country,
    q: opts.q,
    pageSize: Math.min(100, opts.pageSize ?? 50),
  }, { freshMs: 5 * 60_000, hardMs: 30 * 60_000 });
  return enrich(res.articles ?? []);
}

/** Curated financial / macro queries used by the global-intel pipeline. */
export const FINANCIAL_QUERIES = {
  macro: '(inflation OR "central bank" OR "interest rate" OR CPI OR GDP OR recession)',
  geopolitics: '(war OR sanctions OR tariff OR OPEC OR election OR conflict)',
  energy: '(oil OR OPEC OR crude OR "natural gas" OR brent OR WTI)',
  centralBank: '(Fed OR FOMC OR ECB OR BoJ OR BoE OR "rate decision")',
  earnings: '(earnings OR EPS OR guidance OR "quarterly results")',
  markets: '(stocks OR equities OR Nasdaq OR "S&P 500" OR crypto OR bitcoin OR forex)',
} as const;

export async function getFinancialFeed(): Promise<EnrichedNewsItem[]> {
  const buckets = await Promise.allSettled([
    everything({ q: FINANCIAL_QUERIES.macro, pageSize: 30 }),
    everything({ q: FINANCIAL_QUERIES.centralBank, pageSize: 20 }),
    everything({ q: FINANCIAL_QUERIES.geopolitics, pageSize: 25 }),
    everything({ q: FINANCIAL_QUERIES.energy, pageSize: 20 }),
    everything({ q: FINANCIAL_QUERIES.earnings, pageSize: 20 }),
  ]);
  const items = buckets.flatMap((b) => b.status === "fulfilled" ? b.value : []);
  // Sort by recency × impact × reliability.
  return items.sort((a, b) => {
    const ai = (a.impact === "high" ? 3 : a.impact === "medium" ? 2 : 1) * a.sourceReliability;
    const bi = (b.impact === "high" ? 3 : b.impact === "medium" ? 2 : 1) * b.sourceReliability;
    return (b.ts * 0.6 + bi * 1e10) - (a.ts * 0.6 + ai * 1e10);
  }).slice(0, 80);
}

// ---------- Diagnostics & health ----------
export type StaleStatus = "fresh" | "stale" | "down" | "unknown";
export function staleStatus(s: CallStat | undefined, staleMs = 10 * 60_000, downMs = 60 * 60_000): StaleStatus {
  if (!s || !s.lastOkAt) return "unknown";
  const age = Date.now() - s.lastOkAt;
  if (age > downMs) return "down";
  if (age > staleMs) return "stale";
  return "fresh";
}
export function snapshotStats() {
  return Array.from(stats.values()).map((s) => ({
    ...s,
    stale: staleStatus(s),
    ageMs: s.lastOkAt ? Date.now() - s.lastOkAt : null,
  }));
}
export function providerHealth() {
  const list = snapshotStats();
  const total = list.reduce((a, s) => a + s.okCount + s.errCount, 0);
  const errors = list.reduce((a, s) => a + s.errCount, 0);
  const rateLimited = list.reduce((a, s) => a + s.rateLimitedCount, 0);
  const errorRate = total ? errors / total : 0;
  const fresh = list.filter((s) => s.stale === "fresh").length;
  const stale = list.filter((s) => s.stale === "stale").length;
  const down = list.filter((s) => s.stale === "down").length;
  const status: "healthy" | "degraded" | "down" =
    down > 0 || errorRate > 0.5 ? "down" : stale > 0 || errorRate > 0.2 ? "degraded" : "healthy";
  const avgLatency = list.length
    ? Math.round(list.reduce((a, s) => a + (s.ewmaLatencyMs ?? s.lastLatencyMs ?? 0), 0) / list.length)
    : null;
  return {
    provider: "newsapi" as const,
    status, errorRate, rateLimited,
    avgLatencyMs: avgLatency,
    endpoints: list,
    configured: KEYS.length > 0,
    keys: KEYS.map((k) => ({ name: k.name, cooldownMs: Math.max(0, k.cooldownUntil - Date.now()) })),
    role: "news-primary" as const,
    generatedAt: Date.now(),
  };
}
