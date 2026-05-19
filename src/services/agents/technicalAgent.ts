// Technical Intelligence Agent — synthesizes trend, MTF agreement, momentum,
// volatility, breakout pressure and pattern signals into a directional bias.
import type { AgentContext, AgentSignal } from "./types";

export function runTechnicalAgent({ intel }: AgentContext): AgentSignal {
  const drivers: string[] = [];
  const flags: string[] = [];
  let score = 0;
  let n = 0;

  // Multi-timeframe agreement — combine short and macro bias per asset
  const tfBias = (t: { shortBias: string; macroBias: string }) =>
    t.shortBias === t.macroBias ? t.shortBias : "neutral";
  for (const tf of intel.timeframes ?? []) {
    const b = tfBias(tf);
    const dir = b === "bullish" ? 1 : b === "bearish" ? -1 : 0;
    score += dir * (tf.agreement ?? 50) * 0.5;
    n++;
  }
  if (intel.timeframes?.length) {
    const bull = intel.timeframes.filter((t) => tfBias(t) === "bullish").length;
    const bear = intel.timeframes.filter((t) => tfBias(t) === "bearish").length;
    drivers.push(`MTF agreement: ${bull} bull / ${bear} bear across ${intel.timeframes.length} assets`);
    if (Math.abs(bull - bear) <= 1) flags.push("Mixed timeframe alignment — wait for confirmation");
  }

  // Average signal bias
  if (intel.signals.length) {
    const avg = intel.signals.reduce((s, x) => s + (x.action === "BUY" ? x.confidence : x.action === "SELL" ? -x.confidence : 0), 0) / intel.signals.length;
    score += avg * 0.4;
    drivers.push(`Composite signal bias ${avg >= 0 ? "+" : ""}${avg.toFixed(0)}`);
    n++;
  }

  // Breakout pressure
  const squeeze = (intel.breakouts ?? []).filter((b) => b.squeeze > 60).length;
  if (squeeze) drivers.push(`${squeeze} assets in compression — breakout pressure`);
  const earlyMo = (intel.earlyMomentum ?? []).filter((m) => m.score > 65).length;
  if (earlyMo) { drivers.push(`${earlyMo} early-momentum candidates`); score += earlyMo * 3; }

  // Volatility regime
  const avgVol = intel.quotes.reduce((s, q) => s + q.volatility, 0) / Math.max(1, intel.quotes.length);
  if (avgVol > 60) flags.push("Realised volatility elevated — wider stops required");
  if (avgVol < 25) drivers.push("Volatility compressed — directional move probability rising");

  score = Math.max(-100, Math.min(100, score / Math.max(1, n / 2)));
  const bias = score > 10 ? "bullish" : score < -10 ? "bearish" : "neutral";
  const confidence = Math.min(95, 45 + Math.abs(score) * 0.5);

  return {
    id: "technical",
    label: "Technical Intelligence",
    bias, score, confidence, weight: 0.22,
    headline: bias === "bullish"
      ? "Technical structure constructive — trend and momentum align"
      : bias === "bearish"
      ? "Technical structure deteriorating — distribution risk"
      : "Technical structure two-way — range-bound posture",
    drivers, flags,
  };
}
