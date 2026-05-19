// Quote fusion: merge multiple provider quotes into one consensus quote.
// Confidence-weighted median + spread + anomaly detection.

import type { FusedQuote, Quote } from "./types";
import { snapshotHealth } from "./providerHealth";
import { fusionBus } from "./eventBus";

interface Window { quotes: Quote[]; }
const WINDOW = new Map<string, Window>();   // key = canonical symbol
const WINDOW_MS = 2_000;

function pushQuote(q: Quote) {
  const w = WINDOW.get(q.symbol) ?? { quotes: [] };
  const cutoff = q.ts - WINDOW_MS;
  w.quotes = w.quotes.filter((x) => x.ts >= cutoff && x.provider !== q.provider);
  w.quotes.push(q);
  WINDOW.set(q.symbol, w);
}

function weightedMedian(values: { v: number; w: number }[]): number {
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of sorted) {
    acc += x.w;
    if (acc >= total / 2) return x.v;
  }
  return sorted[sorted.length - 1].v;
}

/** EMA-based anomaly detection per symbol (lightweight). */
const EMA = new Map<string, { mean: number; varPx: number }>();
function updateAnomaly(symbol: string, price: number): number {
  const prev = EMA.get(symbol) ?? { mean: price, varPx: 0 };
  const alpha = 0.1;
  const diff = price - prev.mean;
  const mean = prev.mean + alpha * diff;
  const varPx = (1 - alpha) * (prev.varPx + alpha * diff * diff);
  EMA.set(symbol, { mean, varPx });
  const std = Math.sqrt(varPx) || price * 1e-4;
  const z = Math.abs((price - mean) / std);
  return Math.min(1, z / 6);
}

export function ingestQuote(q: Quote): FusedQuote {
  pushQuote(q);
  const w = WINDOW.get(q.symbol)!;
  const weighted = w.quotes.map((qq) => ({
    v: qq.price,
    w: Math.max(0.01, snapshotHealth(qq.provider).confidence),
  }));
  const consensus = weighted.length === 1 ? weighted[0].v : weightedMedian(weighted);
  const prices = w.quotes.map((qq) => qq.price);
  const spread = prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : 0;
  const avgConfidence = weighted.reduce((s, x) => s + x.w, 0) / weighted.length;
  // agreement bonus: tighter spread relative to price → higher confidence.
  const agreement = consensus > 0 ? 1 - Math.min(1, spread / consensus / 0.01) : 1;
  const confidence = Math.max(0, Math.min(1, 0.6 * avgConfidence + 0.4 * agreement));
  const anomalyScore = updateAnomaly(q.symbol, consensus);
  const fused: FusedQuote = {
    ...q,
    price: consensus,
    consensusPrice: consensus,
    spread: Math.round(spread * 1e6) / 1e6,
    contributingProviders: w.quotes.map((x) => x.provider),
    confidence: Math.round(confidence * 1000) / 1000,
    anomalyScore: Math.round(anomalyScore * 1000) / 1000,
  };
  fusionBus.emit({ type: "quote", quote: fused });
  if (anomalyScore > 0.6) {
    fusionBus.emit({
      type: "anomaly", symbol: q.symbol, score: anomalyScore,
      reason: anomalyScore > 0.85 ? "extreme price deviation" : "elevated z-score",
    });
  }
  return fused;
}

export function lastFused(symbol: string): FusedQuote | null {
  const w = WINDOW.get(symbol);
  if (!w || w.quotes.length === 0) return null;
  return ingestQuote(w.quotes[w.quotes.length - 1]);
}
