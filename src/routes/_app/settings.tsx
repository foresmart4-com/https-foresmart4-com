import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/lib/use-access";
import { supabase } from "@/integrations/supabase/client";
import { getMySubscription } from "@/lib/payments.functions";
import { STRIPE_LOOKUP_KEYS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings as SettingsIcon, Globe2, User as UserIcon, Key, Crown, Wallet,
  Building, Link2, Bell, LogOut, ChevronRight, Globe, ShieldAlert, ArrowDownToLine, Sparkles,
  Activity, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminReviewPanel } from "@/components/AdminReviewPanel";
import { SystemReadinessPanel } from "@/components/SystemReadinessPanel";
import { PaymentLinksSettings } from "@/components/PaymentLinksSettings";
import { ProductionRoadmap } from "@/components/ProductionRoadmap";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang, dir } = useI18n();
  const { isAdmin } = useAccess();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState("USD");
  const subFn = useServerFn(getMySubscription);
  const { data: sub } = useQuery({ queryKey: ["my-sub-settings"], queryFn: () => subFn() });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_currency").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.preferred_currency) setCurrency(data.preferred_currency); });
  }, [user]);

  const saveCurrency = async (v: string) => {
    setCurrency(v);
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, preferred_currency: v, updated_at: new Date().toISOString(),
    });
    if (error) toast.error(error.message); else toast.success(t("saved"));
  };

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  const links = [
    { to: "/profile", icon: UserIcon, label: t("profile"), desc: lang === "ar" ? "الاسم والبريد والمعلومات الشخصية" : "Name, email, personal info" },
    { to: "/profile", icon: Key, label: t("apiKeys"), desc: lang === "ar" ? "مفاتيح Alpha Vantage و Twelve Data وغيرها" : "Alpha Vantage, Twelve Data and others" },
    { to: "/subscription", icon: Crown, label: lang === "ar" ? "الاشتراك والفوترة" : "Subscription & Billing", desc: lang === "ar" ? "إدارة خطة الاشتراك وطرق الدفع" : "Manage your plan and payment methods" },
    { to: "/wallet", icon: Wallet, label: lang === "ar" ? "المحفظة" : "Wallet", desc: lang === "ar" ? "الرصيد والمعاملات" : "Balance and transactions" },
    { to: "/deposit", icon: ArrowDownToLine, label: lang === "ar" ? "الإيداع" : "Deposit", desc: lang === "ar" ? "إنشاء طلب إيداع وعرض السجل" : "Create deposit request and view history" },
    { to: "/bank-accounts", icon: Building, label: lang === "ar" ? "الحسابات البنكية" : "Bank Accounts", desc: lang === "ar" ? "إدارة حساباتك البنكية" : "Manage your bank accounts" },
    { to: "/external-accounts", icon: Link2, label: lang === "ar" ? "الربط الخارجي" : "External Accounts", desc: lang === "ar" ? "الربط مع الوسطاء والمنصات" : "Connect brokers and platforms" },
    { to: "/alerts", icon: Bell, label: t("alerts"), desc: lang === "ar" ? "إدارة تنبيهات الأسعار" : "Manage price alerts" },
  ];

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <SettingsIcon className="h-7 w-7 text-primary" />
        {lang === "ar" ? "الضبط" : "Settings"}
      </h1>

      <div className="grid gap-6">
        {/* Preferences */}
        <section className="rounded-xl gradient-card border border-border p-5 shadow-card space-y-4">
          <h2 className="font-display text-lg font-semibold">
            {lang === "ar" ? "التفضيلات" : "Preferences"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 flex items-center gap-2">
                <Globe2 className="h-4 w-4" />{t("language")}
              </Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "ar" | "en")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("preferredCurrency")}</Label>
              <Select value={currency} onValueChange={saveCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["SAR","USD","EUR","GBP","JPY","AED","EGP","KWD","CHF","CAD","AUD","TRY","CNY"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{lang === "ar" ? "درجة المخاطر المفضلة" : "Risk tolerance"}</Label>
              <Select defaultValue="medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{lang === "ar" ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="medium">{lang === "ar" ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="high">{lang === "ar" ? "مرتفعة" : "High"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{lang === "ar" ? "تنبيهات السوق" : "Market alerts"}</Label>
              <Select defaultValue="on">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">{lang === "ar" ? "مفعّلة" : "Enabled"}</SelectItem>
                  <SelectItem value="off">{lang === "ar" ? "معطّلة" : "Disabled"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs">
            <div className="font-semibold text-success">{lang === "ar" ? "حالة الدعوة والموافقة" : "Invite & approval status"}</div>
            <div className="mt-0.5 text-muted-foreground">
              {lang === "ar" ? "حسابك تم اعتماده من قِبَل المالك." : "Your account has been approved by the owner."}
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold">
            {lang === "ar" ? "إدارة الحساب" : "Account Management"}
          </h2>
          <ul className="divide-y divide-border">
            {links.map((l, i) => (
              <li key={i}>
                <Link
                  to={l.to}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 rounded-md px-2 -mx-2"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <l.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{l.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.desc}</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`} />
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link to="/members" className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 rounded-md px-2 -mx-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{t("members")}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {lang === "ar" ? "إدارة الأعضاء والصلاحيات" : "Manage members and roles"}
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`} />
                </Link>
              </li>
            )}
          </ul>

          {isAdmin && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" />
                {lang === "ar" ? "خاص بالمطور" : "Developer only"}
              </div>
              <Link
                to="/domain"
                className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 rounded-md px-2 -mx-2"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {lang === "ar" ? "ضبط الدومين" : "Domain Settings"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {lang === "ar" ? "ربط وإدارة دومين الموقع المخصص" : "Connect and manage the custom site domain"}
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`} />
              </Link>
            </div>
          )}
        </section>

        {/* Subscription & trial */}
        <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              {lang === "ar" ? "الاشتراك الحالي" : "Current subscription"}
            </h2>
            <Link to="/subscription"><Button size="sm" variant="outline">{lang === "ar" ? "إدارة" : "Manage"}</Button></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{lang === "ar" ? "الحالة" : "Status"}</div>
              <div className="mt-1">
                <Badge variant={sub?.status === "active" ? "default" : "secondary"}>
                  {sub?.status ?? (lang === "ar" ? "بدون اشتراك" : "No subscription")}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{lang === "ar" ? "نهاية التجربة المجانية" : "Trial ends"}</div>
              <div className="mt-1 font-medium">
                {sub?.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{lang === "ar" ? "نهاية الدورة" : "Period ends"}</div>
              <div className="mt-1 font-medium">
                {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span>{lang === "ar"
              ? "تشمل التجربة المجانية 14 يوم من جميع ميزات الخطة الأساسية."
              : "Free trial includes 14 days of all Basic plan features."}</span>
          </div>
        </section>

        {/* Payment links / deposit settings */}
        <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
              {lang === "ar" ? "روابط الدفع والإيداع" : "Payment links & deposits"}
            </h2>
            <Link to="/deposit"><Button size="sm">{lang === "ar" ? "فتح صفحة الإيداع" : "Open deposit"}</Button></Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "روابط الدفع المستقبلية (Moyasar / PayTabs / Tap) ستظهر هنا فور التفعيل."
              : "Future payment links (Moyasar / PayTabs / Tap) will appear here once enabled."}
          </p>
          {isAdmin && (
            <details className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <summary className="cursor-pointer font-semibold">
                {lang === "ar" ? "Stripe lookup keys المطلوبة لاحقاً" : "Required Stripe lookup keys"}
              </summary>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px]">
                {STRIPE_LOOKUP_KEYS.map((k) => <li key={k}>• {k}</li>)}
              </ul>
            </details>
          )}
        </section>

        {/* System Status (admin only) */}
        {isAdmin && (
          <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Activity className="h-5 w-5 text-primary" />
              {lang === "ar" ? "حالة الأنظمة (System Status)" : "System Status"}
              <Badge variant="outline" className="ms-2 text-[10px]">MVP</Badge>
            </h2>
            <ul className="divide-y divide-border text-sm">
              {([
                { ar: "بيانات الأسهم (أسواق عالمية)", en: "Stock data", state: "mock", note_ar: "Mock — جاهز للربط (Twelve Data / Alpha Vantage)", note_en: "Mock — ready to wire (Twelve Data / Alpha Vantage)" },
                { ar: "العملات الرقمية (CoinGecko)", en: "Crypto (CoinGecko)",            state: "ok",   note_ar: "متصل مباشرة — تحديث كل 60 ثانية",                note_en: "Live — refreshes every 60s" },
                { ar: "محرك الذكاء الاصطناعي للسوق", en: "AI Market Intelligence",       state: "mock", note_ar: "Mock Engine Active — أخبار/اقتصاد كلي تجريبية", note_en: "Mock engine active — news/macro are mock" },
                { ar: "التداول الآلي",              en: "Auto Trading",                  state: "mock", note_ar: "Simulation Only — Paper trading فقط",          note_en: "Simulation only — paper trading" },
                { ar: "وسيط التداول",               en: "Broker API",                    state: "disabled", note_ar: "Not Connected — يحتاج ربط Broker آمن",       note_en: "Not connected — requires secure broker wiring" },
                { ar: "الدفع",          en: "Payments",         state: "disabled", note_ar: "Manual Review — يحتاج Stripe lookup keys", note_en: "Manual review — needs Stripe lookup keys" },
                { ar: "التحويل البنكي", en: "Bank Transfer",    state: "ok",       note_ar: "Manual Review — مراجعة يدوية للإيداع",      note_en: "Manual review for deposits" },
                { ar: "السحب",          en: "Withdrawals",      state: "ok",       note_ar: "مراجعة يدوية للسحب",                       note_en: "Manual review for withdrawals" },
                { ar: "اختبار قرارات الذكاء الاصطناعي", en: "AI Decision Testing", state: "ok", note_ar: "Active — متاح داخل AI Analyst", note_en: "Active — available in AI Analyst" },
                { ar: "قواعد الأمان",          en: "Safety Rules",     state: "ok",       note_ar: "Active — حماية مخاطر/ثقة/بيانات تجريبية", note_en: "Active — risk/confidence/mock-data guards" },
                { ar: "التداول الورقي",        en: "Paper Trading",    state: "mock",     note_ar: "Simulation Only — لا تداول حقيقي",        note_en: "Simulation only — no real trading" },
                { ar: "الاشتراكات",     en: "Subscriptions",    state: "mock",     note_ar: "الواجهة جاهزة — الدفع غير مفعّل",            note_en: "UI ready — payment disabled" },
                { ar: "التنبيهات الذكية",  en: "Smart Alerts",     state: "ok",       note_ar: "Active — مبنية على قرارات AI",             note_en: "Active — built on AI decisions" },
                { ar: "مخاطر المحفظة",     en: "Portfolio Risk",   state: "ok",       note_ar: "Active — تحليل تركّز/تنويع",                note_en: "Active — concentration/diversification" },
                { ar: "Backtesting",      en: "Backtesting",      state: "mock",     note_ar: "Mock engine — لاختبار الاستراتيجيات",       note_en: "Mock engine — strategy testing" },
                { ar: "سجل التداول",       en: "Trading Journal",  state: "ok",       note_ar: "Active — تصدير CSV",                       note_en: "Active — CSV export" },
                { ar: "أوضاع التداول",     en: "Trading Modes",    state: "ok",       note_ar: "Conservative / Balanced / Aggressive",     note_en: "Conservative / Balanced / Aggressive" },
              ] as const).map((row, i) => {
                const map = {
                  ok:       { Icon: CheckCircle2,  cls: "text-success",  label_ar: "يعمل",       label_en: "Operational" },
                  mock:     { Icon: AlertTriangle, cls: "text-warning",  label_ar: "تجريبي",     label_en: "Mock" },
                  disabled: { Icon: XCircle,       cls: "text-danger",   label_ar: "غير مفعّل",   label_en: "Disabled" },
                } as const;
                const m = map[row.state]; const Icon = m.Icon;
                return (
                  <li key={i} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="font-medium">{lang === "ar" ? row.ar : row.en}</div>
                      <div className="text-xs text-muted-foreground truncate">{lang === "ar" ? row.note_ar : row.note_en}</div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${m.cls}`}>
                      <Icon className="h-4 w-4" />{lang === "ar" ? m.label_ar : m.label_en}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {lang === "ar"
                ? "هذه اللوحة عرضية للمسؤول فقط، تُلخّص حالة النسخة الحالية كـ MVP قبل ربط الـ APIs الفعلية."
                : "Admin-only overview summarizing this MVP state before wiring real APIs."}
            </p>
          </section>
        )}

        {/* Admin tools */}
        {isAdmin && <PaymentLinksSettings />}
        {isAdmin && <AdminReviewPanel />}
        <ProductionRoadmap />
        {isAdmin && <SystemReadinessPanel />}

        {/* Danger zone */}
        <section className="rounded-xl border border-border p-5">
          <Button variant="outline" onClick={handleSignOut} className="w-full md:w-auto">
            <LogOut className="h-4 w-4 me-2" />
            {t("logout")}
          </Button>
        </section>
      </div>
    </div>
  );
}
