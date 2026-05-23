import type { FundingRecord, FundingSource, AllocationRecord } from "./treasuryTypes";
import { logTreasuryAudit } from "./treasuryAudit";

const fundingRecords: FundingRecord[] = [];
const allocationRecords: AllocationRecord[] = [];

export function createFundingRecord(amount: number, source: FundingSource, reference: string, notes: string, currentBalance: number): FundingRecord {
  const record: FundingRecord = {
    id: `FND-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    amount,
    currency: "SAR",
    source,
    status: "completed",
    approvedBy: "admin",
    approvedAt: new Date().toISOString(),
    reference,
    notes,
  };
  fundingRecords.unshift(record);
  if (fundingRecords.length > 200) fundingRecords.length = 200;

  logTreasuryAudit({
    action: "treasury_funding",
    actor: "admin",
    amount,
    balanceBefore: currentBalance,
    balanceAfter: currentBalance + amount,
    details: `Funding via ${source}: ${reference}`,
  });

  return record;
}

export function createAllocationRecord(target: AllocationRecord["target"], amount: number, reason: string, approvedBy: string): AllocationRecord {
  const record: AllocationRecord = {
    id: `ALC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    target,
    amount,
    currency: "SAR",
    reason,
    approvedBy,
  };
  allocationRecords.unshift(record);
  if (allocationRecords.length > 200) allocationRecords.length = 200;
  return record;
}

export function getFundingHistory(limit = 50): FundingRecord[] {
  return fundingRecords.slice(0, limit);
}

export function getAllocationHistory(limit = 50): AllocationRecord[] {
  return allocationRecords.slice(0, limit);
}

export function getFundingCount(): number {
  return fundingRecords.length;
}

export function getLastFundingAt(): string | null {
  return fundingRecords[0]?.timestamp ?? null;
}
