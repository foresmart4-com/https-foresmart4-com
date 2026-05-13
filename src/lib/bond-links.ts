// External buy links for bond ETFs and US Treasuries.
export const BOND_BUY_LINKS: Record<string, { label: string; url: string }[]> = {
  TLT: [
    { label: "iShares (issuer)", url: "https://www.ishares.com/us/products/239454/ishares-20-year-treasury-bond-etf" },
    { label: "Fidelity", url: "https://www.fidelity.com/etfs/quote/TLT" },
    { label: "Schwab", url: "https://www.schwab.com/research/etfs/quotes/summary/TLT" },
  ],
  IEF: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239456/ishares-710-year-treasury-bond-etf" },
    { label: "Fidelity", url: "https://www.fidelity.com/etfs/quote/IEF" },
  ],
  SHY: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239452/ishares-13-year-treasury-bond-etf" },
    { label: "Fidelity", url: "https://www.fidelity.com/etfs/quote/SHY" },
  ],
  BND: [
    { label: "Vanguard", url: "https://investor.vanguard.com/investment-products/etfs/profile/bnd" },
  ],
  AGG: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239458/ishares-core-total-us-bond-market-etf" },
  ],
  LQD: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239566/ishares-iboxx-investment-grade-corporate-bond-etf" },
  ],
  HYG: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239565/ishares-iboxx-high-yield-corporate-bond-etf" },
  ],
  TIP: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239467/ishares-tips-bond-etf" },
  ],
  EMB: [
    { label: "iShares", url: "https://www.ishares.com/us/products/239572/ishares-jp-morgan-usd-emerging-markets-bond-etf" },
  ],
};

export const TREASURY_DIRECT_LINKS = [
  { label: "TreasuryDirect (شراء سندات أمريكية مباشرة)", url: "https://www.treasurydirect.gov/marketable-securities/" },
  { label: "Fidelity Bonds", url: "https://www.fidelity.com/fixed-income-bonds/individual-bonds/us-treasury" },
  { label: "Schwab Bonds", url: "https://www.schwab.com/fixed-income/treasuries" },
  { label: "Vanguard Bonds", url: "https://investor.vanguard.com/investment-products/bonds" },
];
