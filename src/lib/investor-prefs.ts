import { useEffect, useState } from "react";

export type RiskTolerance = "low" | "medium" | "high";

const KEY = "foresmart:risk-tolerance";

export function getRiskTolerance(): RiskTolerance {
  if (typeof window === "undefined") return "medium";
  const v = window.localStorage.getItem(KEY);
  return v === "low" || v === "high" ? v : "medium";
}

export function setRiskTolerance(v: RiskTolerance) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v);
  window.dispatchEvent(new CustomEvent("foresmart:risk-changed", { detail: v }));
}

export function useRiskTolerance(): [RiskTolerance, (v: RiskTolerance) => void] {
  const [risk, setRisk] = useState<RiskTolerance>("medium");
  useEffect(() => {
    setRisk(getRiskTolerance());
    const onChange = (e: Event) => {
      const v = (e as CustomEvent).detail as RiskTolerance | undefined;
      if (v) setRisk(v);
      else setRisk(getRiskTolerance());
    };
    window.addEventListener("foresmart:risk-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("foresmart:risk-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return [risk, (v) => { setRisk(v); setRiskTolerance(v); }];
}

/** Max absolute % change allowed in heatmap/recommendations for a given risk profile. */
export function maxVolatilityPctForRisk(r: RiskTolerance): number {
  if (r === "low") return 2;
  if (r === "medium") return 6;
  return Infinity;
}

export function riskLabel(r: RiskTolerance, ar: boolean): string {
  if (r === "low") return ar ? "محافظ (مخاطرة منخفضة)" : "Conservative (Low risk)";
  if (r === "high") return ar ? "هجومي (مخاطرة مرتفعة)" : "Aggressive (High risk)";
  return ar ? "متوازن (مخاطرة متوسطة)" : "Balanced (Medium risk)";
}
