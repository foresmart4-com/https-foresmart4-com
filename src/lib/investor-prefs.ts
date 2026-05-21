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
  if (r === "low") return ar ? "محافظ" : "Conservative";
  if (r === "high") return ar ? "هجومي" : "Aggressive";
  return ar ? "متوازن" : "Balanced";
}

/**
 * Persistent boolean preference (auto-refresh toggles, etc.) backed by
 * localStorage. Survives reloads and syncs across tabs via the storage event.
 */
export function useBooleanPref(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const storageKey = `foresmart:pref:${key}`;
  const read = (): boolean => {
    if (typeof window === "undefined") return defaultValue;
    const v = window.localStorage.getItem(storageKey);
    if (v === "1") return true;
    if (v === "0") return false;
    return defaultValue;
  };
  const [value, setValueState] = useState<boolean>(defaultValue);
  useEffect(() => {
    setValueState(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setValueState(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const setValue = (v: boolean) => {
    setValueState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, v ? "1" : "0");
  };
  return [value, setValue];
}
