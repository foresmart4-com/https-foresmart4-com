import type { TreasuryStatus, FundingSource } from "./treasuryTypes";
import { createFundingRecord, getFundingHistory, getAllocationHistory, getFundingCount, getLastFundingAt } from "./fundingLedger";
import { logTreasuryAudit, getTreasuryAuditLog } from "./treasuryAudit";

const TREASURY_NAME = "Raneem Capital Treasury";
const CURRENCY = "SAR";
const FUNDING_SOURCES: FundingSource[] = ["manual_corporate", "company_bank_transfer", "treasury_adjustment"];

let treasuryBalance = 500_000;
let reserveBalance = 50_000;
let allocatedBalance = 100_000;

export function getTreasuryStatus(): TreasuryStatus {
  return {
    treasuryName: TREASURY_NAME,
    treasuryMode: "company_internal",
    treasuryBalance,
    reserveBalance,
    allocatedBalance,
    currency: CURRENCY,
    fundingCount: getFundingCount(),
    lastFundingAt: getLastFundingAt(),
    fundingSources: FUNDING_SOURCES,
    personalAccountSupport: false,
    customerBalances: false,
    thirdPartyFunds: false,
  };
}

export function fundTreasury(amount: number, source: FundingSource, reference: string, notes: string) {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive", treasury: getTreasuryStatus() };
  }
  if (!FUNDING_SOURCES.includes(source)) {
    return { success: false, error: "Invalid funding source", treasury: getTreasuryStatus() };
  }

  const record = createFundingRecord(amount, source, reference, notes, treasuryBalance);
  treasuryBalance += amount;

  return {
    success: true,
    record,
    treasury: getTreasuryStatus(),
  };
}

export function getTreasuryHistory() {
  return {
    treasuryName: TREASURY_NAME,
    currency: CURRENCY,
    fundingHistory: getFundingHistory(),
    allocationHistory: getAllocationHistory(),
    auditLog: getTreasuryAuditLog(),
    treasury: getTreasuryStatus(),
  };
}

export { logTreasuryAudit, getTreasuryAuditLog };
