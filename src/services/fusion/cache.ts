// Intelligent cache + time-series compression for OHLC/quote streams.
// Compression: delta + run-length on quantized prices, plus LRU eviction.

import type { OHLC, Quote } from "./types";

interface Entry<T> { value: T; ts: number; hits: number; }
const QUOTE_CACHE = new Map<string, Entry<Quote>>();
const OHLC_CACHE = new Map<string, Entry<OHLC[]>>();
const MAX_KEYS = 2_000;

function lruTrim<T>(map: Map<string, Entry<T>>): void {
  if (map.size <= MAX_KEYS) return;
  const arr = [...map.entries()].sort((a, b) => a[1].ts - b[1].ts);
  const remove = arr.slice(0, Math.floor(MAX_KEYS * 0.1));
  remove.forEach(([k]) => map.delete(k));
}

export function cacheQuote(key: string, q: Quote): void {
  QUOTE_CACHE.set(key, { value: q, ts: Date.now(), hits: 0 });
  lruTrim(QUOTE_CACHE);
}

export function getCachedQuote(key: string, maxAgeMs = 2_000): Quote | null {
  const e = QUOTE_CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > maxAgeMs) return null;
  e.hits++;
  return e.value;
}

export function cacheOHLC(key: string, bars: OHLC[]): void {
  OHLC_CACHE.set(key, { value: bars, ts: Date.now(), hits: 0 });
  lruTrim(OHLC_CACHE);
}

export function getCachedOHLC(key: string, maxAgeMs = 60_000): OHLC[] | null {
  const e = OHLC_CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > maxAgeMs) return null;
  e.hits++;
  return e.value;
}

export function cacheStats() {
  return {
    quotes: QUOTE_CACHE.size,
    ohlc: OHLC_CACHE.size,
    quoteHits: [...QUOTE_CACHE.values()].reduce((a, e) => a + e.hits, 0),
    ohlcHits: [...OHLC_CACHE.values()].reduce((a, e) => a + e.hits, 0),
  };
}

/**
 * Compress an OHLC series with delta + run-length encoding on a 1e-4 grid.
 * Layout: [scale, baseTs, baseClose, [dTs, dO, dH, dL, dC, dV, run]...]
 */
export interface CompressedSeries {
  scale: number;
  baseTs: number;
  baseClose: number;
  count: number;
  payload: number[];
  ratio: number;
}

export function compressSeries(bars: OHLC[], scale = 10_000): CompressedSeries {
  if (bars.length === 0) {
    return { scale, baseTs: 0, baseClose: 0, count: 0, payload: [], ratio: 0 };
  }
  const q = (n: number) => Math.round(n * scale);
  const baseTs = bars[0].ts;
  const baseClose = bars[0].c;
  const payload: number[] = [];
  let prevTs = baseTs;
  let prev = { o: q(bars[0].o), h: q(bars[0].h), l: q(bars[0].l), c: q(bars[0].c), v: Math.round(bars[0].v) };
  let i = 0;
  while (i < bars.length) {
    const b = bars[i];
    const cur = { o: q(b.o), h: q(b.h), l: q(b.l), c: q(b.c), v: Math.round(b.v) };
    let run = 1;
    while (
      i + run < bars.length &&
      q(bars[i + run].c) === cur.c && q(bars[i + run].o) === cur.o &&
      q(bars[i + run].h) === cur.h && q(bars[i + run].l) === cur.l
    ) run++;
    payload.push(
      b.ts - prevTs,
      cur.o - prev.o, cur.h - prev.h, cur.l - prev.l, cur.c - prev.c,
      cur.v - prev.v, run,
    );
    prevTs = b.ts; prev = cur; i += run;
  }
  const rawBytes = bars.length * 6 * 8;
  const compBytes = payload.length * 8;
  return {
    scale, baseTs, baseClose, count: bars.length, payload,
    ratio: Math.round((1 - compBytes / Math.max(1, rawBytes)) * 1000) / 1000,
  };
}

export function decompressSeries(c: CompressedSeries, symbol: string): OHLC[] {
  const out: OHLC[] = [];
  if (c.count === 0) return out;
  let ts = c.baseTs;
  let o = 0, h = 0, l = 0, cl = 0, v = 0;
  const inv = 1 / c.scale;
  for (let i = 0; i < c.payload.length; i += 7) {
    ts += c.payload[i];
    o += c.payload[i + 1];
    h += c.payload[i + 2];
    l += c.payload[i + 3];
    cl += c.payload[i + 4];
    v += c.payload[i + 5];
    const run = c.payload[i + 6];
    for (let r = 0; r < run; r++) {
      out.push({ symbol, ts: ts + r, o: o * inv, h: h * inv, l: l * inv, c: cl * inv, v });
    }
  }
  return out.slice(0, c.count);
}
