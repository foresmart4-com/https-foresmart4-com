// Deterministic synthetic seed so analytics render meaningful values
// even when the live recommendation feed hasn't produced enough history.
import type { CombinedRecord } from "./types";

const AGENTS = ["macro", "technical", "quant", "sentiment", "portfolio", "strategy"];
const SYMBOLS = ["BTC", "ETH", "SPX", "NDX", "XAU", "OIL", "DXY"];
const REGIMES = ["Trending Bullish", "Trending Bearish", "Sideways", "Risk-On", "Risk-Off", "Panic"];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticHistory(seed = 42, count = 120): CombinedRecord[] {
  const rng = mulberry32(seed);
  const now = Date.now();
  const out: CombinedRecord[] = [];
  for (let i = 0; i < count; i++) {
    const symbol = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
    const agent = AGENTS[Math.floor(rng() * AGENTS.length)];
    const regime = REGIMES[Math.floor(rng() * REGIMES.length)];
    const confidence = Math.round(35 + rng() * 60);
    const action = rng() > 0.5 ? "buy" : "sell";
    const predictedDirection = action === "buy" ? "up" : "down";
    // Calibration bias: higher confidence → higher win prob (but imperfect).
    const winProb = 0.4 + (confidence - 35) / 100 * 0.45;
    const win = rng() < winProb;
    const magnitude = (rng() * 2.8 + 0.2) * (win ? 1 : -1);
    const realized = action === "buy" ? magnitude : -magnitude;
    const entryPrice = 100 + rng() * 100;
    const exitPrice = entryPrice * (1 + realized / 100);
    const ts = now - Math.floor(rng() * 30) * 24 * 3.6e6 - Math.floor(rng() * 23) * 3.6e6;
    const ageHrs = 4 + rng() * 96;
    const actualDirection = realized > 0.05 ? "up" : realized < -0.05 ? "down" : "flat";
    const correct = predictedDirection === actualDirection;
    out.push({
      id: `seed-${i}-${ts}`,
      ts,
      symbol,
      agent,
      regime,
      action,
      predictedDirection,
      confidence,
      entryPrice: +entryPrice.toFixed(2),
      horizonHrs: 24,
      source: "synthetic",
      outcome: {
        id: `seed-${i}-${ts}`,
        resolvedAt: ts + ageHrs * 3.6e6,
        exitPrice: +exitPrice.toFixed(2),
        realizedReturnPct: +realized.toFixed(3),
        actualDirection,
        correct,
        ageHrs: +ageHrs.toFixed(1),
      },
    });
  }
  return out;
}
