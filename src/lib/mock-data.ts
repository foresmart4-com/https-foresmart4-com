// Mock data for dashboard, markets, and analytics
// All values are illustrative — replace with live APIs later

export type MockKpi = {
  label_ar: string;
  label_en: string;
  value: string;
  change?: string;
  tone: "success" | "danger" | "primary" | "warning" | "muted";
};

export const portfolioKpis: MockKpi[] = [
  { label_ar: "إجمالي رأس المال", label_en: "Total Capital", value: "245,820 SAR", change: "+12.4%", tone: "primary" },
  { label_ar: "الرصيد النقدي", label_en: "Cash Balance", value: "38,120 SAR", change: "", tone: "muted" },
  { label_ar: "قيمة المحفظة", label_en: "Portfolio Value", value: "207,700 SAR", change: "+8.7%", tone: "success" },
  { label_ar: "الربح / الخسارة", label_en: "P/L", value: "+18,420 SAR", change: "+9.7%", tone: "success" },
  { label_ar: "العائد الشهري", label_en: "Monthly Return", value: "+3.2%", tone: "success" },
  { label_ar: "درجة المخاطر", label_en: "Risk Score", value: "متوسطة / Medium", tone: "warning" },
];

// 30-day portfolio performance series (illustrative)
export const portfolioPerformance = Array.from({ length: 30 }, (_, i) => {
  const base = 200000;
  const trend = i * 220;
  const noise = Math.sin(i * 0.7) * 1800 + Math.cos(i * 0.3) * 1200;
  const value = Math.round(base + trend + noise);
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return { date: d.toISOString().slice(5, 10), value };
});

export type MockAlert = {
  id: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  tone: "success" | "danger" | "warning" | "primary";
};

export const aiAlerts: MockAlert[] = [
  { id: "a1", tone: "success",
    title_ar: "إشارة شراء قوية على أرامكو",
    title_en: "Strong buy signal on Aramco",
    body_ar: "تقاطع إيجابي للمتوسطات + ارتفاع حجم التداول 14%.",
    body_en: "Bullish MA crossover + 14% volume spike." },
  { id: "a2", tone: "warning",
    title_ar: "تذبذب مرتفع على ناسداك",
    title_en: "Elevated Nasdaq volatility",
    body_ar: "مؤشر VIX يقترب من 22. خفّض حجم المراكز قصيرة المدى.",
    body_en: "VIX nearing 22. Trim short-term exposure." },
  { id: "a3", tone: "primary",
    title_ar: "الذهب يختبر مقاومة 2,420$",
    title_en: "Gold tests $2,420 resistance",
    body_ar: "كسر المقاومة قد يفتح هدف 2,480$.",
    body_en: "Breakout could open path to $2,480." },
  { id: "a4", tone: "danger",
    title_ar: "تنبيه: ضعف على BTC قصير المدى",
    title_en: "BTC short-term weakness",
    body_ar: "RSI أسفل 40 على إطار الساعة. راقب 62,500$.",
    body_en: "RSI under 40 on 1h. Watch $62,500." },
];

export type MockOpportunity = {
  symbol: string;
  name_ar: string;
  name_en: string;
  signal: "buy" | "sell" | "watch";
  confidence: number;
  change: number;
};

export const topOpportunities: MockOpportunity[] = [
  { symbol: "2222.SR", name_ar: "أرامكو السعودية", name_en: "Saudi Aramco", signal: "buy",   confidence: 87, change: 1.42 },
  { symbol: "NVDA",    name_ar: "إنفيديا",          name_en: "NVIDIA",        signal: "buy",   confidence: 82, change: 2.18 },
  { symbol: "XAU",     name_ar: "الذهب",            name_en: "Gold",          signal: "buy",   confidence: 78, change: 0.94 },
  { symbol: "1120.SR", name_ar: "الراجحي",          name_en: "Al Rajhi Bank", signal: "watch", confidence: 71, change: 0.35 },
  { symbol: "ETH",     name_ar: "إيثيريوم",         name_en: "Ethereum",      signal: "watch", confidence: 65, change: -0.42 },
  { symbol: "WTI",     name_ar: "النفط الخام",      name_en: "Crude Oil WTI", signal: "sell",  confidence: 60, change: -1.21 },
];

export type FeaturedAsset = {
  symbol: string;
  name_ar: string;
  name_en: string;
  price: number;
  currency: string;
  change: number;
  trend: "up" | "down" | "flat";
  aiSignal: "buy" | "sell" | "hold" | "watch";
  risk: "low" | "medium" | "high";
};

