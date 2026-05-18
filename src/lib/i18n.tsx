import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "ar" | "en";

const dict = {
  ar: {
    appName: "ForeSmart",
    tagline: "تحليلات مالية بالذكاء الاصطناعي • رؤى تعليمية • ذكاء سوقي",
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
    advisorPlaceholder: "اسأل عن أي أصل أو خبر أو حركة سوقية لأغراض تحليلية وتعليمية...",
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
    members: "الأعضاء",
    pendingTitle: "حسابك قيد المراجعة",
    pendingDesc: "هذا الموقع خاص. حسابك بانتظار موافقة المالك لتفعيل الاشتراك. سيتم إشعارك عند التفعيل.",
    disclaimerTitle: "إخلاء المسؤولية",
    disclaimerBody: "تقدم ForeSmart تحليلات مالية مدعومة بالذكاء الاصطناعي ورؤى تعليمية حول الأسواق فقط. لا نقدم خدمات وساطة أو حفظ أصول أو إدارة استثمارات أو تنفيذ صفقات بأموال حقيقية. جميع المحتويات والإشارات والتنبيهات والمحافظ المعروضة هي لأغراض تحليلية وتعليمية ومحاكاة افتراضية فقط، ولا تشكّل توصية أو استشارة مالية مرخصة. أنت وحدك المسؤول عن أي قرارات تتخذها بناءً على هذه التحليلات.",
    iAccept: "أوافق وأتنازل عن حق المقاضاة",
    mustAccept: "يجب الموافقة على إخلاء المسؤولية للمتابعة",
    role: "الصلاحية",
    activate: "تفعيل اشتراك",
    revoke: "إلغاء",
    member: "عضو",
    admin: "مالك",
    pending: "بانتظار التفعيل",
    subscriber: "مشترك",
    privateNotice: "موقع خاص — التسجيل بدعوة وموافقة المالك",
  },
  en: {
    appName: "ForeSmart",
    tagline: "AI financial analytics • Educational insights • Market intelligence",
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
    members: "Members",
    pendingTitle: "Account pending approval",
    pendingDesc: "This is a private app. Your account is awaiting owner approval to activate your subscription.",
    disclaimerTitle: "Investment Disclaimer",
    disclaimerBody: "All information, advice, signals and analyses provided by this app are for educational and informational purposes only, and do NOT constitute licensed financial advice, an offer, or a recommendation. Investing in financial markets, currencies, metals and crypto carries high risk and may result in the loss of your entire capital. You alone are responsible for your investment decisions and outcomes. The app's owner and providers accept no legal or financial liability for any direct or indirect losses or damages. By using this app you acknowledge that you have read, understood and accepted this disclaimer, and you waive any right to sue the owner over investment decisions made based on its content.",
    iAccept: "I accept and waive my right to sue",
    mustAccept: "You must accept the disclaimer to continue",
    role: "Role",
    activate: "Activate subscription",
    revoke: "Revoke",
    member: "Member",
    admin: "Owner",
    pending: "Pending",
    subscriber: "Subscriber",
    privateNotice: "Private app — registration is by invitation and owner approval",
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
