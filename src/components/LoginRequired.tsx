import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InterestForm } from "@/components/InterestForm";
import { TrendingUp, LogIn, Home, Mail, Lock, ShieldCheck } from "lucide-react";

const PAGE_NAMES: Record<string, { ar: string; en: string }> = {
  "/dashboard":         { ar: "لوحة التحكم",           en: "the Dashboard" },
  "/markets":           { ar: "الأسواق",                en: "the Markets page" },
  "/heatmap":           { ar: "الخريطة الحرارية",       en: "the Heatmap" },
  "/calendar":          { ar: "التقويم الاقتصادي",     en: "the Economic Calendar" },
  "/paper-trading":     { ar: "محاكي التداول",         en: "Paper Trading" },
  "/wallet":            { ar: "المحفظة",               en: "the Wallet" },
  "/deposit":           { ar: "صفحة الإيداع",          en: "the Deposit page" },
  "/subscription":      { ar: "الاشتراك",              en: "the Subscription page" },
  "/portfolios":        { ar: "المحافظ الاستثمارية",   en: "Investment Portfolios" },
  "/portfolio":         { ar: "المحفظة",               en: "Portfolio" },
  "/external-accounts": { ar: "الربط الخارجي",         en: "External Accounts" },
  "/bank-accounts":     { ar: "الحسابات البنكية",      en: "Bank Accounts" },
  "/advisor":           { ar: "المستشار الذكي",        en: "the AI Advisor" },
  "/ai":                { ar: "المستشار الذكي",        en: "the AI Advisor" },
  "/signals":           { ar: "إشارات التداول",        en: "Trading Signals" },
  "/scanner":           { ar: "سكانر الفرص",           en: "the Opportunity Scanner" },
  "/watchlist":         { ar: "قائمة المتابعة",        en: "the Watchlist" },
  "/growth-plan":       { ar: "خطة النمو",             en: "the Growth Plan" },
  "/alerts":            { ar: "التنبيهات",             en: "Alerts" },
  "/archive":           { ar: "الأرشيف",               en: "Archive" },
  "/members":           { ar: "الأعضاء",               en: "Members" },
  "/profile":           { ar: "الملف الشخصي",          en: "Profile" },
  "/settings":          { ar: "الإعدادات",             en: "Settings" },
};

export function LoginRequired() {
  const { lang, dir, t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [inviteOpen, setInviteOpen] = useState(false);

  const match = Object.keys(PAGE_NAMES).find((k) => path === k || path.startsWith(k + "/"));
  const pageName = match ? PAGE_NAMES[match][lang as "ar" | "en"] : (lang === "ar" ? "هذه الصفحة" : "this page");

  const title = lang === "ar"
    ? "يجب تسجيل الدخول للوصول إلى هذه الصفحة"
    : "Sign in required to access this page";

  const subtitle = lang === "ar"
    ? `الوصول إلى ${pageName} يتطلب تسجيل الدخول.`
    : `Access to ${pageName} requires sign in.`;

  const redirect = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080f] text-foreground" dir={dir}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -end-32 h-[420px] w-[420px] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute bottom-0 -start-32 h-[420px] w-[420px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary shadow-glow">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight">{t("appName")}</span>
          </Link>

          <div className="rounded-2xl border border-border/60 bg-card/70 p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/30">
              <Lock className="h-7 w-7 text-primary" />
            </div>

            <h1 className="font-display text-2xl font-bold leading-tight">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild className="gradient-primary text-primary-foreground shadow-glow">
                <Link to="/auth" search={{ redirect } as never}>
                  <LogIn className="me-2 h-4 w-4" />
                  {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">
                  <Home className="me-2 h-4 w-4" />
                  {lang === "ar" ? "العودة للرئيسية" : "Back to home"}
                </Link>
              </Button>
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="text-primary hover:text-primary">
                    <Mail className="me-2 h-4 w-4" />
                    {lang === "ar" ? "طلب دعوة" : "Request invite"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{lang === "ar" ? "طلب دعوة للانضمام" : "Request an invite"}</DialogTitle>
                  </DialogHeader>
                  <InterestForm onSuccess={() => setInviteOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-warning" />
              <span>
                🔒 {lang === "ar"
                  ? "موقع خاص — التسجيل بدعوة وموافقة المالك"
                  : "Private platform — registration by invite and owner approval"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
