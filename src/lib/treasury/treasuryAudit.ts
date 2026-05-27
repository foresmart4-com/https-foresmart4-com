import type { TreasuryAuditEntry } from "./treasuryTypes";

const auditLog: TreasuryAuditEntry[] = [];

export function logTreasuryAudit(entry: Omit<TreasuryAuditEntry, "id" | "timestamp">): TreasuryAuditEntry {
  const record: TreasuryAuditEntry = {
    id: `TAU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLog.unshift(record);
  if (auditLog.length > 500) auditLog.length = 500;
  return record;
}

export function getTreasuryAuditLog(limit = 50): TreasuryAuditEntry[] {
  return auditLog.slice(0, limit);
}
