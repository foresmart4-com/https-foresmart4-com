// Regime-aware weight adaptation. Each agent's trust shifts depending on the
// prevailing market regime (e.g. macro matters more in Risk-Off, technical in
// trending regimes, sentiment in Panic / Euphoria).
import type { AgentSignal } from "@/services/agents/types";
import type { Regime } from "./types";

type Adj = Partial<Record<AgentSignal["id"], number>>;

const REGIME_BIAS: Record<Regime, Adj> = {
  "Trending Bullish":  { technical: 1.25, quant: 1.10, macro: 0.95, sentiment: 0.95, portfolio: 1.00 },
  "Trending Bearish":  { technical: 1.20, macro: 1.15, quant: 1.10, sentiment: 1.00, portfolio: 1.05 },
  "Risk-On":           { sentiment: 1.20, technical: 1.10, macro: 0.95, quant: 1.00, portfolio: 1.00 },
  "Risk-Off":          { macro: 1.30, quant: 1.20, portfolio: 1.15, technical: 0.90, sentiment: 0.90 },
  "High Volatility":   { quant: 1.30, macro: 1.10, portfolio: 1.10, technical: 0.95, sentiment: 0.95 },
  "Panic":             { macro: 1.35, sentiment: 1.20, portfolio: 1.25, quant: 1.10, technical: 0.80 },
  "Sideways":          { technical: 1.10, quant: 1.10, sentiment: 1.00, macro: 1.00, portfolio: 1.00 },
};

export function adaptWeights(agents: AgentSignal[], regime: Regime): AgentSignal[] {
  const adj = REGIME_BIAS[regime] ?? {};
  const adapted = agents.map((a) => {
    const k = (adj[a.id] ?? 1);
    return { ...a, weight: Math.max(0.05, Math.min(1.5, a.weight * k)) };
  });
  // Normalise so total ≈ 1
  const total = adapted.reduce((s, a) => s + a.weight, 0) || 1;
  return adapted.map((a) => ({ ...a, weight: +(a.weight / total).toFixed(4) }));
}
