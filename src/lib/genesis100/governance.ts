export interface CorporateGovernanceConfig {
  corporate_internal_mode: true;
  public_investment_platform: false;
  client_funds_enabled: false;
  company_capital_only: true;
  outside_investors_allowed: false;
  public_subscription_enabled: false;
  internal_company_billing: true;

  externalTransfersAllowed: false;
  manualWithdrawalOnly: true;
  aiCanTransferOutsidePlatform: false;

  platform_type: "corporate_internal";
  access_restriction: "company_authorized_only";
  allowed_roles: readonly ["company_admin", "authorized_employee", "internal_user"];
  prohibited_activities: readonly [
    "public_user_registration",
    "customer_money_handling",
    "third_party_pooled_funds",
    "client_asset_custody",
    "public_investment_onboarding",
    "public_subscription_checkout",
  ];
}

export interface CorporateTreasuryArchitecture {
  company_treasury: {
    name: "ForeSmart Company Treasury";
    type: "corporate_treasury";
    personal_account_linkage: false;
    personal_banking_references: false;
    future_linkage: {
      corporate_bank_account: "prepared";
      corporate_broker_account: "prepared";
    };
  };
  platform_wallet_ledger: {
    name: "Platform Wallet Ledger";
    type: "internal_ledger";
    parent: "company_treasury";
  };
  genesis100_wallet: {
    name: "Genesis 100 Isolated Wallet";
    type: "isolated_investment_wallet";
    parent: "platform_wallet_ledger";
    isolated: true;
    company_capital_only: true;
    execution_mode: "paper_trading";
    liveExecutionEnabled: false;
  };
}

export interface CorporateAdminPermissions {
  treasury_control: boolean;
  wallet_funding_control: boolean;
  strategy_approval: boolean;
  ai_execution_mode_control: boolean;
  broker_connection_control: boolean;
  internal_billing_control: boolean;
}

export const CORPORATE_GOVERNANCE: CorporateGovernanceConfig = {
  corporate_internal_mode: true,
  public_investment_platform: false,
  client_funds_enabled: false,
  company_capital_only: true,
  outside_investors_allowed: false,
  public_subscription_enabled: false,
  internal_company_billing: true,

  externalTransfersAllowed: false,
  manualWithdrawalOnly: true,
  aiCanTransferOutsidePlatform: false,

  platform_type: "corporate_internal",
  access_restriction: "company_authorized_only",
  allowed_roles: ["company_admin", "authorized_employee", "internal_user"],
  prohibited_activities: [
    "public_user_registration",
    "customer_money_handling",
    "third_party_pooled_funds",
    "client_asset_custody",
    "public_investment_onboarding",
    "public_subscription_checkout",
  ],
};

export const CORPORATE_TREASURY: CorporateTreasuryArchitecture = {
  company_treasury: {
    name: "ForeSmart Company Treasury",
    type: "corporate_treasury",
    personal_account_linkage: false,
    personal_banking_references: false,
    future_linkage: {
      corporate_bank_account: "prepared",
      corporate_broker_account: "prepared",
    },
  },
  platform_wallet_ledger: {
    name: "Platform Wallet Ledger",
    type: "internal_ledger",
    parent: "company_treasury",
  },
  genesis100_wallet: {
    name: "Genesis 100 Isolated Wallet",
    type: "isolated_investment_wallet",
    parent: "platform_wallet_ledger",
    isolated: true,
    company_capital_only: true,
    execution_mode: "paper_trading",
    liveExecutionEnabled: false,
  },
};

export const DEFAULT_ADMIN_PERMISSIONS: CorporateAdminPermissions = {
  treasury_control: true,
  wallet_funding_control: true,
  strategy_approval: true,
  ai_execution_mode_control: true,
  broker_connection_control: true,
  internal_billing_control: true,
};

export function getCorporateGovernance() {
  return {
    product: "ForeSmart",
    mode: "corporate_internal",
    governance: CORPORATE_GOVERNANCE,
    treasury: CORPORATE_TREASURY,
    adminPermissions: DEFAULT_ADMIN_PERMISSIONS,
    legalNotices: {
      platform_classification: "Private internal corporate investment platform",
      public_investment_services: "Disabled — no public investment onboarding",
      customer_funds: "Not accepted — company capital only",
      third_party_funds: "Not accepted — no pooled fund structures",
      client_custody: "Not provided — no client asset custody",
      genesis100_funding: "Company capital only — no outside investor capital",
      access_policy: "Restricted to company admin and authorized employees only",
    },
  };
}
