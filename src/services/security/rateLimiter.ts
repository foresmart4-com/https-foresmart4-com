// Rate Limiter — in-memory client-side throttling + abuse heuristic.
// Server-side enforcement is the source of truth; this is UX/early-warning only.

interface Bucket { count: number; windowStart: number; lockedUntil: number; }
const BUCKETS = new Map<string, Bucket>();

export interface LimitConfig {
  windowMs: number;
  maxHits: number;
  lockoutMs: number;
}

export const DEFAULT_LIMITS: Record<string, LimitConfig> = {
  login:    { windowMs: 60_000, maxHits: 5,  lockoutMs: 300_000 },
  trade:    { windowMs: 10_000, maxHits: 20, lockoutMs: 60_000 },
  api:      { windowMs: 60_000, maxHits: 120, lockoutMs: 60_000 },
};

export type ThreatLevel = "low" | "elevated" | "high" | "lockout";

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  threat: ThreatLevel;
  resetInMs: number;
  reason?: string;
}

export function hit(key: string, kind: keyof typeof DEFAULT_LIMITS = "api"): LimitResult {
  const cfg = DEFAULT_LIMITS[kind];
  const now = Date.now();
  let b = BUCKETS.get(key);
  if (!b) { b = { count: 0, windowStart: now, lockedUntil: 0 }; BUCKETS.set(key, b); }

  if (b.lockedUntil > now) {
    return { allowed: false, remaining: 0, threat: "lockout", resetInMs: b.lockedUntil - now, reason: "locked" };
  }
  if (now - b.windowStart > cfg.windowMs) { b.count = 0; b.windowStart = now; }
  b.count++;
  const ratio = b.count / cfg.maxHits;
  const threat: ThreatLevel =
    ratio >= 1 ? "lockout" : ratio >= 0.85 ? "high" : ratio >= 0.6 ? "elevated" : "low";
  if (threat === "lockout") { b.lockedUntil = now + cfg.lockoutMs; }
  return {
    allowed: threat !== "lockout",
    remaining: Math.max(0, cfg.maxHits - b.count),
    threat,
    resetInMs: cfg.windowMs - (now - b.windowStart),
  };
}

export interface AbuseSnapshot {
  totalKeys: number;
  lockedKeys: number;
  elevatedKeys: number;
  threat: ThreatLevel;
  alerts: string[];
}

export function snapshotAbuse(): AbuseSnapshot {
  const now = Date.now();
  let locked = 0, elevated = 0;
  const alerts: string[] = [];
  for (const [k, b] of BUCKETS.entries()) {
    if (b.lockedUntil > now) { locked++; alerts.push(`Lockout: ${k}`); }
    else if (b.count > 0 && b.count / DEFAULT_LIMITS.api.maxHits >= 0.6) elevated++;
  }
  const threat: ThreatLevel = locked > 0 ? "lockout" : elevated > 2 ? "high" : elevated > 0 ? "elevated" : "low";
  return { totalKeys: BUCKETS.size, lockedKeys: locked, elevatedKeys: elevated, threat, alerts };
}

export function clearLimiter(): void { BUCKETS.clear(); }
