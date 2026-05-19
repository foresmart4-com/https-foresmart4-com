// AI Observability — hallucination heuristics, drift monitoring, quality
// scoring, and rolling recommendation accuracy.
import { memoryAgent } from "./memoryAgent";
import type { AgentSignal } from "./types";

const K_DRIFT = "ai_drift_baseline_v1";

interface DriftBaseline {
  ts: number;
  agentScores: Record<string, number>;
  ensembleScore: number;
}

function read<T>(k: string, fb: T): T {
  if (typeof localStorage === "undefined") return fb;
  try { return JSON.parse(localStorage.getItem(k) ?? "") as T; } catch { return fb; }
}
function write(k: string, v: unknown) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ }
}

export interface ObservabilityReport {
  qualityScore: number;        // 0..100
  hallucinationRisk: number;   // 0..100
  driftScore: number;          // 0..100, higher = more drift
  accuracyWindow: { trades: number; winRate: number; avgReturn: number };
  warnings: string[];
}

export function runObservability(agents: AgentSignal[]): ObservabilityReport {
  const warnings: string[] = [];

  // Hallucination heuristics: high confidence but no drivers, or contradictory
  // direction vs drivers (e.g. bullish bias with all "weakening" drivers).
  let halluc = 0;
  for (const a of agents) {
    if (a.confidence > 70 && a.drivers.length < 2) {
      halluc += 25;
      warnings.push(`${a.label}: high confidence with thin evidence base.`);
    }
    const negWords = a.drivers.filter((d) => /(weak|down|bear|fall|risk-off|tighten)/i.test(d)).length;
    const posWords = a.drivers.filter((d) => /(strong|up|bull|rally|risk-on|ease|support)/i.test(d)).length;
    if (a.bias === "bullish" && negWords > posWords + 1) {
      halluc += 20;
      warnings.push(`${a.label}: bullish bias contradicted by drivers.`);
    }
    if (a.bias === "bearish" && posWords > negWords + 1) {
      halluc += 20;
      warnings.push(`${a.label}: bearish bias contradicted by drivers.`);
    }
  }
  halluc = Math.min(100, halluc);

  // Drift monitoring: compare to last baseline (per session)
  const ensembleScore = agents.reduce((s, a) => s + a.score * a.weight, 0);
  const agentScores: Record<string, number> = Object.fromEntries(agents.map((a) => [a.id, a.score]));
  const prev = read<DriftBaseline | null>(K_DRIFT, null);
  let driftScore = 0;
  if (prev) {
    const deltas = Object.entries(agentScores).map(([id, s]) => Math.abs(s - (prev.agentScores[id] ?? s)));
    driftScore = Math.min(100, Math.round(deltas.reduce((x, y) => x + y, 0) / Math.max(1, deltas.length)));
    if (driftScore > 60) warnings.push("Model drift elevated — recent regime shift detected.");
  }
  write(K_DRIFT, { ts: Date.now(), agentScores, ensembleScore });

  const perf = memoryAgent.performance();
  const winBonus = perf.trades >= 5 ? perf.winRate * 30 : 15;
  const qualityScore = Math.max(
    0, Math.min(100, Math.round(60 - halluc * 0.35 - driftScore * 0.2 + winBonus)),
  );

  return {
    qualityScore, hallucinationRisk: halluc, driftScore,
    accuracyWindow: perf, warnings,
  };
}
