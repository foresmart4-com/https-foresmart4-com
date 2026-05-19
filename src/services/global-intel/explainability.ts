import type { ConsensusDecision, Opportunity, GeoEvent, EconEvent, WeatherEvent, ExplainPacket } from "./types";

export function buildExplain(
  c: ConsensusDecision,
  o: Opportunity,
  ctx: { geo: GeoEvent[]; econ: EconEvent[]; weather: WeatherEvent[] },
): ExplainPacket {
  const market = o.drivers;
  const geo = ctx.geo.filter((g) => g.marketImpact === o.bias).slice(0, 3).map((g) => g.headline);
  const econ = ctx.econ.filter((e) => e.marketImpact === o.bias).slice(0, 3).map((e) => `${e.indicator} surprise ${e.surprise?.toFixed(2)}`);
  const weather = ctx.weather.filter((w) => w.supplyChainRisk > 0.5).slice(0, 2).map((w) => `${w.kind} (${w.severity}) — supply risk`);

  const risks: string[] = [];
  if (c.conflict > 0.4) risks.push(`Elevated agent disagreement (${(c.conflict * 100).toFixed(0)}%)`);
  if (c.uncertainty > 0.6) risks.push(`High distributional uncertainty`);
  if (o.risk > 0.5) risks.push(`Asset-level risk score ${(o.risk * 100).toFixed(0)}%`);
  if (!risks.length) risks.push("No primary risk flags");

  const summary = `${o.assetName}: ${c.bias} tilt, confidence ${(c.confidence * 100).toFixed(0)}%, horizon ${o.horizonHrs}h.`;

  return {
    summary,
    drivers: { market, geo, econ, weather },
    risks,
    scenarios: o.scenarios.map((s) => ({ ...s, narrative: `${s.label}: ${s.probability * 100}% probability, payoff ${s.payoff}%` })),
    confidence: c.confidence,
  };
}
