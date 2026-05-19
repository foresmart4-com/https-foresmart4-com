// Recommendation lifecycle tracking — persisted in localStorage. Each record
// progresses through active → triggered → resolved (or expired/superseded).
// Includes an aging score that decays linearly from creation to expiry so the
// UI can highlight stale signals.
import type { Recommendation, LifecycleStatus } from "./types";

const STORE_KEY = "decision_engine_recs_v1";
const AUDIT_KEY = "decision_engine_audit_v1";
const MAX_RECS = 400;
const MAX_AUDIT = 800;

export interface AuditEntry {
  id: string;
  ts: number;
  recId: string;
  kind: "created" | "status" | "supersede" | "resolve" | "expire";
  before?: Partial<Recommendation>;
  after?: Partial<Recommendation>;
  note?: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export function loadRecommendations(): Recommendation[] {
  return read<Recommendation[]>(STORE_KEY, []);
}
export function loadAudit(): AuditEntry[] {
  return read<AuditEntry[]>(AUDIT_KEY, []);
}

function pushAudit(entry: Omit<AuditEntry, "id" | "ts">) {
  const list = loadAudit();
  list.unshift({ ...entry, id: crypto.randomUUID(), ts: Date.now() });
  write(AUDIT_KEY, list.slice(0, MAX_AUDIT));
}

export function agingScore(rec: Recommendation, now = Date.now()): number {
  const total = Math.max(1, rec.expiresAt - rec.createdAt);
  const elapsed = Math.max(0, now - rec.createdAt);
  return Math.max(0, Math.min(1, 1 - elapsed / total));
}

/** Apply expiry + aging to all stored recs. Mutates store. */
export function reconcileLifecycle(now = Date.now()): Recommendation[] {
  const list = loadRecommendations();
  let changed = false;
  for (const rec of list) {
    if (rec.status === "active" && now >= rec.expiresAt) {
      const before = { status: rec.status };
      rec.status = "expired";
      rec.agingScore = 0;
      pushAudit({ recId: rec.id, kind: "expire", before, after: { status: "expired" }, note: "TTL reached" });
      changed = true;
    } else {
      rec.agingScore = agingScore(rec, now);
    }
  }
  if (changed) write(STORE_KEY, list);
  return list;
}

/** Persist a freshly generated batch. Supersedes prior active recs for the same asset. */
export function persistBatch(recs: Recommendation[]): Recommendation[] {
  const list = loadRecommendations();
  const assets = new Set(recs.map((r) => r.asset));
  for (const old of list) {
    if (assets.has(old.asset) && old.status === "active") {
      const before = { status: old.status };
      old.status = "superseded";
      pushAudit({ recId: old.id, kind: "supersede", before, after: { status: "superseded" }, note: "Replaced by newer recommendation" });
    }
  }
  for (const r of recs) {
    pushAudit({ recId: r.id, kind: "created", after: { action: r.action, confidence: r.confidence, sizePct: r.sizePct } });
  }
  const merged = [...recs, ...list].slice(0, MAX_RECS);
  write(STORE_KEY, merged);
  return merged;
}

export function setStatus(recId: string, status: LifecycleStatus, note?: string): Recommendation | null {
  const list = loadRecommendations();
  const r = list.find((x) => x.id === recId);
  if (!r) return null;
  const before = { status: r.status };
  r.status = status;
  if (status === "triggered" && !r.triggeredAt) r.triggeredAt = Date.now();
  if (status === "resolved" && !r.resolvedAt) r.resolvedAt = Date.now();
  pushAudit({ recId, kind: "status", before, after: { status }, note });
  write(STORE_KEY, list);
  return r;
}

export function resolveRec(recId: string, realizedReturnPct: number): Recommendation | null {
  const list = loadRecommendations();
  const r = list.find((x) => x.id === recId);
  if (!r) return null;
  r.realizedReturnPct = realizedReturnPct;
  r.status = "resolved";
  r.resolvedAt = Date.now();
  pushAudit({ recId, kind: "resolve", after: { realizedReturnPct } });
  write(STORE_KEY, list);
  return r;
}

export interface LifecycleStats {
  total: number;
  active: number;
  triggered: number;
  resolved: number;
  expired: number;
  superseded: number;
  hitRate: number;
  avgRealized: number;
}

export function lifecycleStats(): LifecycleStats {
  const list = loadRecommendations();
  const resolved = list.filter((r) => r.status === "resolved" && typeof r.realizedReturnPct === "number");
  const hits = resolved.filter((r) => {
    const dir = r.action === "BUY" || r.action === "ADD" ? 1 : r.action === "SELL" || r.action === "TRIM" ? -1 : 0;
    return dir !== 0 && Math.sign(r.realizedReturnPct!) === dir;
  }).length;
  return {
    total: list.length,
    active: list.filter((r) => r.status === "active").length,
    triggered: list.filter((r) => r.status === "triggered").length,
    resolved: resolved.length,
    expired: list.filter((r) => r.status === "expired").length,
    superseded: list.filter((r) => r.status === "superseded").length,
    hitRate: resolved.length ? hits / resolved.length : 0,
    avgRealized: resolved.length ? resolved.reduce((s, r) => s + (r.realizedReturnPct ?? 0), 0) / resolved.length : 0,
  };
}

export function compareHistorical(asset: string, lookback = 10): Recommendation[] {
  return loadRecommendations().filter((r) => r.asset === asset).slice(0, lookback);
}
