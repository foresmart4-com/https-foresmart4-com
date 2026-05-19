// Explainable AI — builds a reasoning tree, bullish/bearish scenarios and
// probability/confidence explanations from the agent ensemble.
import type { AgentSignal, ReasoningNode, Scenario } from "./types";

export function buildReasoningTree(agents: AgentSignal[]): ReasoningNode {
  return {
    id: "root",
    label: "Composite Conviction",
    contribution: agents.reduce((s, a) => s + a.score * a.weight, 0),
    detail: "Weighted ensemble of specialised intelligence agents.",
    children: agents.map<ReasoningNode>((a) => ({
      id: a.id,
      label: a.label,
      contribution: +(a.score * a.weight).toFixed(1),
      detail: a.headline,
      children: a.drivers.map<ReasoningNode>((d, i) => ({
        id: `${a.id}-d${i}`,
        label: d,
        contribution: +((a.score * a.weight) / Math.max(1, a.drivers.length)).toFixed(1),
        detail: "Driver factor",
      })),
    })),
  };
}

export function buildScenarios(agents: AgentSignal[]): Scenario[] {
  const composite = agents.reduce((s, a) => s + a.score * a.weight, 0);
  const conf = agents.reduce((s, a) => s + a.confidence * a.weight, 0) / Math.max(1, agents.reduce((s, a) => s + a.weight, 0));

  // Probability skew based on composite score (logistic-ish)
  const pBull = Math.round(50 + Math.max(-35, Math.min(35, composite * 0.35)));
  const pBear = Math.round(35 - Math.min(20, Math.max(-20, composite * 0.25)));
  const pBase = Math.max(5, 100 - pBull - pBear);

  return [
    {
      name: "Bullish continuation",
      probability: pBull,
      expectedReturnPct: +(2 + Math.max(0, composite) * 0.06).toFixed(2),
      trigger: "Breadth expansion confirms with macro tailwind intact.",
      defence: "Trail stops under prior structure; reduce on parabolic extension.",
    },
    {
      name: "Range / base case",
      probability: pBase,
      expectedReturnPct: 0,
      trigger: "No new macro catalyst; volatility compresses.",
      defence: "Size light; rotate into low-correlation assets.",
    },
    {
      name: "Bearish reversal",
      probability: pBear,
      expectedReturnPct: +(-(2 + Math.max(0, -composite) * 0.05)).toFixed(2),
      trigger: "Risk-off catalyst (rates shock / liquidity drain) and breadth divergence.",
      defence: "Hard stops, hedge sleeve, deleverage gross exposure.",
    },
  ];
}

export function explainConfidence(agents: AgentSignal[]): { confidence: number; reason: string } {
  const totalW = agents.reduce((s, a) => s + a.weight, 0) || 1;
  const conf = agents.reduce((s, a) => s + a.confidence * a.weight, 0) / totalW;
  const directional = agents.filter((a) => a.bias !== "neutral");
  const agreement = directional.length
    ? Math.abs(directional.filter((a) => a.bias === directional[0].bias).length - directional.length / 2) / directional.length
    : 0;
  const adj = Math.round(conf * (0.85 + agreement * 0.3));
  const reason = `Weighted ensemble confidence ${conf.toFixed(0)}% × agreement ${(agreement * 100).toFixed(0)}% across ${directional.length} directional agents.`;
  return { confidence: Math.min(95, Math.max(20, adj)), reason };
}
