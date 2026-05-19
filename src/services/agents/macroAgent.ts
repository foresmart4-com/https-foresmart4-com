// Macro Intelligence Agent — interprets rates, inflation, GDP, oil, central
// banks and upcoming economic events into a single directional bias.
import type { AgentContext, AgentSignal } from "./types";

export function runMacroAgent({ intel }: AgentContext): AgentSignal {
  const dxy = intel.quotes.find((q) => q.key === "DXY");
  const oil = intel.quotes.find((q) => q.key === "OIL");
  const gold = intel.quotes.find((q) => q.key === "XAU");

  const drivers: string[] = [];
  const flags: string[] = [];
  let score = 0;

  if (dxy) {
    score -= dxy.momentum * 6;
    drivers.push(`USD momentum ${dxy.momentum >= 0 ? "+" : ""}${dxy.momentum.toFixed(2)}% — ${dxy.momentum > 0 ? "tightening liquidity" : "easing liquidity"}`);
  }
  if (oil) {
    score += oil.momentum * 2 - Math.max(0, oil.volatility - 50) * 0.4;
    drivers.push(`Oil drift ${oil.momentum >= 0 ? "+" : ""}${oil.momentum.toFixed(2)}% (vol ${Math.round(oil.volatility)})`);
    if (oil.volatility > 65) flags.push("Energy volatility elevated — inflation pass-through risk");
  }
  if (gold) {
    score += gold.momentum * 3;
    drivers.push(`Gold ${gold.momentum >= 0 ? "+" : ""}${gold.momentum.toFixed(2)}% — risk-off proxy ${gold.momentum > 0 ? "firming" : "softening"}`);
  }

  // Macro-relevant events (rates, CPI, FOMC, central bank)
  const macroEvents = intel.events.filter((e) =>
    /(rate|cpi|inflation|gdp|fomc|ecb|boj|payroll|jobs|fed)/i.test(`${e.title} ${e.description ?? ""}`),
  );
  if (macroEvents.length) {
    drivers.push(`${macroEvents.length} macro events in window`);
    const hi = macroEvents.filter((e) => e.impact === "high" || e.impactScore >= 70).length;
    if (hi) flags.push(`${hi} high-impact macro events imminent — event-driven volatility likely`);
    score -= hi * 4; // event uncertainty trims bias
  }

  // Regime cross-check
  if (intel.regime?.regime === "risk_off" || intel.regime?.regime === "panic") {
    flags.push("Cross-asset regime risk-off");
    score -= 15;
  } else if (intel.regime?.regime === "trending_bull") {
    score += 10;
  }

  score = Math.max(-100, Math.min(100, score));
  const bias = score > 12 ? "bullish" : score < -12 ? "bearish" : "neutral";
  const confidence = Math.min(95, 40 + Math.abs(score) * 0.55 + macroEvents.length * 2);

  return {
    id: "macro",
    label: "Macro Intelligence",
    bias, score, confidence, weight: 0.22,
    headline: bias === "bullish"
      ? "Macro backdrop tilts supportive — liquidity bias positive"
      : bias === "bearish"
      ? "Macro backdrop tightening — risk-asset headwind"
      : "Macro cross-currents balanced — event-driven posture",
    drivers, flags,
  };
}
