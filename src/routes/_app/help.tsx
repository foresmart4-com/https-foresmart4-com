import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Wallet, Bitcoin, LineChart, Building2, Crown, GraduationCap, Zap, AlertTriangle, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_app/help")({
  head: () => ({
    meta: [
      { title: "Help Center — ForeSmart" },
      { name: "description", content: "ForeSmart help center: wallet, Binance, Alpaca, Interactive Brokers, subscriptions, paper and live trading." },
    ],
  }),
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><HelpCenterPage /></ErrorBoundary>,
});

type Topic = {
  id: string;
  icon: typeof Wallet;
  title: { ar: string; en: string };
  body: { ar: string; en: string };
};

const TOPICS: Topic[] = [
  {
    id: "wallet",
    icon: Wallet,
    title: { ar: "المحفظة", en: "Wallet" },
    body: {
      ar: "صفحة /wallet تعرض أرصدتك الحقيقية من حساب Binance المربوط، وتُجلب عبر server functions فقط بدون كشف مفاتيح السر للواجهة. الإيداع والسحب معطّلان حاليًا، والدفع مخصص للاشتراكات فقط. لا يتم تنفيذ أي أوامر شراء/بيع من هذه الصفحة طالما LIVE_TRADING_ENABLED=false.",
      en: "The /wallet page shows your real Binance balances pulled through server functions only — secret keys never reach the browser. Deposits and withdrawals are disabled; payments are for subscriptions only. No buy/sell orders run from this page while LIVE_TRADING_ENABLED=false.",
    },
  },
  {
    id: "binance",
    icon: Bitcoin,
    title: { ar: "Binance — للكريبتو فقط", en: "Binance — Crypto only" },
    body: {
      ar: "Binance يُستخدم في ForeSmart لعرض أرصدة العملات الرقمية فقط (BTC, ETH, USDT, …). لا يدعم Binance تداول الأسهم الأمريكية. لتداول الأسهم استخدم Alpaca أو Interactive Brokers بعد ربطهما من صفحة External Accounts.",
      en: "Binance is used in ForeSmart for crypto balances only (BTC, ETH, USDT, …). Binance does NOT trade US equities. For stocks use Alpaca or Interactive Brokers once linked from the External Accounts page.",
    },
  },
  {
    id: "alpaca",
    icon: LineChart,
    title: { ar: "Alpaca للأسهم الأمريكية", en: "Alpaca for US Stocks" },
    body: {
      ar: "Alpaca وسيط أمريكي يدعم الأسهم و ETFs بدون عمولة. ForeSmart يستخدم Alpaca / Finnhub لعرض الأسعار الحقيقية لـ S&P 500 و Nasdaq 100 داخل صفحة Market Universe. تنفيذ الأوامر الحي يبقى معطلًا حتى تظهر الأرصدة وتنجح اختبارات المعاينة.",
      en: "Alpaca is a US broker offering commission-free stocks and ETFs. ForeSmart uses Alpaca / Finnhub to display real quotes for S&P 500 and Nasdaq 100 inside Market Universe. Live order routing stays disabled until balances appear and preview tests pass.",
    },
  },
  {
    id: "ibkr",
    icon: Building2,
    title: { ar: "Interactive Brokers (IBKR)", en: "Interactive Brokers (IBKR)" },
    body: {
      ar: "Interactive Brokers يدعم الأسواق العالمية: الأسهم الأمريكية، الأوروبية، الآسيوية، الخيارات والعقود الآجلة. الربط مع ForeSmart عبر صفحة External Accounts وسيُفعّل لاحقًا بعد اعتماد حساب الشركة. حاليًا للعرض فقط.",
      en: "Interactive Brokers supports global markets: US, European, Asian equities, options and futures. Linking goes through External Accounts and will be enabled after company account approval. Read-only for now.",
    },
  },
  {
    id: "subscription",
    icon: Crown,
    title: { ar: "الاشتراكات", en: "Subscriptions" },
    body: {
      ar: "خطط Quarterly / Semi-annual / Annual تتيح الوصول لمحرك القرار والذكاء الاصطناعي والتنبيهات المتقدمة. الدفع عبر PayPal (sandbox حاليًا). بعد نجاح الدفع تتحوّل حالة اشتراكك تلقائيًا إلى active.",
      en: "Quarterly / Semi-annual / Annual plans unlock the decision engine, AI features and advanced alerts. Payment is via PayPal (sandbox for now). On successful payment your subscription flips to active automatically.",
    },
  },
  {
    id: "paper",
    icon: GraduationCap,
    title: { ar: "التداول التجريبي (Paper)", en: "Paper Trading" },
    body: {
      ar: "صفحة /paper-trading توفّر بيئة محاكاة آمنة بـ 100,000$ افتراضي. كل العمليات مسجّلة في قاعدة البيانات، ولا تؤثر على أي رصيد حقيقي. مثالية لاختبار الإستراتيجيات قبل تفعيل التداول الحي.",
      en: "/paper-trading provides a safe simulation with a $100,000 virtual balance. All trades are recorded in the database and do not affect any real balance. Ideal for testing strategies before turning on live trading.",
    },
  },
  {
    id: "live",
    icon: Zap,
    title: { ar: "التداول الحقيقي", en: "Live Trading" },
    body: {
      ar: "التداول الحقيقي مقفل حاليًا على مستوى الشركة فقط (صفحة /company-trading للمشرفين). لن يتم تفعيل أي زر تنفيذ قبل: (1) ربط broker حقيقي، (2) ظهور الرصيد الحقيقي، (3) نجاح اختبارات المعاينة، (4) رفع LIVE_TRADING_ENABLED=true يدويًا.",
      en: "Live trading is locked to the company instance (/company-trading, admins only). No execute button is enabled before: (1) a real broker is linked, (2) real balance appears, (3) preview tests pass, (4) LIVE_TRADING_ENABLED is manually set to true.",
    },
  },
];

function HelpCenterPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6" dir={dir}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-bold">{ar ? "مركز المساعدة" : "Help Center"}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "كل ما تحتاج معرفته عن المحفظة، الوسطاء، الاشتراكات، والتداول التجريبي والحقيقي."
            : "Everything you need to know about the wallet, brokers, subscriptions, paper and live trading."}
        </p>
      </div>

      <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            {ar
              ? "تنبيه: Binance يدعم العملات الرقمية فقط. لتداول الأسهم الأمريكية والعالمية استخدم Alpaca أو Interactive Brokers."
              : "Notice: Binance supports crypto only. For US/global stocks use Alpaca or Interactive Brokers."}
          </p>
        </div>
      </Card>

      <Card className="p-2">
        <Accordion type="multiple" className="w-full">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <AccordionItem key={t.id} value={t.id} className="px-2">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-base font-semibold">
                    <Icon className="h-4 w-4 text-primary" />
                    {ar ? t.title.ar : t.title.en}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {ar ? t.body.ar : t.body.en}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/market-universe"><Card className="gradient-card p-4 text-sm hover:border-primary/40"><LineChart className="mb-1 h-4 w-4 text-primary" />{ar ? "كون الأسهم" : "Market Universe"}</Card></Link>
        <Link to="/wallet"><Card className="gradient-card p-4 text-sm hover:border-primary/40"><Wallet className="mb-1 h-4 w-4 text-primary" />{ar ? "المحفظة" : "Wallet"}</Card></Link>
        <Link to="/subscription"><Card className="gradient-card p-4 text-sm hover:border-primary/40"><Crown className="mb-1 h-4 w-4 text-primary" />{ar ? "الاشتراكات" : "Subscriptions"}</Card></Link>
      </div>
    </div>
  );
}
