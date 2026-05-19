/**
 * GDELT 2.0 geopolitical intelligence provider.
 *
 * Public API — no key required. We hit the DOC 2.0 article-list endpoint,
 * parse headlines into structured geopolitical events, and score them for
 * conflict / sanctions / instability / commodity & supply-chain disruption.
 *
 * Architecture is fallback-safe: every helper degrades to an empty list and
 * the orchestrator can keep running on cached signals when GDELT is down.
 *
 * Browser-safe: pure parsing helpers + a thin `fetchGdeltDocs()` that uses
 * global `fetch`. The orchestrator should call this through a server fn
 * (`/lib/gdelt.functions.ts`) to avoid CORS noise on some clients.
 */

import type { RawSignal, Region, Severity, Bias } from "@/services/global-intel/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GdeltEventKind =
  | "protest" | "war" | "sanctions" | "election" | "diplomatic"
  | "military_escalation" | "shipping_disruption" | "energy_disruption"
  | "cyber" | "instability" | "trade" | "cb_speech" | "other";

export interface GdeltDoc {
  url: string;
  title: string;
  seendate?: string;           // YYYYMMDDTHHMMSSZ
  domain?: string;
  language?: string;
  sourcecountry?: string;
  tone?: number;               // GDELT tone -10..+10
  socialimage?: string;
}

export interface GdeltEvent {
  id: string;
  kind: GdeltEventKind;
  headline: string;
  region: Region;
  country?: string;
  severity: Severity;
  marketImpact: Bias;
  affected: string[];
  confidence: number;          // 0..1
  tone: number;                // normalized -1..+1
  escalationScore: number;     // 0..1 war escalation
  instabilityScore: number;    // 0..1 political instability
  commodityDisruption: number; // 0..1
  supplyChainRisk: number;     // 0..1
  source: string;              // domain
  url: string;
  language?: string;
  cluster: string;             // region|kind key
  ts: number;
}

