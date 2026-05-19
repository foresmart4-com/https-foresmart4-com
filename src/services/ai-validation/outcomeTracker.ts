// Records AI recommendations and tracks outcomes against realized prices.
// Persists to localStorage with a ring buffer (max 1000 entries).
import type { CombinedRecord, Direction, OutcomeRecord, RecommendationRecord } from "./types";

const REC_KEY = "ai_validation_records_v1";
const MAX_RECORDS = 1000;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function loadRecords(): CombinedRecord[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse<CombinedRecord[]>(localStorage.getItem(REC_KEY), []);
}

function saveRecords(rs: CombinedRecord[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(REC_KEY, JSON.stringify(rs.slice(-MAX_RECORDS))); } catch { /* quota */ }
}

export function recordRecommendation(rec: RecommendationRecord) {
  const rs = loadRecords();
  // De-dup by id
  if (!rs.some((r) => r.id === rec.id)) {
    rs.push({ ...rec });
    saveRecords(rs);
  }
}

export function recordRecommendationsBulk(recs: RecommendationRecord[]) {
  if (!recs.length) return;
  const rs = loadRecords();
  const known = new Set(rs.map((r) => r.id));
  for (const r of recs) if (!known.has(r.id)) rs.push({ ...r });
  saveRecords(rs);
}

function dirFromReturn(retPct: number): Direction {
  if (Math.abs(retPct) < 0.05) return "flat";
  return retPct > 0 ? "up" : "down";
}

export function resolveOutcome(id: string, exitPrice: number, resolvedAt = Date.now()): OutcomeRecord | null {
  const rs = loadRecords();
  const idx = rs.findIndex((r) => r.id === id);
  if (idx < 0 || rs[idx].outcome) return null;
  const rec = rs[idx];
  const retPct = ((exitPrice - rec.entryPrice) / Math.max(1e-9, rec.entryPrice)) * 100;
  const actual = dirFromReturn(retPct);
  const correct =
    rec.predictedDirection === "flat" ? actual === "flat" :
    rec.predictedDirection === actual;
  const outcome: OutcomeRecord = {
    id, resolvedAt, exitPrice,
    realizedReturnPct: +retPct.toFixed(3),
    actualDirection: actual,
    correct,
    ageHrs: Math.max(0, (resolvedAt - rec.ts) / 3.6e6),
  };
  rs[idx] = { ...rec, outcome };
  saveRecords(rs);
  return outcome;
}

/** Auto-resolve any pending recommendations whose horizon has elapsed using current spot prices. */
export function autoResolveExpired(prices: Record<string, number>, now = Date.now()): number {
  const rs = loadRecords();
  let resolved = 0;
  for (const r of rs) {
    if (r.outcome) continue;
    const expired = now - r.ts >= r.horizonHrs * 3.6e6;
    const px = prices[r.symbol];
    if (!expired || !px) continue;
    const retPct = ((px - r.entryPrice) / Math.max(1e-9, r.entryPrice)) * 100;
    const actual = dirFromReturn(retPct);
    r.outcome = {
      id: r.id, resolvedAt: now, exitPrice: px,
      realizedReturnPct: +retPct.toFixed(3),
      actualDirection: actual,
      correct: r.predictedDirection === "flat" ? actual === "flat" : r.predictedDirection === actual,
      ageHrs: (now - r.ts) / 3.6e6,
    };
    resolved++;
  }
  if (resolved) saveRecords(rs);
  return resolved;
}

export function clearAll() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(REC_KEY);
}
