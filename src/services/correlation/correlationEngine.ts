// Correlation Engine — derives directional relationships between key assets
// from recent price history (Pearson correlation on returns).
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type CorrelationKind = "positive" | "inverse" | "weak";

export interface CorrelationPair {
  a: AssetKey;
  b: AssetKey;
  coefficient: number; // -1..1
  kind: CorrelationKind;
  strength: number; // 0-100
  explanation: string;
}

// Pairs we always want to surface, with curated narratives.
const FOCUS_PAIRS: Array<{ a: AssetKey; b: AssetKey; pos: string; inv: string }> = [
  { a: "XAU", b: "DXY", pos: "Gold tracks USD — unusual; check real-yield regime.", inv: "Classic safe-haven inverse: weaker USD lifts gold." },
  { a: "NDX", b: "DXY", pos: "Risk-on dollar — atypical, often late-cycle.", inv: "Easing financial conditions support duration/tech." },
  { a: "BTC", b: "NDX", pos: "BTC mirrors tech beta — sensitive to liquidity cycles.", inv: "BTC decoupling — flow-driven, watch for rotation." },
  { a: "OIL", b: "DXY", pos: "Demand impulse beats USD strength — reflation regime.", inv: "Stronger USD pressures crude — disinflationary." },
  { a: "ETH", b: "BTC", pos: "Alts follow BTC momentum — risk appetite broad.", inv: "ETH outperforming on idiosyncratic catalyst." },
  { a: "SPX", b: "XAU", pos: "Stocks and gold rally together — liquidity-driven.", inv: "Risk-off rotation: gold catches haven bid." },
];

function returns(history: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < history.length; i++) r.push((history[i] - history[i - 1]) / history[i - 1]);
  return r;
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 4) return 0;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : +(num / den).toFixed(3);
}

export function computeCorrelations(quotes: MarketQuote[]): CorrelationPair[] {
  const map = new Map(quotes.map((q) => [q.key, q]));
  const out: CorrelationPair[] = [];
  for (const p of FOCUS_PAIRS) {
    const qa = map.get(p.a), qb = map.get(p.b);
    if (!qa || !qb) continue;
    const c = pearson(returns(qa.history), returns(qb.history));
    const kind: CorrelationKind = c > 0.35 ? "positive" : c < -0.35 ? "inverse" : "weak";
    const strength = Math.round(Math.abs(c) * 100);
    const explanation = kind === "weak"
      ? "Relationship currently noisy — no reliable lead/lag signal."
      : kind === "positive" ? p.pos : p.inv;
    out.push({ a: p.a, b: p.b, coefficient: c, kind, strength, explanation });
  }
  return out.sort((a, b) => b.strength - a.strength);
}
