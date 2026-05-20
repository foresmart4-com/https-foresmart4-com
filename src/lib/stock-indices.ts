// Canonical S&P 500 and Nasdaq 100 ticker sets used to filter the
// `STOCKS_UNIVERSE.us` companies inside Market Universe.
// Not exhaustive (kept compact for bundle size) — covers the highly traded
// constituents that are visible inside our universe.

export const SP500_SYMBOLS: ReadonlySet<string> = new Set([
  "AAPL","MSFT","NVDA","GOOGL","GOOG","AMZN","META","TSLA","BRK.B","JPM",
  "V","MA","UNH","XOM","JNJ","PG","HD","AVGO","CVX","LLY",
  "ABBV","KO","PEP","MRK","COST","WMT","BAC","MCD","TMO","CSCO",
  "ACN","ABT","NKE","ADBE","NFLX","CRM","DIS","AMD","INTC","QCOM",
  "TXN","IBM","ORCL","NOW","INTU","AMAT","MU","PYPL","UBER","BKNG",
  "MAR","CMCSA","VZ","T","TMUS","BA","LMT","RTX","GE","CAT",
  "DE","HON","UNP","UPS","FDX","DAL","UAL","AAL","LUV","F",
  "GM","GS","MS","WFC","C","BLK","SCHW","AXP","AIG","MET",
  "PRU","TRV","COP","EOG","SLB","OXY","PSX","MPC","VLO","KMI",
  "WMB","NEE","DUK","SO","AEP","EXC","D","PFE","BMY","GILD",
  "AMGN","REGN","VRTX","BIIB","CVS","WBA","ELV","HUM","CI","ISRG",
  "MDT","SYK","BSX","DHR","LIN","APD","SHW","ECL","DD","DOW",
  "FCX","NEM","NUE","TGT","LOW","TJX","DG","DLTR","KR","SBUX",
  "CMG","YUM","MDLZ","KHC","GIS","CL","KMB","MO","PM","EL",
  "LULU","DECK","RL","TPR","NWL","PLD","AMT","CCI","EQIX","SPG",
  "O","PSA","PANW","CRWD","FTNT","DDOG","SNOW","NET","TEAM","WDAY",
  "ROKU","DASH",
]);

export const NASDAQ100_SYMBOLS: ReadonlySet<string> = new Set([
  "AAPL","MSFT","NVDA","GOOGL","GOOG","AMZN","META","TSLA","AVGO","COST",
  "PEP","ADBE","CSCO","NFLX","AMD","INTC","QCOM","TXN","CMCSA","INTU",
  "AMAT","MU","BKNG","ISRG","REGN","VRTX","ADP","MDLZ","HON","SBUX",
  "GILD","LRCX","KLAC","MRVL","PANW","CRWD","FTNT","CDNS","SNPS","MELI",
  "ASML","ABNB","PYPL","ADI","CHTR","MAR","ORLY","MNST","KDP","WDAY",
  "CTAS","ROST","FAST","ODFL","BIIB","ILMN","DXCM","DLTR","EA","DDOG",
  "TEAM","MDB","ZS","OKTA","MRNA","CSGP","EXC","XEL","CCEP","PCAR",
  "PAYX","VRSK","CPRT","ANSS","IDXX","TTD","WBD","CDW","FANG","ON",
  "GFS","SMCI","ARM","TTWO","ALGN","ENPH","SIRI","WBA","LCID","ZM",
]);

export type StockIndex = "sp500" | "nasdaq100" | "all";

export const INDEX_LABELS: Record<StockIndex, { ar: string; en: string }> = {
  all: { ar: "كل الأسواق الأمريكية", en: "All US Markets" },
  sp500: { ar: "S&P 500", en: "S&P 500" },
  nasdaq100: { ar: "Nasdaq 100", en: "Nasdaq 100" },
};

export function inIndex(symbol: string, idx: StockIndex): boolean {
  if (idx === "all") return true;
  if (idx === "sp500") return SP500_SYMBOLS.has(symbol);
  return NASDAQ100_SYMBOLS.has(symbol);
}
