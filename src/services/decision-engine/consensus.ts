// Weighted multi-agent consensus + conflict resolution.
import type { AgentSignal, Bias } from "@/services/agents/types";
import type { ConsensusBreakdown, ConflictReport } from "./types";

export interface ConsensusResult {
  bias: Bias;
  score: number;          // -100..100
  agreement: number;      // 0..1 (1 = unanimous direction)
  breakdown: ConsensusBreakdown[];
  conflicts: ConflictReport[];
}

export function computeConsensus(agents: AgentSignal[]): ConsensusResult {
  const totalW = agents.reduce((s, a) => s + a.weight, 0) || 1;
  const score = agents.reduce((s, a) => s + a.score * a.weight, 0) / totalW;
  const bias: Bias = score > 8 ? "bullish" : score < -8 ? "bearish" : "neutral";

  const breakdown: ConsensusBreakdown[] = agents.map((a) => ({
    agentId: a.id,
    label: a.label,
    bias: a.bias,
    score: +a.score.toFixed(1),
    confidence: Math.round(a.confidence),
    weight: +a.weight.toFixed(3),
    contribution: +(a.score * a.weight).toFixed(2),
    agreement: a.bias !== "neutral" && a.bias === bias,
  }));

  // Agreement = fraction of directional weight aligned with composite bias.
  const directional = agents.filter((a) => a.bias !== "neutral");
  const alignedW = directional
    .filter((a) => a.bias === bias)
    .reduce((s, a) => s + a.weight, 0);
  const directionalW = directional.reduce((s, a) => s + a.weight, 0) || 1;
  const agreement = bias === "neutral" ? 0.5 : alignedW / directionalW;

  // Conflict resolution — flag any pair of agents whose scores diverge sharply
  // and pick a "winner" using weight × confidence.
  const conflicts: ConflictReport[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const delta = Math.abs(a.score - b.score);
      if (delta < 50) continue;
      const wA = a.weight * a.confidence;
      const wB = b.weight * b.confidence;
      const winner = wA >= wB ? a : b;
      const loser  = wA >= wB ? b : a;
      conflicts.push({
        pair: [a.label, b.label],
        delta: +delta.toFixed(1),
        winner: winner.label,
        resolution: `${winner.label} prevails (weight×conf ${(Math.max(wA, wB)).toFixed(0)} vs ${Math.min(wA, wB).toFixed(0)}); discount ${loser.label} until corroborated.`,
      });
    }
  }

  return { bias, score: +score.toFixed(2), agreement: +agreement.toFixed(3), breakdown, conflicts };
}
