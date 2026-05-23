export interface ExecutionAuditEntry {
  id: string;
  timestamp: string;
  orderId: string;
  symbol: string;
  action: string;
  status: string;
  source: string;
  aiDecisionRef: string | null;
  details: string;
}

const auditLog: ExecutionAuditEntry[] = [];

export function logExecutionAudit(entry: Omit<ExecutionAuditEntry, "id" | "timestamp">): ExecutionAuditEntry {
  const record: ExecutionAuditEntry = {
    id: `EXA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLog.unshift(record);
  if (auditLog.length > 500) auditLog.length = 500;
  return record;
}

export function getExecutionAuditLog(limit = 50): ExecutionAuditEntry[] {
  return auditLog.slice(0, limit);
}
