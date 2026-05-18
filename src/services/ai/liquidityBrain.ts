/** Liquidity brain — depth + spread + flow scoring. */
export interface LiquiditySnapshot {
  symbol: string;
  spreadBps: number;
  topBookDepthUsd: number;
  recentVolumeUsd: number;
}
export interface LiquidityScore { symbol: string; score: number; tier: "deep"|"good"|"thin"|"illiquid"; }

export function scoreLiquidity(s: LiquiditySnapshot): LiquidityScore {
  const spreadScore = Math.max(0, 1 - s.spreadBps / 30);
  const depthScore = Math.min(1, s.topBookDepthUsd / 500_000);
  const volScore = Math.min(1, s.recentVolumeUsd / 10_000_000);
  const score = Number((spreadScore * 0.35 + depthScore * 0.35 + volScore * 0.3).toFixed(3));
  const tier: LiquidityScore["tier"] =
    score > 0.75 ? "deep" : score > 0.55 ? "good" : score > 0.35 ? "thin" : "illiquid";
  return { symbol: s.symbol, score, tier };
}

export function flowImbalance(buyVol: number, sellVol: number): number {
  const t = buyVol + sellVol;
  return t > 0 ? (buyVol - sellVol) / t : 0; // -1..1
}
