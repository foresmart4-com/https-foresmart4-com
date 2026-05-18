/** Pattern recognition — lightweight repeating-pattern detector on returns. */
export interface PatternHit { name: string; confidence: number; ts: number; }

export function detectPatterns(prices: number[]): PatternHit[] {
  if (prices.length < 20) return [];
  const r = prices.slice(-20).map((p, i, a) => i === 0 ? 0 : (p - a[i-1]) / a[i-1]);
  const hits: PatternHit[] = [];
  const last3 = r.slice(-3);
  if (last3.every((x) => x > 0)) hits.push({ name: "3-bar up impulse", confidence: 0.7, ts: Date.now() });
  if (last3.every((x) => x < 0)) hits.push({ name: "3-bar down impulse", confidence: 0.7, ts: Date.now() });
  const rng = Math.max(...prices.slice(-10)) - Math.min(...prices.slice(-10));
  const totRng = Math.max(...prices) - Math.min(...prices) || 1;
  if (rng / totRng < 0.2) hits.push({ name: "Volatility squeeze", confidence: 0.8, ts: Date.now() });
  const ma5 = prices.slice(-5).reduce((s,x)=>s+x,0)/5;
  const ma20 = prices.slice(-20).reduce((s,x)=>s+x,0)/20;
  if (ma5 > ma20 * 1.01) hits.push({ name: "MA cross bullish", confidence: 0.65, ts: Date.now() });
  if (ma5 < ma20 * 0.99) hits.push({ name: "MA cross bearish", confidence: 0.65, ts: Date.now() });
  return hits;
}
