import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { DataStatusBadge, type DataStatus } from "@/components/DataStatusBadge";
import { useAutoTrading, ordersToCSV } from "@/lib/autoTrading";
import { useWatchlist } from "@/lib/watchlistStore";
import { computePortfolioRisk } from "@/lib/portfolioRisk";
import { useJournal, journalToCSV, logEvent } from "@/lib/tradingJournal";
import { Activity, Download, PlayCircle, Database, AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type Source = {
  key: string;
  ar: string;
  en: string;
  status: DataStatus;
  hint_ar: string;
  hint_en: string;
};

const SOURCES: Source[] = [
  { key: "coingecko",    ar: "CoinGecko",            en: "CoinGecko",            status: "live",          hint_ar: "متصل مباشرة — لا يحتاج مفتاح",      hint_en: "Live — no key needed" },
  { key: "alpha",        ar: "Alpha Vantage",        en: "Alpha Vantage",        status: "not_connected", hint_ar: "للأسهم العالمية — يحتاج مفتاح API",   hint_en: "Stocks — requires API key" },
  { key: "twelve",       ar: "Twelve Data",          en: "Twelve Data",          status: "not_connected", hint_ar: "بدائل أسهم — يحتاج مفتاح API",       hint_en: "Stock alt — requires API key" },
  { key: "finnhub",      ar: "Finnhub",              en: "Finnhub",              status: "not_connected", hint_ar: "بيانات أمريكية — يحتاج مفتاح API",   hint_en: "US data — requires API key" },
  { key: "saudi",        ar: "مزود السوق السعودي",   en: "Saudi Market Provider", status: "not_connected", hint_ar: "Tadawul/SaudiExchange — مزود مخصص", hint_en: "Tadawul provider — custom" },
  { key: "news",         ar: "News API",             en: "News API",             status: "not_connected", hint_ar: "أخبار + معنويات — يحتاج مفتاح",     hint_en: "News + sentiment — needs key" },
  { key: "ai",           ar: "مزود الذكاء الاصطناعي", en: "AI Provider",          status: "mock",          hint_ar: "محرك تجريبي — جاهز للربط لاحقاً",   hint_en: "Mock engine — wire later" },
  { key: "broker",       ar: "وسيط التداول",         en: "Broker API",           status: "not_connected", hint_ar: "Interactive Brokers / Alpaca — لاحقاً", hint_en: "IB / Alpaca — later" },
  { key: "payments",     ar: "الدفع",                en: "Payments",             status: "not_connected", hint_ar: "Stripe lookup keys مطلوبة",          hint_en: "Stripe lookup keys required" },
];

type CheckResult = { key: string; ar: string; en: string; ok: boolean; warn?: boolean; note_ar?: string; note_en?: string };

function runSystemCheck(args: {
  watchlistCount: number;
  ordersCount: number;
  journalCount: number;
  portfolioRiskScore: number;
  autoEnabled: boolean;
  cycleHaltedAt: number | null;
}): CheckResult[] {
  return [
    { key: "crypto",   ar: "بيانات Crypto (CoinGecko)", en: "Crypto data (CoinGecko)", ok: true,  note_ar: "Live", note_en: "Live" },
    { key: "stocks",   ar: "بيانات الأسهم",              en: "Stocks data",             ok: true,  warn: true, note_ar: "Mock — جاهز للربط", note_en: "Mock — ready to wire" },
    { key: "ai",       ar: "محرك AI",                   en: "AI engine",               ok: true,  warn: true, note_ar: "Mock engine نشط",  note_en: "Mock engine active" },
    { key: "sim",      ar: "محاكاة التداول",            en: "Auto Trading Simulation", ok: args.autoEnabled || args.ordersCount > 0, warn: !args.autoEnabled, note_ar: args.autoEnabled ? "مفعّل" : "متوقف", note_en: args.autoEnabled ? "Enabled" : "Disabled" },
    { key: "watch",    ar: "قائمة المراقبة",            en: "Watchlist",               ok: args.watchlistCount > 0, note_ar: `${args.watchlistCount} أصل`, note_en: `${args.watchlistCount} assets` },
    { key: "portfolio", ar: "تقييم المحفظة",             en: "Portfolio risk",          ok: args.portfolioRiskScore >= 0, warn: args.portfolioRiskScore >= 60, note_ar: `Risk ${args.portfolioRiskScore}`, note_en: `Risk ${args.portfolioRiskScore}` },
    { key: "pay",      ar: "بوابة الدفع",               en: "Payment gateway",         ok: false, note_ar: "غير مفعّل", note_en: "Disabled" },
    { key: "deposit",  ar: "الإيداع / السحب",            en: "Deposit / Withdrawal",    ok: true,  warn: true, note_ar: "Manual Review", note_en: "Manual Review" },
    { key: "admin",    ar: "Admin Console",            en: "Admin Console",           ok: true,  note_ar: "متاح",  note_en: "Available" },
    { key: "docs",     ar: "التوثيق README",            en: "README docs",             ok: true,  note_ar: "محدث", note_en: "Updated" },
    { key: "journal",  ar: "سجل التداول",               en: "Trading journal",         ok: args.journalCount > 0, note_ar: `${args.journalCount} قيد`, note_en: `${args.journalCount} entries` },
    { key: "safety",   ar: "قواعد الأمان",              en: "Safety rules",            ok: !args.cycleHaltedAt, warn: !!args.cycleHaltedAt, note_ar: args.cycleHaltedAt ? "إيقاف طارئ مفعّل" : "نشطة", note_en: args.cycleHaltedAt ? "E-Stop active" : "Active" },
  ];
}

function readinessScore(checks: CheckResult[]): { score: number; gaps: CheckResult[] } {
  const total = checks.length;
  const points = checks.reduce((s, c) => s + (c.ok ? (c.warn ? 0.65 : 1) : 0), 0);
  const score = Math.round((points / total) * 100);
  const gaps = checks.filter((c) => !c.ok || c.warn);
  return { score, gaps };
}

function download(name: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function SystemReadinessPanel() {
  const { lang } = useI18n();
  const { items } = useWatchlist();
  const { settings, orders, haltedAt } = useAutoTrading();
  const journal = useJournal();
  const risk = useMemo(() => computePortfolioRisk(), []);
  const [ran, setRan] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});

  const checks = useMemo(() => runSystemCheck({
    watchlistCount: items.length,
    ordersCount: orders.length,
    journalCount: journal.length,
    portfolioRiskScore: risk.riskScore,
    autoEnabled: settings.enabled,
    cycleHaltedAt: haltedAt,
  }), [items.length, orders.length, journal.length, risk.riskScore, settings.enabled, haltedAt]);

  const { score, gaps } = useMemo(() => readinessScore(checks), [checks]);

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      mvpReadinessScore: score,
      systemStatus: { autoTrading: settings.enabled ? "enabled" : "disabled", mode: settings.tradingMode, haltedAt },
      systemChecks: checks,
      manualReviewSummary: {
        depositRequests: journal.filter((e) => e.source === "deposit").length,
        withdrawalRequests: journal.filter((e) => e.source === "withdrawal").length,
        adminActions: journal.filter((e) => e.actor === "admin").length,
        pendingReview: journal.filter((e) => e.status === "review" || e.status === "manual_review").length,
      },
      autoTradingSimulation: { orders: orders.length, recent: orders.slice(0, 5) },
      auditJournalSummary: {
        total: journal.length,
        critical: journal.filter((e) => e.severity === "critical").length,
        warning: journal.filter((e) => e.severity === "warning").length,
        info: journal.filter((e) => (e.severity ?? "info") === "info").length,
      },
      dataSources: SOURCES.map((s) => ({ key: s.key, status: s.status })),
      paymentPlaceholderStatus: "not_connected",
      aiEngineStatus: "mock",
      productionRoadmap: {
        backend: "not_connected", payments: "not_connected",
        marketData: "partial (CoinGecko live, others mock)", broker: "not_connected",
      },
      backendRequirementsDoc: "BACKEND_REQUIREMENTS.md",
      watchlistCount: items.length,
      portfolioRisk: {
        score: risk.riskScore,
        totalValue: risk.totalValue,
        diversification: risk.diversification,
        largestAsset: risk.largestAsset?.symbol,
      },
      gaps: gaps.map((g) => g.key),
    };
    download(`foresmart_system_report_${Date.now()}.json`, JSON.stringify(report, null, 2));
    toast.success(lang === "ar" ? "تم تصدير التقرير" : "Report exported");
  };

  const exportReportCSV = () => {
    const lines = [
      "section,key,value",
      `meta,generatedAt,${new Date().toISOString()}`,
      `meta,mvpReadinessScore,${score}`,
      `autoTrading,enabled,${settings.enabled}`,
      `autoTrading,mode,${settings.tradingMode}`,
      `autoTrading,orders,${orders.length}`,
      `journal,total,${journal.length}`,
      `journal,critical,${journal.filter((e) => e.severity === "critical").length}`,
      `journal,warning,${journal.filter((e) => e.severity === "warning").length}`,
      `manualReview,deposits,${journal.filter((e) => e.source === "deposit").length}`,
      `manualReview,withdrawals,${journal.filter((e) => e.source === "withdrawal").length}`,
      `portfolio,risk,${risk.riskScore}`,
      `portfolio,value,${risk.totalValue}`,
      ...checks.map((c) => `check,${c.key},${c.ok ? (c.warn ? "warn" : "ok") : "fail"}`),
      ...SOURCES.map((s) => `dataSource,${s.key},${s.status}`),
    ].join("\n");
    download(`foresmart_system_report_${Date.now()}.csv`, lines, "text/csv");
    toast.success(lang === "ar" ? "تم تصدير الملخص CSV" : "Summary CSV exported");
  };

  return (
    <Card className="p-5 space-y-5">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">{lang === "ar" ? "جاهزية النظام (MVP)" : "System Readiness (MVP)"}</h3>
          <Badge variant="outline" className={`text-[10px] ${score >= 80 ? "border-success/40 text-success" : score >= 50 ? "border-warning/40 text-warning" : "border-danger/40 text-danger"}`}>
            {score}/100
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { setRan(true); logEvent({ source: "system", eventKind: "system_check", status: "info", notes: `MVP ${score}/100` }); toast.success(lang === "ar" ? "اكتمل فحص النظام النهائي" : "Final system check done"); }}>
            <PlayCircle className="h-3.5 w-3.5" />{lang === "ar" ? "فحص النظام النهائي" : "Final system check"}
          </Button>
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={exportReport}>
            <FileJson className="h-3.5 w-3.5" />{lang === "ar" ? "تقرير النظام JSON" : "System JSON"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={exportReportCSV}>
            <FileSpreadsheet className="h-3.5 w-3.5" />{lang === "ar" ? "ملخص النظام CSV" : "System CSV"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => {
            if (journal.length === 0) { toast.info(lang === "ar" ? "لا توجد سجلات للتصدير" : "Journal is empty"); return; }
            download(`journal_${Date.now()}.csv`, journalToCSV(journal), "text/csv");
            toast.success(lang === "ar" ? "تم تصدير دفتر التداول" : "Journal exported");
          }}>
            <FileSpreadsheet className="h-3.5 w-3.5" />{lang === "ar" ? "دفتر التداول CSV" : "Journal CSV"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => {
            if (orders.length === 0) { toast.info(lang === "ar" ? "لا توجد أوامر محاكاة" : "No sim orders"); return; }
            download(`sim_orders_${Date.now()}.csv`, ordersToCSV(orders), "text/csv");
            toast.success(lang === "ar" ? "تم تصدير أوامر المحاكاة" : "Sim orders exported");
          }}>
            <FileSpreadsheet className="h-3.5 w-3.5" />{lang === "ar" ? "أوامر المحاكاة CSV" : "Sim CSV"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => {
            download(`portfolio_risk_${Date.now()}.json`, JSON.stringify(risk, null, 2));
            toast.success(lang === "ar" ? "تم تصدير تقرير المحفظة" : "Portfolio report exported");
          }}>
            <FileJson className="h-3.5 w-3.5" />{lang === "ar" ? "مخاطر المحفظة JSON" : "Risk JSON"}
          </Button>
        </div>
      </header>

      {/* MVP Score bar */}
      <div>
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className={`h-full ${score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-danger"}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {score >= 80 ? (lang === "ar" ? "جاهز للاستخدام التجريبي" : "Ready for pilot use")
            : score >= 50 ? (lang === "ar" ? "يحتاج إعدادات إضافية" : "Needs more setup")
            : (lang === "ar" ? "تحذيرات حرجة — يحتاج عمل" : "Critical gaps — needs work")}
        </p>
      </div>

      {/* Checks */}
      <div className="grid gap-1.5 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {c.ok && !c.warn ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> :
               c.ok ? <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" /> :
               <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0" />}
              <span className="truncate">{lang === "ar" ? c.ar : c.en}</span>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{lang === "ar" ? c.note_ar : c.note_en}</span>
          </div>
        ))}
      </div>

      {/* Gaps */}
      {ran && gaps.length > 0 && (
        <div className="rounded border border-warning/30 bg-warning/5 p-3 text-xs">
          <div className="mb-1 font-semibold text-warning">{lang === "ar" ? "ما الذي ينقص للوصول إلى 100%" : "Gaps to reach 100%"}</div>
          <ul className="space-y-0.5 text-muted-foreground">
            {gaps.map((g) => <li key={g.key}>• {lang === "ar" ? g.ar : g.en} — {lang === "ar" ? g.note_ar : g.note_en}</li>)}
          </ul>
        </div>
      )}

      {/* Data Source Manager */}
      <section>
        <header className="mb-2 flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h4 className="font-display text-sm font-semibold">{lang === "ar" ? "إدارة مصادر البيانات" : "Data Source Manager"}</h4>
        </header>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <div key={s.key} className="rounded border border-border bg-muted/20 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{lang === "ar" ? s.ar : s.en}</div>
                <DataStatusBadge status={s.status} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{lang === "ar" ? s.hint_ar : s.hint_en}</div>
              {s.status === "not_connected" && (
                <Input
                  className="mt-2 h-7 text-[11px]"
                  placeholder={lang === "ar" ? "أدخل مفتاح API لاحقاً (لا يُحفظ)" : "API key placeholder (not saved)"}
                  value={keys[s.key] ?? ""}
                  onChange={(e) => setKeys((k) => ({ ...k, [s.key]: e.target.value }))}
                  onBlur={() => setKeys((k) => ({ ...k, [s.key]: "" }))}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1 text-[10px] text-warning">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          {lang === "ar"
            ? "مفاتيح API يجب تخزينها لاحقًا في Backend آمن وليس داخل الواجهة. هذه الحقول للعرض فقط ولا تُحفظ."
            : "API keys must live in a secure backend — not in the UI. These fields are display-only and not saved."}
        </p>
      </section>
    </Card>
  );
}
