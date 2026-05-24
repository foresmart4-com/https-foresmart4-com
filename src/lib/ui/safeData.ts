import { Activity } from "lucide-react";

export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ("data" in obj && Array.isArray(obj.data)) return obj.data as T[];
    if ("items" in obj && Array.isArray(obj.items)) return obj.items as T[];
    if ("results" in obj && Array.isArray(obj.results)) return obj.results as T[];
    if ("signals" in obj && Array.isArray(obj.signals)) return obj.signals as T[];
    if ("events" in obj && Array.isArray(obj.events)) return obj.events as T[];
    if ("providers" in obj && Array.isArray(obj.providers)) return obj.providers as T[];
  }
  return [];
}

export function toObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  return fallback;
}

export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") { const n = Number(value); if (Number.isFinite(n)) return n; }
  return fallback;
}

export function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

export function safeLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return 0;
}

export function safeFilter<T>(value: unknown, predicate: (item: T) => boolean): T[] {
  if (!Array.isArray(value)) return [];
  return (value as T[]).filter(predicate);
}

export function safeProviders<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("providers" in obj && Array.isArray(obj.providers)) return obj.providers as T[];
  }
  return [];
}

export function safeEvents<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("events" in obj && Array.isArray(obj.events)) return obj.events as T[];
  }
  return [];
}

export function safeSignals<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("signals" in obj && Array.isArray(obj.signals)) return obj.signals as T[];
  }
  return [];
}

export function safeSymbols(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export const SafeIcon = Activity;
export function safeIcon(value: unknown): typeof Activity {
  if (typeof value === "function") return value as typeof Activity;
  return Activity;
}
