// AI Explainability Graph — nodes/edges so the UI (or external observers) can
// render a directed graph of "why".
import type { AgentSignal } from "@/services/agents/types";
import type { ExplainGraph, ExplainNode, ExplainEdge, Regime } from "./types";

export function buildExplainGraph(
  agents: AgentSignal[],
  regime: Regime,
  composite: { score: number; confidence: number },
): ExplainGraph {
  const nodes: ExplainNode[] = [];
  const edges: ExplainEdge[] = [];

  nodes.push({
    id: "root", kind: "root", label: "Composite decision",
    weight: 1, contribution: composite.score,
    detail: `Score ${composite.score.toFixed(1)} · confidence ${composite.confidence}%`,
  });
  nodes.push({
    id: "regime", kind: "regime", label: `Regime: ${regime}`,
    weight: 0.6, contribution: 0,
    detail: "Regime drives agent weight adaptation.",
  });
  edges.push({ from: "regime", to: "root", weight: 0.6 });

  nodes.push({
    id: "calibration", kind: "calibration", label: "Confidence calibration",
    weight: 0.4, contribution: 0,
    detail: "Platt-style temper using realised hit-rate.",
  });
  edges.push({ from: "calibration", to: "root", weight: 0.4 });

  for (const a of agents) {
    const aId = `agent:${a.id}`;
    nodes.push({
      id: aId, kind: "agent", label: a.label,
      weight: a.weight, contribution: +(a.score * a.weight).toFixed(2),
      detail: a.headline,
    });
    edges.push({ from: aId, to: "root", weight: a.weight });
    a.drivers.slice(0, 4).forEach((d, i) => {
      const dId = `${aId}:d${i}`;
      nodes.push({
        id: dId, kind: "driver", label: d,
        weight: a.weight / Math.max(1, a.drivers.length),
        contribution: +((a.score * a.weight) / Math.max(1, a.drivers.length)).toFixed(2),
        detail: "Driver factor",
      });
      edges.push({ from: dId, to: aId, weight: 1 / Math.max(1, a.drivers.length) });
    });
  }
  return { nodes, edges };
}
