// Confidence calibration + uncertainty modelling.
//
//  - Calibration: blends raw weighted confidence with realised track-record
//    accuracy (winRate) using a sigmoid-tempered Platt-style adjustment. This
//    pulls overconfident estimates toward the observed hit rate.
//  - Uncertainty: weighted standard deviation across agent scores plus a
//    normalised entropy term penalising disagreement.
import type { AgentSignal } from "@/services/agents/types";
import { memoryAgent } from "@/services/agents/memoryAgent";
import type { UncertaintyBand } from "./types";

export function calibrateConfidence(
  agents: AgentSignal[],
  agreement: number, // 0..1
): { confidence: number; rawConfidence: number; rationale: string } {
  const totalW = agents.reduce((s, a) => s + a.weight, 0) || 1;
  const raw = agents.reduce((s, a) => s + a.confidence * a.weight, 0) / totalW;

  const perf = memoryAgent.performance();
  const trackRate = perf.trades >= 5 ? perf.winRate : 0.55; // prior

  // Platt-ish blend: temper raw by agreement and pull toward observed hit-rate.
  const blended = raw * (0.7 + agreement * 0.3);
  const platt = (blended / 100) * 0.7 + trackRate * 0.3;
  const calibrated = Math.max(15, Math.min(95, Math.round(platt * 100)));

  return {
    confidence: calibrated,
    rawConfidence: Math.round(raw),
    rationale:
      `raw ensemble ${raw.toFixed(0)}% × agreement ${(agreement * 100).toFixed(0)}% ` +
      `+ historical hit-rate ${(trackRate * 100).toFixed(0)}% (${perf.trades} trades).`,
  };
}

export function uncertainty(agents: AgentSignal[]): UncertaintyBand {
  const totalW = agents.reduce((s, a) => s + a.weight, 0) || 1;
  const mean = agents.reduce((s, a) => s + a.score * a.weight, 0) / totalW;
  const variance = agents.reduce((s, a) => s + a.weight * (a.score - mean) ** 2, 0) / totalW;
  const stdev = Math.sqrt(variance);

  // Entropy across directional buckets (bull/bear/neutral) using weight mass.
  const buckets = { bull: 0, bear: 0, neu: 0 };
  for (const a of agents) {
    if (a.bias === "bullish") buckets.bull += a.weight;
    else if (a.bias === "bearish") buckets.bear += a.weight;
    else buckets.neu += a.weight;
  }
  const ps = [buckets.bull, buckets.bear, buckets.neu].map((p) => p / (totalW || 1)).filter((p) => p > 0);
  const ent = -ps.reduce((s, p) => s + p * Math.log2(p), 0) / Math.log2(3); // 0..1

  return {
    mean: +mean.toFixed(2),
    stdev: +stdev.toFixed(2),
    low: +(mean - stdev).toFixed(2),
    high: +(mean + stdev).toFixed(2),
    entropy: +ent.toFixed(3),
  };
}
