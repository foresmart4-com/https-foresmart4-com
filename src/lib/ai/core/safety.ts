export const AI_CORE_VERSION = "foresmart-intelligence-v1";
export const AI_UNAVAILABLE_AR = "المصدر غير متاح حالياً";
export const AI_INSUFFICIENT_HISTORY_AR = "لا توجد بيانات تاريخية كافية بعد";

export const AI_SAFETY_FLAGS = {
  liveTrading: false,
  executionAgent: false,
  secretsExposed: false,
} as const;

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function safeObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value) ? value as T : fallback;
}

export async function safeRead<T>(reader: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await reader();
  } catch {
    return fallback;
  }
}