export const featuredAssets: FeaturedAsset[] = [
  { symbol: "2222.SR", name_ar: "أرامكو السعودية", name_en: "Saudi Aramco",  price: 28.40,   currency: "SAR", change: 1.42, trend: "up",   aiSignal: "buy",   risk: "low"    },
  { symbol: "1120.SR", name_ar: "الراجحي",          name_en: "Al Rajhi Bank", price: 92.10,   currency: "SAR", change: 0.35, trend: "up",   aiSignal: "watch", risk: "low"    },
  { symbol: "TASI",    name_ar: "تاسي",              name_en: "TASI",          price: 11820,   currency: "SAR", change: 0.62, trend: "up",   aiSignal: "buy",   risk: "medium" },
  { symbol: "S&P 500", name_ar: "ستاندرد آند بورز", name_en: "S&P 500",       price: 5870,    currency: "USD", change: -0.18, trend: "down", aiSignal: "hold",  risk: "medium" },
  { symbol: "NASDAQ",  name_ar: "ناسداك",            name_en: "Nasdaq",        price: 19240,   currency: "USD", change: 0.42, trend: "up",   aiSignal: "buy",   risk: "high"   },
  { symbol: "BTC",     name_ar: "بتكوين",            name_en: "Bitcoin",       price: 64800,   currency: "USD", change: -0.74, trend: "down", aiSignal: "watch", risk: "high"   },
  { symbol: "ETH",     name_ar: "إيثيريوم",          name_en: "Ethereum",      price: 3120,    currency: "USD", change: -0.42, trend: "down", aiSignal: "watch", risk: "high"   },
  { symbol: "XAU",     name_ar: "الذهب",             name_en: "Gold (oz)",     price: 2418,    currency: "USD", change: 0.94, trend: "up",   aiSignal: "buy",   risk: "medium" },
  { symbol: "WTI",     name_ar: "النفط",             name_en: "Crude Oil WTI", price: 78.20,   currency: "USD", change: -1.21, trend: "down", aiSignal: "sell",  risk: "high"   },
];

// Tape used on the auth page
export const tickerItems = [
  { sym: "TASI",    val: "11,820", chg: "+0.62%", up: true  },
  { sym: "أرامكو",  val: "28.40",  chg: "+1.42%", up: true  },
  { sym: "S&P 500", val: "5,870",  chg: "-0.18%", up: false },
  { sym: "NASDAQ",  val: "19,240", chg: "+0.42%", up: true  },
  { sym: "BTC",     val: "64,800", chg: "-0.74%", up: false },
  { sym: "ETH",     val: "3,120",  chg: "-0.42%", up: false },
  { sym: "GOLD",    val: "2,418",  chg: "+0.94%", up: true  },
  { sym: "OIL",     val: "78.20",  chg: "-1.21%", up: false },
  { sym: "USD/SAR", val: "3.7505", chg: "+0.01%", up: true  },
];

export type AllocationSlice = {
  label_ar: string;
  label_en: string;
  value: number;
  color: string;
};

export const portfolioAllocation: AllocationSlice[] = [
  { label_ar: "نقد",              label_en: "Cash",             value: 15.5, color: "hsl(210 70% 55%)" },
  { label_ar: "أسهم سعودية",      label_en: "Saudi Stocks",     value: 32.0, color: "hsl(150 65% 45%)" },
  { label_ar: "أسهم أمريكية",     label_en: "US Stocks",        value: 24.5, color: "hsl(265 70% 60%)" },
  { label_ar: "عملات رقمية",      label_en: "Crypto",           value: 12.0, color: "hsl(35 90% 55%)" },
  { label_ar: "ذهب وسلع",         label_en: "Gold & Commodities", value: 16.0, color: "hsl(45 95% 50%)" },
];

// Transfer fee schedule (in SAR)
export function calcTransferFee(amountSar: number): number {
  if (amountSar <= 0) return 0;
  return amountSar < 1000 ? 5 : 10;
}
export const MONTHLY_WALLET_FEE_PCT = 0.001; // 0.1%

// AI analyst canned answers (mock)
export const analystStarters = [
  { q_ar: "حلّل السوق السعودي اليوم",   q_en: "Analyze the Saudi market today" },
  { q_ar: "قارن بين الذهب وناسداك",      q_en: "Compare Gold vs Nasdaq" },
  { q_ar: "ما مخاطر شراء أرامكو؟",        q_en: "What are the risks of buying Aramco?" },
  { q_ar: "اقترح توزيع محفظة متوازن",     q_en: "Suggest a balanced portfolio allocation" },
];
