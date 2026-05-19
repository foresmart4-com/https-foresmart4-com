// Deterministic synthetic OHLC generator (seeded PRNG) for replays/benchmarks.
import type { Bar } from "./simulationLab";

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RegimeName = "bull" | "bear" | "chop" | "volatile" | "crisis";

const REGIME_PARAMS: Record<RegimeName, { drift: number; vol: number }> = {
  bull:     { drift:  0.0008, vol: 0.012 },
  bear:     { drift: -0.0007, vol: 0.018 },
  chop:     { drift:  0.0001, vol: 0.009 },
  volatile: { drift:  0.0002, vol: 0.028 },
  crisis:   { drift: -0.0020, vol: 0.045 },
};

export function generateBars(opts: {
  symbol?: string;
  bars: number;
  start?: number;
  intervalMs?: number;
  regime?: RegimeName;
  seed?: number;
}): Bar[] {
  const { bars, start = 100, intervalMs = 86_400_000, regime = "bull", seed = 42 } = opts;
  const rng = mulberry32(seed);
  const { drift, vol } = REGIME_PARAMS[regime];
  const out: Bar[] = [];
  let price = start;
  const t0 = Date.now() - bars * intervalMs;
  for (let i = 0; i < bars; i++) {
    const z = Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
    const ret = drift + vol * z;
    const open = price;
    const close = +(open * (1 + ret)).toFixed(4);
    const high = +Math.max(open, close, open * (1 + Math.abs(vol * rng()))).toFixed(4);
    const low  = +Math.min(open, close, open * (1 - Math.abs(vol * rng()))).toFixed(4);
    const volume = Math.floor(1_000_000 * (0.5 + rng()));
    out.push({ ts: t0 + i * intervalMs, open, high, low, close, volume });
    price = close;
  }
  return out;
}
