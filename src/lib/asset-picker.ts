// Curated, bilingual asset universe powering the Market Intelligence picker.
// Each category exposes a list of selectable assets with the broker/provider
// hint used to route a quote request.

export type IntelCategory =
  | "us_stock" | "sa_stock" | "crypto"
  | "metal" | "commodity" | "etf_bond";

export interface PickerAsset {
  symbol: string;
  name: string;
  nameAr?: string;
  category: IntelCategory;
}

export const CATEGORY_LABELS: Record<IntelCategory, { ar: string; en: string }> = {
  us_stock:  { ar: "أسهم أمريكية",     en: "US Stocks" },
  sa_stock:  { ar: "أسهم سعودية",      en: "Saudi Stocks" },
  crypto:    { ar: "عملات رقمية",      en: "Crypto" },
  metal:     { ar: "معادن",            en: "Metals" },
  commodity: { ar: "سلع",              en: "Commodities" },
  etf_bond:  { ar: "صناديق وسندات",   en: "ETFs & Bonds" },
};

const US_STOCKS: PickerAsset[] = [
  ["AAPL","Apple","آبل"],["MSFT","Microsoft","مايكروسوفت"],["NVDA","NVIDIA","إنفيديا"],
  ["GOOGL","Alphabet","ألفابت"],["AMZN","Amazon","أمازون"],["META","Meta Platforms","ميتا"],
  ["TSLA","Tesla","تسلا"],["AVGO","Broadcom","برودكوم"],["AMD","AMD","إيه إم دي"],
  ["JPM","JPMorgan","جي بي مورغان"],["V","Visa","فيزا"],["MA","Mastercard","ماستركارد"],
  ["UNH","UnitedHealth","يونايتد هيلث"],["XOM","ExxonMobil","إكسون موبيل"],
  ["JNJ","Johnson & Johnson","جونسون آند جونسون"],["WMT","Walmart","وول مارت"],
  ["COST","Costco","كوستكو"],["NFLX","Netflix","نتفليكس"],["DIS","Disney","ديزني"],
  ["BA","Boeing","بوينغ"],["KO","Coca-Cola","كوكاكولا"],["PEP","PepsiCo","بيبسي"],
  ["INTC","Intel","إنتل"],["ORCL","Oracle","أوراكل"],["CRM","Salesforce","سيلزفورس"],
].map(([s,n,a]) => ({ symbol:s, name:n, nameAr:a, category:"us_stock" as const }));

const SA_STOCKS: PickerAsset[] = [
  ["2222.SR","Saudi Aramco","أرامكو السعودية"],
  ["1120.SR","Al Rajhi Bank","مصرف الراجحي"],
  ["7010.SR","STC","الاتصالات السعودية"],
  ["2010.SR","SABIC","سابك"],
  ["1180.SR","SNB","البنك الأهلي السعودي"],
  ["1010.SR","Riyad Bank","بنك الرياض"],
  ["1150.SR","Alinma Bank","بنك الإنماء"],
  ["2030.SR","SARCO","المصافي"],
  ["4030.SR","Bahri","البحري"],
  ["4002.SR","Mouwasat","المواساة الطبية"],
  ["4321.SR","Cenomi Centers","سينومي سنترز"],
  ["7202.SR","Solutions","علم"],
  ["2280.SR","Almarai","المراعي"],
].map(([s,n,a]) => ({ symbol:s, name:n, nameAr:a, category:"sa_stock" as const }));

const CRYPTO: PickerAsset[] = [
  ["BTC","Bitcoin","بيتكوين"],["ETH","Ethereum","إيثريوم"],["BNB","Binance Coin","بينانس كوين"],
  ["SOL","Solana","سولانا"],["XRP","Ripple","ريبل"],["ADA","Cardano","كاردانو"],
  ["DOGE","Dogecoin","دوجكوين"],["AVAX","Avalanche","أفالانش"],["LINK","Chainlink","تشين لينك"],
  ["DOT","Polkadot","بولكادوت"],["MATIC","Polygon","بوليجون"],["LTC","Litecoin","لايتكوين"],
  ["TRX","Tron","ترون"],["UNI","Uniswap","يونيسواب"],["ATOM","Cosmos","كوزموس"],
].map(([s,n,a]) => ({ symbol:s, name:n, nameAr:a, category:"crypto" as const }));

const METALS: PickerAsset[] = [
  ["XAU/USD","Gold","ذهب"],["XAG/USD","Silver","فضة"],
  ["XPT/USD","Platinum","بلاتين"],["XPD/USD","Palladium","بلاديوم"],
  ["GLD","SPDR Gold ETF","صندوق الذهب SPDR"],
  ["SLV","iShares Silver ETF","صندوق الفضة iShares"],
].map(([s,n,a]) => ({ symbol:s, name:n, nameAr:a, category:"metal" as const }));

const COMMODITIES: PickerAsset[] = [
  ["WTI/USD","WTI Crude Oil","نفط خام WTI"],
  ["BRENT/USD","Brent Crude Oil","نفط خام برنت"],
  ["NG/USD","Natural Gas","غاز طبيعي"],
  ["USO","US Oil Fund ETF","صندوق النفط USO"],
  ["UNG","US Natural Gas ETF","صندوق الغاز UNG"],
  ["CORN","Teucrium Corn Fund","صندوق الذرة"],
  ["WEAT","Teucrium Wheat Fund","صندوق القمح"],
].map(([s,n,a]) => ({ symbol:s, name:n, nameAr:a, category:"commodity" as const }));

const ETFS_BONDS: PickerAsset[] = [
  ["SPY","S&P 500 ETF","صندوق S&P 500"],
  ["QQQ","Nasdaq 100 ETF","صندوق ناسداك 100"],
  ["VOO","Vanguard S&P 500","فانغارد S&P 500"],
  ["VTI","Total US Market ETF","صندوق السوق الأمريكي الشامل"],
  ["VXUS","Total International ETF","الأسواق الدولية"],
  ["TLT","20+ Year Treasury Bond","سندات 20+ سنة"],
  ["IEF","7-10 Year Treasury","سندات 7-10 سنوات"],
  ["SHY","1-3 Year Treasury","سندات 1-3 سنوات"],
  ["AGG","US Aggregate Bond","صندوق السندات الكلي"],
  ["LQD","Investment Grade Bonds","سندات شركات استثمارية"],
  ["HYG","High Yield Bonds","سندات عالية العائد"],
  ["TIP","TIPS Inflation Bonds","سندات محمية من التضخم"],
].map(([s,n,a]) => ({ symbol:s, name:n, nameAr:a, category:"etf_bond" as const }));

export const ASSET_PICKER: Record<IntelCategory, PickerAsset[]> = {
  us_stock: US_STOCKS,
  sa_stock: SA_STOCKS,
  crypto: CRYPTO,
  metal: METALS,
  commodity: COMMODITIES,
  etf_bond: ETFS_BONDS,
};

export function findAsset(category: IntelCategory, symbol: string): PickerAsset | undefined {
  return ASSET_PICKER[category]?.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
}
