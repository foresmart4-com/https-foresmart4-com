// Phase C: Real price fill — fetches live market quotes for paper order fills.
// Replaces Math.random() with actual price + ±0.1% slippage simulation.
// 30-second in-memory cache per symbol to avoid hammering the router.

import { routeQuote } from "@/lib/market/router";

interface FillPrice {
  price: number | null;
  provider: string | null;
  reliable: boolean;
  timestamp: number;
}

const _priceCache = new Map<string, { result: FillPrice; expiry: number }>();
const CACHE_TTL_MS = 30_000;

export async function getRealFillPrice(symbol: string): Promise<FillPrice> {
  const now = Date.now();
  const cached = _priceCache.get(symbol);
  if (cached && cached.expiry > now) return cached.result;

  try {
    const quote = await routeQuote(symbol);
    const result: FillPrice = {
      price: quote.success && typeof quote.price === "number" ? quote.price : null,
      provider: quote.provider,
      reliable: quote.success && !quote.fallbackUsed,
      timestamp: now,
    };
    _priceCache.set(symbol, { result, expiry: now + CACHE_TTL_MS });
    return result;
  } catch {
    const result: FillPrice = { price: null, provider: null, reliable: false, timestamp: now };
    _priceCache.set(symbol, { result, expiry: now + CACHE_TTL_MS });
    return result;
  }
}
