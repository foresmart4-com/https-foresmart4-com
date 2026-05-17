// Asset personality — characterizes each asset's behavioral DNA.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export interface AssetPersonality {
  asset: AssetKey;
  assetName: string;
  archetype: "trend-follower" | "mean-reverter" | "volatile-mover" | "stable-anchor" | "range-bound";
  volatilityTrait: number;     // 0-100
  momentumPersistence: number; // 0-100 — how consistent direction is
  reversalTendency: number;    // 0-100 — tendency to reverse intraday
  breakoutBehavior: number;    // 0-100 — frequency of range expansions
  stabilityScore: number;      // 0-100 — overall predictability
  note: string;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

export function profileAsset(q: MarketQuote): AssetPersonality {
  const h = q.history;
  const n = h.length;
  const returns: number[] = [];
  for (let i = 1; i < n; i++) returns.push(((h[i] - h[i - 1]) / (h[i - 1] || 1)) * 100);

  // Momentum persistence: share of consecutive same-sign returns
  let same = 0;
  for (let i = 1; i < returns.length; i++) {
    if (returns[i] === 0) continue;
    if (Math.sign(returns[i]) === Math.sign(returns[i - 1])) same++;
  }
  const momentumPersistence = returns.length > 1
    ? Math.round((same / (returns.length - 1)) * 100) : 50;

  // Reversal tendency: sign flips
  let flips = 0;
  for (let i = 1; i < returns.length; i++) {
    if (Math.sign(returns[i]) !== Math.sign(returns[i - 1]) && returns[i] !== 0 && returns[i - 1] !== 0) flips++;
  }
  const reversalTendency = returns.length > 1
    ? Math.round((flips / (returns.length - 1)) * 100) : 50;

  // Breakout behavior: returns exceeding 1 stdev
  const sd = stdev(returns) || 1e-9;
  const breakouts = returns.filter((r) => Math.abs(r) > sd).length;
  const breakoutBehavior = returns.length
    ? Math.round((breakouts / returns.length) * 100) : 0;

  const volatilityTrait = Math.min(100, Math.round(q.volatility));
  const stabilityScore = Math.max(0, Math.min(100, Math.round(
    100 - volatilityTrait * 0.4 - reversalTendency * 0.4 + momentumPersistence * 0.2,
  )));

  let archetype: AssetPersonality["archetype"];
  if (momentumPersistence >= 60 && volatilityTrait < 70) archetype = "trend-follower";
  else if (reversalTendency >= 60) archetype = "mean-reverter";
  else if (volatilityTrait >= 70) archetype = "volatile-mover";
  else if (breakoutBehavior < 15 && volatilityTrait < 30) archetype = "stable-anchor";
  else archetype = "range-bound";

  const note = `${q.name}: ${archetype.replace("-", " ")}; persistence ${momentumPersistence}, reversal ${reversalTendency}, breakout ${breakoutBehavior}.`;

  return {
    asset: q.key, assetName: q.name,
    archetype, volatilityTrait, momentumPersistence, reversalTendency,
    breakoutBehavior, stabilityScore, note,
  };
}

export function profileAll(quotes: MarketQuote[]): AssetPersonality[] {
  return quotes.map(profileAsset);
}