export interface GdeltSnapshot {
  generatedAt: number;
  ok: boolean;
  error?: string;
  totalDocs: number;
  events: GdeltEvent[];
  byKind: Record<GdeltEventKind, number>;
  byRegion: Record<Region, number>;
  heatmap: Array<{ region: Region; intensity: number; count: number }>;
  conflictSeverity: number;     // 0..1
  macroRiskIndex: number;       // 0..1
  oilRisk: number;              // 0..1
  shippingRisk: number;         // 0..1
  sanctionsCount: number;
  topEvents: GdeltEvent[];      // ranked
  cacheAgeMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword / classification dictionaries (multilingual: en + ar + es/fr stems)
// ─────────────────────────────────────────────────────────────────────────────

const KIND_PATTERNS: Array<{
  kind: GdeltEventKind;
  match: RegExp;
  bias: Bias;
  affected: string[];
  baseSeverity: number;
}> = [
  { kind: "war",                 match: /\b(war|invasion|airstrike|missile|bombard|conflict|battle|offensive|حرب|قصف|غزو|guerra|guerre)\b/i,
    bias: "bullish", affected: ["oil", "gold", "defense"], baseSeverity: 0.85 },
  { kind: "military_escalation", match: /\b(escalat|deploy|mobiliz|troops|naval|fleet|tank|warship|تصعيد|تعبئة|قوات)\b/i,
    bias: "bullish", affected: ["oil", "gold", "defense"], baseSeverity: 0.75 },
  { kind: "sanctions",           match: /\b(sanction|embargo|asset freeze|blacklist|عقوبات|حظر|sancion|санк)\b/i,
    bias: "bullish", affected: ["oil", "gold", "rub", "cny"], baseSeverity: 0.7 },
  { kind: "shipping_disruption", match: /\b(red sea|suez|strait of hormuz|bab[- ]el[- ]mandeb|tanker|shipping|port closed|maritime|قناة السويس|البحر الأحمر|ميناء)\b/i,
    bias: "bullish", affected: ["oil", "brent", "wti", "shipping"], baseSeverity: 0.8 },
  { kind: "energy_disruption",   match: /\b(pipeline|refinery|oil field|gas terminal|opec|output cut|production halt|أنابيب النفط|مصفاة|أوبك)\b/i,
    bias: "bullish", affected: ["oil", "natgas", "wti", "brent", "energy"], baseSeverity: 0.75 },
  { kind: "protest",             match: /\b(protest|riot|demonstration|unrest|strike|احتجاج|مظاهرات|إضراب|manifestación|grève)\b/i,
    bias: "bearish", affected: ["fx", "em-equities"], baseSeverity: 0.55 },
  { kind: "election",            match: /\b(election|vote|poll|ballot|انتخابات|تصويت|élection|elección)\b/i,
    bias: "neutral", affected: ["fx", "equities"], baseSeverity: 0.4 },
  { kind: "diplomatic",          match: /\b(diplomat|summit|treaty|talks|negotiation|قمة|معاهدة|مفاوضات|sommet|cumbre)\b/i,
    bias: "neutral", affected: ["fx"], baseSeverity: 0.35 },
  { kind: "cyber",               match: /\b(cyber( ?attack)?|hack|ransomware|data breach|هجوم سيبراني|اختراق)\b/i,
    bias: "bearish", affected: ["tech", "financials"], baseSeverity: 0.6 },
  { kind: "instability",         match: /\b(coup|insurgen|civil war|martial law|state of emergency|انقلاب|حالة الطوارئ|inestabilidad)\b/i,
    bias: "bearish", affected: ["fx", "em-equities"], baseSeverity: 0.85 },
  { kind: "trade",               match: /\b(tariff|trade war|export ban|import ban|تعرفة|حرب تجارية|aranceles)\b/i,
    bias: "bearish", affected: ["equities", "industrials"], baseSeverity: 0.6 },
  { kind: "cb_speech",           match: /\b(central bank|federal reserve|ecb|boe|boj|rate decision|البنك المركزي|الفيدرالي)\b/i,
    bias: "neutral", affected: ["usd", "bonds"], baseSeverity: 0.4 },
];

const REGION_HINTS: Array<{ region: Region; match: RegExp }> = [
  { region: "MENA",  match: /\b(israel|gaza|lebanon|iran|iraq|syria|yemen|saudi|qatar|uae|egypt|libya|tunis|الشرق الأوسط|إسرائيل|غزة|إيران|السعودية|اليمن|سوريا)\b/i },
  { region: "EU",    match: /\b(europe|eu|german|france|french|italy|spain|uk|britain|ukraine|russia|الاتحاد الأوروبي|ألمانيا|فرنسا|روسيا|أوكرانيا)\b/i },
  { region: "ASIA",  match: /\b(china|japan|korea|india|taiwan|thailand|vietnam|asia|الصين|اليابان|كوريا|الهند|تايوان)\b/i },
  { region: "LATAM", match: /\b(brazil|mexico|argentina|venezuela|chile|colombia|أمريكا اللاتينية|البرازيل|المكسيك)\b/i },
  { region: "US",    match: /\b(united states|u\.s\.|washington|biden|trump|congress|الولايات المتحدة|واشنطن)\b/i },
];

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache + dedupe (browser/server safe)
// ─────────────────────────────────────────────────────────────────────────────

type CacheEntry = { ts: number; snap: GdeltSnapshot };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000;

function cacheKey(query: string, timespan: string, max: number) {
  return `${query}::${timespan}::${max}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GDELT DOC API fetcher
// ─────────────────────────────────────────────────────────────────────────────

export interface GdeltFetchOptions {
  query?: string;     // GDELT search query
  timespan?: string;  // e.g. "24h", "6h", "3d"
  maxRecords?: number;
  language?: string;  // "eng", "ara", ...
}

const DEFAULT_QUERY =
  '(sanctions OR war OR protest OR election OR military OR pipeline OR strait OR opec OR cyberattack OR coup OR tariff)';

export async function fetchGdeltDocs(opts: GdeltFetchOptions = {}): Promise<{
  ok: boolean; docs: GdeltDoc[]; error?: string;
}> {
  const q = encodeURIComponent(opts.query ?? DEFAULT_QUERY);
  const timespan = opts.timespan ?? "24h";
  const max = Math.min(Math.max(opts.maxRecords ?? 75, 10), 250);
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}` +
    `&mode=ArtList&format=json&timespan=${encodeURIComponent(timespan)}&maxrecords=${max}`;

  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(to);
    if (!res.ok) return { ok: false, docs: [], error: `gdelt:${res.status}` };
    // GDELT occasionally returns text/plain even when format=json
    const text = await res.text();
    let parsed: { articles?: GdeltDoc[] } = {};
    try { parsed = JSON.parse(text) as { articles?: GdeltDoc[] }; }
    catch { return { ok: false, docs: [], error: "gdelt:parse" }; }
    return { ok: true, docs: parsed.articles ?? [] };
  } catch (e) {
    return { ok: false, docs: [], error: e instanceof Error ? e.message : "gdelt:err" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing / scoring
// ─────────────────────────────────────────────────────────────────────────────

function severityFromScore(s: number): Severity {
  if (s >= 0.85) return "critical";
  if (s >= 0.6) return "high";
  if (s >= 0.3) return "medium";
  return "low";
}

function detectRegion(text: string, country?: string): Region {
  for (const r of REGION_HINTS) if (r.match.test(text)) return r.region;
  if (country) {
    const c = country.toUpperCase();
    if (["US", "USA", "UNITED STATES"].includes(c)) return "US";
    if (["GB", "UK", "DE", "FR", "IT", "ES", "RU", "UA"].includes(c)) return "EU";
    if (["CN", "JP", "KR", "IN", "TW"].includes(c)) return "ASIA";
    if (["BR", "MX", "AR", "VE", "CL"].includes(c)) return "LATAM";
    if (["SA", "AE", "EG", "IL", "IR", "TR", "QA", "JO", "YE"].includes(c)) return "MENA";
  }
  return "GLOBAL";
}

function parseSeen(seendate?: string): number {
  if (!seendate) return Date.now();
  // 20250119T120000Z → ISO
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (!m) return Date.now();
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) || Date.now();
}

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}

export function classifyDoc(d: GdeltDoc): GdeltEvent | null {
  const title = (d.title ?? "").trim();
  if (!title) return null;
  const matched = KIND_PATTERNS.find((k) => k.match.test(title));
  if (!matched) return null;

  const region = detectRegion(title, d.sourcecountry);
  const toneRaw = typeof d.tone === "number" ? d.tone : 0;
  const tone = Math.max(-1, Math.min(1, toneRaw / 10));
  const negativity = Math.max(0, -tone);

  // Escalation: war/military/sanctions/shipping/energy contribute heavily.
  const escalationWeight: Partial<Record<GdeltEventKind, number>> = {
    war: 1, military_escalation: 0.9, sanctions: 0.55, instability: 0.7,
    shipping_disruption: 0.6, energy_disruption: 0.55, cyber: 0.5,
  };
  const escalationScore = Math.min(1,
    (escalationWeight[matched.kind] ?? 0.2) * (0.6 + 0.4 * negativity));

  const instabilityScore = matched.kind === "instability" || matched.kind === "protest"
    ? Math.min(1, matched.baseSeverity * (0.7 + 0.3 * negativity))
    : Math.min(1, 0.2 * negativity);

  const commodityDisruption = matched.kind === "energy_disruption" || matched.kind === "shipping_disruption"
    ? Math.min(1, 0.75 + 0.25 * negativity)
    : matched.kind === "war" || matched.kind === "sanctions"
      ? Math.min(1, 0.5 + 0.3 * negativity)
      : 0.1;

  const supplyChainRisk = matched.kind === "shipping_disruption"
    ? Math.min(1, 0.85 + 0.15 * negativity)
    : matched.kind === "energy_disruption" ? 0.7
    : matched.kind === "war" ? 0.55
    : matched.kind === "sanctions" ? 0.5
    : 0.15;

  const baseConf = 0.5 + 0.25 * negativity + (d.sourcecountry ? 0.05 : 0);
  const confidence = Math.min(0.95, baseConf + matched.baseSeverity * 0.2);

  const sevNum = Math.min(1, matched.baseSeverity * (0.6 + 0.4 * negativity));
  const severity = severityFromScore(sevNum);

  const norm = normalizeTitle(title);
  const cluster = `${region}|${matched.kind}`;
  const id = `gdelt-${hashId(`${cluster}|${norm}`)}`;

  return {
    id, kind: matched.kind, headline: title, region,
    country: d.sourcecountry, severity, marketImpact: matched.bias,
    affected: matched.affected, confidence, tone,
    escalationScore, instabilityScore, commodityDisruption, supplyChainRisk,
    source: d.domain ?? "gdelt", url: d.url, language: d.language,
    cluster, ts: parseSeen(d.seendate),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build snapshot (dedupe + cluster + roll up macro metrics)
// ─────────────────────────────────────────────────────────────────────────────

function rollup(events: GdeltEvent[]): Pick<
  GdeltSnapshot,
  "byKind" | "byRegion" | "heatmap" | "conflictSeverity" |
  "macroRiskIndex" | "oilRisk" | "shippingRisk" | "sanctionsCount" | "topEvents"
> {
  const byKind = {
    protest: 0, war: 0, sanctions: 0, election: 0, diplomatic: 0,
    military_escalation: 0, shipping_disruption: 0, energy_disruption: 0,
    cyber: 0, instability: 0, trade: 0, cb_speech: 0, other: 0,
  } as Record<GdeltEventKind, number>;
  const byRegion = { US: 0, EU: 0, MENA: 0, ASIA: 0, GLOBAL: 0, LATAM: 0 } as Record<Region, number>;
  const intensity: Record<Region, number> = { US: 0, EU: 0, MENA: 0, ASIA: 0, GLOBAL: 0, LATAM: 0 };

  let conflictAcc = 0, conflictWeight = 0;
  let oilAcc = 0, shipAcc = 0, sanctions = 0;
  for (const e of events) {
    byKind[e.kind]++;
    byRegion[e.region]++;
    intensity[e.region] += e.escalationScore * (0.5 + e.confidence * 0.5);
    conflictAcc += e.escalationScore * e.confidence;
    conflictWeight += 1;
    if (e.affected.some((a) => /oil|brent|wti|energy/i.test(a))) oilAcc += e.commodityDisruption * e.confidence;
    if (e.kind === "shipping_disruption") shipAcc += e.supplyChainRisk * e.confidence;
    if (e.kind === "sanctions") sanctions++;
  }
  const conflictSeverity = conflictWeight ? Math.min(1, conflictAcc / conflictWeight) : 0;
  const oilRisk = Math.min(1, oilAcc / Math.max(3, events.length / 4));
  const shippingRisk = Math.min(1, shipAcc / Math.max(2, events.length / 6));
  const macroRiskIndex = Math.min(1,
    0.45 * conflictSeverity + 0.25 * oilRisk + 0.2 * shippingRisk + 0.1 * (sanctions / 10));

  const heatmap = (Object.keys(intensity) as Region[])
    .map((region) => ({ region, intensity: Math.min(1, intensity[region] / 4), count: byRegion[region] }))
    .sort((a, b) => b.intensity - a.intensity);

  const topEvents = [...events]
    .sort((a, b) =>
      (b.escalationScore * b.confidence) - (a.escalationScore * a.confidence))
    .slice(0, 12);

  return { byKind, byRegion, heatmap, conflictSeverity, macroRiskIndex, oilRisk, shippingRisk, sanctionsCount: sanctions, topEvents };
}

export function buildGdeltSnapshot(
  docs: GdeltDoc[],
  opts: { ok: boolean; error?: string; cacheAgeMs?: number } = { ok: true },
): GdeltSnapshot {
  const seen = new Set<string>();
  const events: GdeltEvent[] = [];
  for (const d of docs) {
    const ev = classifyDoc(d);
    if (!ev) continue;
    if (seen.has(ev.id)) continue;          // duplicate suppression
    seen.add(ev.id);
    events.push(ev);
  }
  return {
    generatedAt: Date.now(),
    ok: opts.ok,
    error: opts.error,
    totalDocs: docs.length,
    events,
    cacheAgeMs: opts.cacheAgeMs ?? 0,
    ...rollup(events),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public high-level helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function runGdelt(opts: GdeltFetchOptions = {}): Promise<GdeltSnapshot> {
  const key = cacheKey(opts.query ?? DEFAULT_QUERY, opts.timespan ?? "24h", opts.maxRecords ?? 75);
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return { ...hit.snap, cacheAgeMs: Date.now() - hit.ts };
  }
  const r = await fetchGdeltDocs(opts);
  if (!r.ok) {
    // Fallback-safe: return previous cached snapshot with lowered confidence.
    if (hit) {
      const degraded: GdeltSnapshot = {
        ...hit.snap,
        ok: false,
        error: r.error,
        cacheAgeMs: Date.now() - hit.ts,
        events: hit.snap.events.map((e) => ({ ...e, confidence: e.confidence * 0.85 })),
      };
      return degraded;
    }
    return buildGdeltSnapshot([], { ok: false, error: r.error });
  }
  const snap = buildGdeltSnapshot(r.docs, { ok: true });
  memoryCache.set(key, { ts: Date.now(), snap });
  return snap;
}

/** Convert GDELT events → RawSignal[] for the global-intel ingestion pipeline. */
export function gdeltEventsToSignals(events: GdeltEvent[]): RawSignal[] {
  return events.map((e) => ({
    source: `gdelt:${e.source}`,
    category: "geopolitical",
    region: e.region,
    title: e.headline,
    payload: {
      kind: e.kind,
      polarity: e.marketImpact === "bullish" ? 0.6 : e.marketImpact === "bearish" ? -0.6 : 0,
      tone: e.tone,
      escalationScore: e.escalationScore,
      instabilityScore: e.instabilityScore,
      commodityDisruption: e.commodityDisruption,
      supplyChainRisk: e.supplyChainRisk,
      affected: e.affected,
      url: e.url,
      cluster: e.cluster,
    },
    ts: e.ts,
    timestamp: e.ts,
    reliability: Math.max(0.5, e.confidence),
  }));
}

export const gdeltProviderHealth = () => {
  let count = 0; let lastTs = 0;
  for (const [, v] of memoryCache) { count++; lastTs = Math.max(lastTs, v.ts); }
  return { cached: count, lastFetch: lastTs, ageMs: lastTs ? Date.now() - lastTs : null };
};
