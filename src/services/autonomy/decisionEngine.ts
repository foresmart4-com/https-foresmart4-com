// Decision Engine — converts AI intelligence into an actionable decision.
export type DecisionAction = "enter-long" | "enter-short" | "exit" | "scale-in" | "scale-out" | "skip" | "halt";

export interface DecisionContext {
  asset: string;
  bias: "long" | "short" | "neutral";
  confidence: number;       // 0-100
  edgeScore: number;        // 0-100
  regime: string;
  regimeStable: boolean;
  exposurePct: number;      // current portfolio exposure
  panic: boolean;
  noiseScore: number;       // 0-100
  timingQuality: number;    // 0-100
}

export interface AutoDecision {
  asset: string;
  action: DecisionAction;
  confidence: number;
  rationale: string;
  regime: string;
  ts: number;
}

export function makeDecision(ctx: DecisionContext, threshold = 72): AutoDecision {
  const base = { asset: ctx.asset, regime: ctx.regime, ts: Date.now() };

  if (ctx.panic) return { ...base, action: "halt", confidence: 100, rationale: "Panic regime detected" };
  if (ctx.noiseScore > 75) return { ...base, action: "skip", confidence: ctx.confidence, rationale: "Noise too high" };
  if (!ctx.regimeStable && ctx.confidence < threshold + 8)
    return { ...base, action: "skip", confidence: ctx.confidence, rationale: "Regime unstable, confidence insufficient" };

  if (ctx.confidence < threshold)
    return { ...base, action: "skip", confidence: ctx.confidence, rationale: `Below threshold (${threshold})` };

  if (ctx.bias === "long")
    return { ...base, action: ctx.exposurePct > 30 ? "scale-in" : "enter-long",
      confidence: ctx.confidence,
      rationale: `Long edge ${ctx.edgeScore} · timing ${ctx.timingQuality}` };
  if (ctx.bias === "short")
    return { ...base, action: "enter-short", confidence: ctx.confidence,
      rationale: `Short edge ${ctx.edgeScore} · timing ${ctx.timingQuality}` };

  return { ...base, action: "skip", confidence: ctx.confidence, rationale: "Neutral bias" };
}
