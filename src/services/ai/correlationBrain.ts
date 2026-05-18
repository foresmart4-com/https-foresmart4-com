/** Correlation brain — rolling correlations on price series. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.slice(-n).reduce((s,x)=>s+x,0)/n;
  const mb = b.slice(-n).reduce((s,x)=>s+x,0)/n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[a.length-n+i] - ma, y = b[b.length-n+i] - mb;
    num += x*y; da += x*x; db += y*y;
  }
  const den = Math.sqrt(da*db);
  return den ? num/den : 0;
}

export function buildCorrelationMatrix(series: Record<string, number[]>): Record<string, Record<string, number>> {
  const keys = Object.keys(series);
  const m: Record<string, Record<string, number>> = {};
  for (const a of keys) {
    m[a] = {};
    for (const b of keys) m[a][b] = a === b ? 1 : Number(pearson(series[a], series[b]).toFixed(3));
  }
  return m;
}

export function detectDecouplings(prev: Record<string, Record<string, number>>,
                                   now: Record<string, Record<string, number>>, threshold = 0.4) {
  const events: { a: string; b: string; delta: number }[] = [];
  for (const a of Object.keys(now)) for (const b of Object.keys(now[a])) {
    if (a >= b) continue;
    const d = (now[a][b] ?? 0) - (prev?.[a]?.[b] ?? 0);
    if (Math.abs(d) >= threshold) events.push({ a, b, delta: Number(d.toFixed(3)) });
  }
  return events;
}
