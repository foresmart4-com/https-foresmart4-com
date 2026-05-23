export type TreasuryMode = "company_internal";
export type FundingSource = "manual_corporate" | "company_bank_transfer" | "treasury_adjustment";
export type FundingStatus = "pending" | "approved" | "rejected" | "completed";
export type AllocationTarget = "genesis100" | "platform_reserve";

export interface TreasuryStatus {
  treasuryName: string;
  treasuryMode: TreasuryMode;
  treasuryBalance: number;
  reserveBalance: number;
  allocatedBalance: number;
  currency: string;
  fundingCount: number;
  lastFundingAt: string | null;
  fundingSources: FundingSource[];
  personalAccountSupport: false;
  customerBalances: false;
  thirdPartyFunds: false;
}

export interface FundingRecord {
  id: string;
  timestamp: string;
  amount: number;
  currency: string;
  source: FundingSource;
  status: FundingStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  reference: string;
  notes: string;
}

export interface AllocationRecord {
  id: string;
  timestamp: string;
  target: AllocationTarget;
  amount: number;
  currency: string;
  reason: string;
  approvedBy: string;
}

export interface TreasuryAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  amount: number | null;
  balanceBefore: number;
  balanceAfter: number;
  details: string;
}
