/** Cross-surface session intelligence bus — carries the last AI-derived
 * regime and confidence score across Genesis, Advisor, and Market surfaces.
 * localStorage-backed, 30-minute TTL. Never sent to server.
 */
const KEY = "foresmart.session.intel.v1";
const TTL_MS = 30 * 60_000;

export interface SessionIntel {
  regime: string;
  confidence: number;
  ts: number;
}

export const sessionIntelStore = {
  write(intel: Omit<SessionIntel, "ts">): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...intel, ts: Date.now() }));
    } catch {}
  },

  read(): SessionIntel | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as SessionIntel;
      if (Date.now() - d.ts > TTL_MS) { localStorage.removeItem(KEY); return null; }
      return d;
    } catch { return null; }
  },

  clear(): void {
    if (typeof localStorage === "undefined") return;
    try { localStorage.removeItem(KEY); } catch {}
  },
};
