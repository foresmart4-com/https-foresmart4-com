export interface CompanyProfile {
  company: {
    nameAr: string;
    nameEn: string;
    entityType: string;
    cr: string;
    nationalNumber: string;
    currency: string;
    treasuryName: string;
  };
  platformMode: "corporate_internal";
  legalMode: {
    company_owned_platform: true;
    company_capital_only: true;
    corporate_internal_mode: true;
    public_investment_platform: false;
    client_funds_enabled: false;
    outside_investors_allowed: false;
    public_subscription_enabled: false;
  };
  ownershipMode: "company_owned";
}

export const RANEEM_PROFILE: CompanyProfile = {
  company: {
    nameAr: "شركة رنيم للتطوير والاستثمار العقاري",
    nameEn: "Raneem Company For Real Estate Development and Investment",
    entityType: "Limited Liability Company (LLC)",
    cr: "7040932522",
    nationalNumber: "7040932522",
    currency: "SAR",
    treasuryName: "Raneem Capital Treasury",
  },
  platformMode: "corporate_internal",
  legalMode: {
    company_owned_platform: true,
    company_capital_only: true,
    corporate_internal_mode: true,
    public_investment_platform: false,
    client_funds_enabled: false,
    outside_investors_allowed: false,
    public_subscription_enabled: false,
  },
  ownershipMode: "company_owned",
};

export function getCompanyProfile() {
  return {
    ...RANEEM_PROFILE,
    entityType: RANEEM_PROFILE.company.entityType,
    cr: RANEEM_PROFILE.company.cr,
    nationalNumber: RANEEM_PROFILE.company.nationalNumber,
    currency: RANEEM_PROFILE.company.currency,
    treasuryName: RANEEM_PROFILE.company.treasuryName,
  };
}
