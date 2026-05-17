// Performance learning — derives confidence modifiers and observations from
// the running signal memory. Pure read of computeStats() + memory entries.
import { computeStats, getMemory, type SignalMemoryEntry } from "./signalMemory";
import type { AssetKey } from "@/services/market/marketData";

export interface LearningObservation {
  kind: "strength" | "weakness" | "calibration" | "pattern";
  message: string;
}

export interface ConfidenceModifier {
  asset?: AssetKey;
  regime?: string;
  volBucket?: string;
  delta: number; // -25..+25 added to raw confidence
  reason: string;
}

export interface PerformanceLearningReport {
  highConfAccuracy: number;     // 0-100 win rate on conf >= 70
  lowConfAccuracy: number;      // 0-100 win rate on conf < 50
  falseBreakoutRate: number;    // 0-100 share of failed BUY/SELL at high conf
  strongest: { label: string; winRate: number; count: number } | null;
  weakest: { label: string; winRate: number; count: number } | null;
  modifiers: ConfidenceModifier[];
  observations: LearningObservation[];
  hint: string;
}

function bucketVol(v: number): string {
  if (v < 30) return "Low";
  if (v < 60) return "Medium";
  return "High";
}

export function buildPerformanceLearning(): PerformanceLearningReport {
  const stats = computeStats();
  const memory = getMemory().filter((e) => e.outcome && e.outcome !== "pending");

  const high = memory.filter((e) => e.confidence >= 70);
  const low = memory.filter((e) => e.confidence < 50);
  const highWins = high.filter((e) => e.outcome === "success").length;
  const lowWins = low.filter((e) => e.outcome === "success").length;
  const highConfAccuracy = high.length ? Math.round((highWins / high.length) * 100) : 0;
  const lowConfAccuracy = low.length ? Math.round((lowWins / low.length) * 100) : 0;

  const highDirectional = high.filter((e) => e.action !== "HOLD");
  const falseBreakouts = highDirectional.filter((e) => e.outcome === "failure").length;
  const falseBreakoutRate = highDirectional.length
    ? Math.round((falseBreakouts / highDirectional.length) * 100) : 0;

  // strongest / weakest setup by asset (only with enough samples)
  const sortedAssets = [...stats.byAsset].filter((a) => a.count >= 3).sort((a, b) => b.winRate - a.winRate);
  const strongest = sortedAssets[0]
    ? { label: sortedAssets[0].asset, winRate: sortedAssets[0].winRate, count: sortedAssets[0].count }
    : null;
  const weakest = sortedAssets[sortedAssets.length - 1]
    ? { label: sortedAssets[sortedAssets.length - 1].asset, winRate: sortedAssets[sortedAssets.length - 1].winRate, count: sortedAssets[sortedAssets.length - 1].count }
    : null;

  // Adaptive modifiers
  const modifiers: ConfidenceModifier[] = [];
  for (const a of stats.byAsset) {
    if (a.count < 4) continue;
    if (a.winRate >= 65) modifiers.push({ asset: a.asset, delta: +8, reason: `Historically strong on ${a.asset} (${a.winRate}% wins, n=${a.count})` });
    else if (a.winRate <= 35) modifiers.push({ asset: a.asset, delta: -10, reason: `Weak track record on ${a.asset} (${a.winRate}% wins, n=${a.count})` });
  }
  for (const r of stats.byRegime) {
    if (r.count < 4) continue;
    if (r.winRate <= 35) modifiers.push({ regime: r.regime, delta: -8, reason: `Underperforming during ${r.regime} regime` });
    else if (r.winRate >= 65) modifiers.push({ regime: r.regime, delta: +5, reason: `Edge confirmed in ${r.regime} regime` });
  }
  for (const v of stats.byVolBucket) {
    if (v.count < 4) continue;
    if (v.bucket === "High" && v.winRate < 45) modifiers.push({ volBucket: "High", delta: -12, reason: "High-volatility setups frequently fail" });
    if (v.bucket === "Low" && v.winRate >= 60) modifiers.push({ volBucket: "Low", delta: +6, reason: "Low-volatility setups show consistent edge" });
  }

  // Observations
  const observations: LearningObservation[] = [];
  if (highConfAccuracy && low.length && highConfAccuracy < lowConfAccuracy + 5) {
    observations.push({ kind: "calibration", message: "High-confidence signals not outperforming low-confidence — confidence calibration likely overstated." });
  }
  if (highConfAccuracy >= 70) {
    observations.push({ kind: "strength", message: `High-confidence signals winning ${highConfAccuracy}% — calibration is working.` });
  }
  if (falseBreakoutRate >= 50 && highDirectional.length >= 4) {
    observations.push({ kind: "pattern", message: `Elevated false-breakout rate (${falseBreakoutRate}%) on confident directional calls; tighten breakout filters.` });
  }
  if (strongest) observations.push({ kind: "strength", message: `Strongest asset profile: ${strongest.label} (${strongest.winRate}%).` });
  if (weakest && weakest.winRate < 45) observations.push({ kind: "weakness", message: `Weakest asset profile: ${weakest.label} (${weakest.winRate}%) — reduce sizing.` });

  let hint = "Insufficient sample size — collecting more outcomes before adapting.";
  if (memory.length >= 8) {
    if (stats.winRate >= 60) hint = "System edge confirmed; maintain framework, avoid over-fitting.";
    else if (stats.winRate <= 40) hint = "Edge unconfirmed — reduce aggression, prioritize capital preservation.";
    else hint = "Marginal edge; refine filters and weight regime-aligned setups.";
  }

  return {
    highConfAccuracy, lowConfAccuracy, falseBreakoutRate,
    strongest, weakest, modifiers, observations, hint,
  };
}

export function applyModifier(
  rawConfidence: number,
  asset: AssetKey, regime: string, volatility: number,
  modifiers: ConfidenceModifier[],
): number {
  let delta = 0;
  for (const m of modifiers) {
    if (m.asset && m.asset !== asset) continue;
    if (m.regime && m.regime !== regime) continue;
    if (m.volBucket && m.volBucket !== bucketVol(volatility)) continue;
    delta += m.delta;
  }
  return Math.max(0, Math.min(100, Math.round(rawConfidence + delta)));
}

export type { SignalMemoryEntry };
