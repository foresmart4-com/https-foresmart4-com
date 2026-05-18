/** Macro brain — heuristic synthesis of global drivers. */
export interface MacroSignal { factor: string; value: number; bias: "risk_on"|"risk_off"|"neutral"; weight: number; }
export interface MacroOutlook { score: number; bias: "risk_on"|"risk_off"|"neutral"; signals: MacroSignal[]; }

export function computeMacroOutlook(input: {
  dxy?: number; yields10y?: number; cpiYoY?: number; vix?: number; oil?: number; gold?: number;
}): MacroOutlook {
  const signals: MacroSignal[] = [];
  const push = (f: string, v: number, bias: MacroSignal["bias"], w: number) =>
    signals.push({ factor: f, value: v, bias, weight: w });

  if (input.dxy != null)     push("DXY", input.dxy, input.dxy > 105 ? "risk_off" : "risk_on", 0.2);
  if (input.yields10y != null) push("US10Y", input.yields10y, input.yields10y > 4.5 ? "risk_off" : "risk_on", 0.2);
  if (input.cpiYoY != null)  push("CPI", input.cpiYoY, input.cpiYoY > 3.5 ? "risk_off" : "risk_on", 0.15);
  if (input.vix != null)     push("VIX", input.vix, input.vix > 22 ? "risk_off" : "risk_on", 0.2);
  if (input.oil != null)     push("OIL", input.oil, input.oil > 95 ? "risk_off" : "neutral", 0.1);
  if (input.gold != null)    push("GOLD", input.gold, input.gold > 2400 ? "risk_off" : "neutral", 0.15);

  let score = 0, wsum = 0;
  for (const s of signals) {
    const v = s.bias === "risk_on" ? 1 : s.bias === "risk_off" ? -1 : 0;
    score += v * s.weight; wsum += s.weight;
  }
  const norm = wsum ? score / wsum : 0;
  const bias: MacroOutlook["bias"] = norm > 0.2 ? "risk_on" : norm < -0.2 ? "risk_off" : "neutral";
  return { score: norm, bias, signals };
}
