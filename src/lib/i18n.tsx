import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "ar" | "en";

const dict = {
  ar: {
    appName: "كابيتال إيه آي",
    tagline: "نصائح استثمارية ذكية لتنمية رأس المال",
    dashboard: "لوحة التحكم",
    markets: "الأسواق",
    alerts: "التنبيهات",
    archive: "الأرشيف",
    profile: "الملف الشخصي",
    advisor: "المستشار الذكي",
    logout: "تسجيل الخروج",
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    displayName: "الاسم",
    welcome: "مرحباً بك",
    highToday: "أعلى سعر اليوم",
    lowToday: "أقل سعر اليوم",
    dailyChange: "التغير اليومي",
    volume: "حجم التداول",
    currencies: "العملات",
    metals: "المعادن",
    oil: "النفط",
    crypto: "العملات الرقمية",
    stocks: "الأسهم",
    last24h: "آخر 24 ساعة",
    selectAsset: "اختر أصلاً",
    buy: "شراء",
    sell: "بيع",
    hold: "احتفاظ",
    signal: "الإشارة",
    rsi: "مؤشر القوة النسبية",
    sma: "المتوسط المتحرك",
    aiAdvice: "نصيحة الذكاء الاصطناعي",
    askAdvisor: "اطلب نصيحة",
    advisorPlaceholder: "اسأل عن أي استثمار، اخبار، أو سوق...",
    send: "إرسال",
    createAlert: "إنشاء تنبيه",
    symbol: "الرمز",
    condition: "الشرط",
    above: "فوق",
    below: "تحت",
    targetPrice: "السعر المستهدف",
    save: "حفظ",
    delete: "حذف",
    yourAlerts: "تنبيهاتك",
    noAlerts: "لا توجد تنبيهات بعد",
    archiveTitle: "أرشيف بيانات الأسواق",
    snapshot: "حفظ لقطة",
    capturedAt: "وقت الحفظ",
    price: "السعر",
    apiKeys: "مفاتيح API",
    provider: "المزود",
    apiKey: "المفتاح",
    addKey: "إضافة مفتاح",
    language: "اللغة",
    preferredCurrency: "العملة المفضلة",
    saved: "تم الحفظ",
    loading: "جارٍ التحميل...",
    asset: "الأصل",
    change: "التغير",
    quickAdvice: "نصائح سريعة",
    refresh: "تحديث",
  },
  en: {
    appName: "Capital AI",
    tagline: "Smart investment advice to grow your capital",
    dashboard: "Dashboard",
    markets: "Markets",
    alerts: "Alerts",
    archive: "Archive",
    profile: "Profile",
    advisor: "AI Advisor",
    logout: "Sign out",
    login: "Sign in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    displayName: "Name",
    welcome: "Welcome",
    highToday: "Today's High",
    lowToday: "Today's Low",
    dailyChange: "Daily Change",
    volume: "Volume",
    currencies: "Currencies",
    metals: "Metals",
    oil: "Oil",
    crypto: "Crypto",
    stocks: "Stocks",
    last24h: "Last 24h",
    selectAsset: "Select asset",
    buy: "Buy",
    sell: "Sell",
    hold: "Hold",
    signal: "Signal",
    rsi: "RSI",
    sma: "SMA",
    aiAdvice: "AI Advice",
    askAdvisor: "Ask advisor",
    advisorPlaceholder: "Ask about any asset, news, or market...",
    send: "Send",
    createAlert: "Create alert",
    symbol: "Symbol",
    condition: "Condition",
    above: "Above",
    below: "Below",
    targetPrice: "Target price",
    save: "Save",
    delete: "Delete",
    yourAlerts: "Your alerts",
    noAlerts: "No alerts yet",
    archiveTitle: "Market data archive",
    snapshot: "Save snapshot",
    capturedAt: "Captured at",
    price: "Price",
    apiKeys: "API Keys",
    provider: "Provider",
    apiKey: "Key",
    addKey: "Add key",
    language: "Language",
    preferredCurrency: "Preferred currency",
    saved: "Saved",
    loading: "Loading...",
    asset: "Asset",
    change: "Change",
    quickAdvice: "Quick advice",
    refresh: "Refresh",
  },
} as const;

type Key = keyof typeof dict.en;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: Key) => dict[lang][k] ?? k;
  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
