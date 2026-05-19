import type {
  AgentVote, ConsensusDecision, Opportunity, GeoEvent, EconEvent, WeatherEvent, Bias,
} from "./types";

const BASE_WEIGHTS: Record<AgentVote["agent"], number> = {
  macro: 0.2, geo: 0.18, weather: 0.08, technical: 0.2, sentiment: 0.12, quant: 0.15, portfolio: 0.07,
};

const biasScore = (b: Bias): number => (b === "bullish" ? 1 : b === "bearish" ? -1 : 0);

function entropy(p: number[]): number {
  return -p.filter((x) => x > 0).reduce((acc, x) => acc + x * Math.log2(x), 0) / Math.log2(p.length || 2);
}

function voteFromOpportunity(o: Opportunity): AgentVote[] {
  const votes: AgentVote[] = [
    { agent: "technical", bias: o.bias, confidence: o.confidence, weight: BASE_WEIGHTS.technical, rationale: o.drivers[0] ?? "tape" },
    { agent: "quant", bias: o.bias, confidence: Math.min(1, o.confidence * 0.9), weight: BASE_WEIGHTS.quant, rationale: `EV ${o.expectedReturn}%` },
  ];
  if (o.kind === "macro_tailwind") votes.push({ agent: "macro", bias: o.bias, confidence: o.confidence * 0.85, weight: BASE_WEIGHTS.macro, rationale: "macro confluence" });
  if (o.kind === "event_driven") votes.push({ agent: "geo", bias: o.bias, confidence: o.confidence * 0.85, weight: BASE_WEIGHTS.geo, rationale: "event-driven" });
  if (o.kind === "supply_shock") votes.push({ agent: "weather", bias: o.bias, confidence: o.confidence * 0.85, weight: BASE_WEIGHTS.weather, rationale: "supply stress" });
  return votes;
}

export function buildConsensus(
  opportunities: Opportunity[],
  ctx: { geo: GeoEvent[]; econ: EconEvent[]; weather: WeatherEvent[] },
): ConsensusDecision[] {
  return opportunities.map((o) => {
    const votes = voteFromOpportunity(o);

    // Sentiment vote (weak signal from drivers)
    votes.push({
      agent: "sentiment", bias: o.bias, confidence: 0.55,
      weight: BASE_WEIGHTS.sentiment, rationale: "aggregate sentiment lean",
    });

    // Portfolio sanity (caps risk)
    votes.push({
      agent: "portfolio", bias: o.risk > 0.7 ? "neutral" : o.bias, confidence: 0.6,
      weight: BASE_WEIGHTS.portfolio, rationale: "risk budget check",
    });

    const totalW = votes.reduce((a, v) => a + v.weight, 0);
    const score = votes.reduce((a, v) => a + v.weight * v.confidence * biasScore(v.bias), 0) / totalW;
    const confidence = Math.min(1, votes.reduce((a, v) => a + v.weight * v.confidence, 0) / totalW);

    const bullW = votes.filter((v) => v.bias === "bullish").reduce((a, v) => a + v.weight, 0) / totalW;
    const bearW = votes.filter((v) => v.bias === "bearish").reduce((a, v) => a + v.weight, 0) / totalW;
    const neuW = 1 - bullW - bearW;
    const uncertainty = entropy([bullW, bearW, neuW]);
    const conflict = 1 - Math.max(bullW, bearW, neuW);

    const bias: Bias = score > 0.15 ? "bullish" : score < -0.15 ? "bearish" : "neutral";

    return {
      symbol: o.asset,
      bias,
      score: +score.toFixed(3),
      confidence: +confidence.toFixed(3),
      uncertainty: +uncertainty.toFixed(3),
      votes,
      conflict: +conflict.toFixed(3),
    } satisfies ConsensusDecision;
  });
}
