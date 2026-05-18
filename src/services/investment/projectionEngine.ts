// Projection Engine — Monte-Carlo-lite scenario projections for a plan.
import type { PlanTemplate } from "./planEngine";

export interface ProjectionScenario {
  label: string;
  finalValue: number;
  returnPct: number;
}

export interface ProjectionResult {
  bear: ProjectionScenario;
  base: ProjectionScenario;
  bull: ProjectionScenario;
  expectedReturnPct: number;
  volatilityPct: number;
  curve: { day: number; bear: number; base: number; bull: number }[];
}

export function projectPlan(
  template: PlanTemplate,
  capitalUSDT: number,
  durationDays: number,
  aiConfidence: number,
): ProjectionResult {
  const [lowAnnual, highAnnual] = template.expectedAnnualReturnPct;
  // Pull base toward upper bound when confidence is high.
  const confBias = Math.max(0, Math.min(1, aiConfidence / 100));
  const baseAnnual = lowAnnual + (highAnnual - lowAnnual) * (0.4 + confBias * 0.4);
  const years = durationDays / 365;

  const baseReturn = baseAnnual * years;
  const vol = template.expectedVolatilityPct * Math.sqrt(years);
  const bearReturn = baseReturn - vol * 1.5;
  const bullReturn = baseReturn + vol * 1.2;

  const curve: ProjectionResult["curve"] = [];
  const steps = Math.min(60, Math.max(8, Math.round(durationDays / 5)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.push({
      day: Math.round(t * durationDays),
      bear: +(capitalUSDT * (1 + (bearReturn / 100) * t)).toFixed(2),
      base: +(capitalUSDT * (1 + (baseReturn / 100) * t)).toFixed(2),
      bull: +(capitalUSDT * (1 + (bullReturn / 100) * t)).toFixed(2),
    });
  }

  const mkScenario = (label: string, ret: number): ProjectionScenario => ({
    label,
    returnPct: +ret.toFixed(2),
    finalValue: +(capitalUSDT * (1 + ret / 100)).toFixed(2),
  });

  return {
    bear: mkScenario("Bear", bearReturn),
    base: mkScenario("Base", baseReturn),
    bull: mkScenario("Bull", bullReturn),
    expectedReturnPct: +baseReturn.toFixed(2),
    volatilityPct: +vol.toFixed(2),
    curve,
  };
}
