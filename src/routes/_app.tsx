import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LoginRequired } from "@/components/LoginRequired";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";
import { LegalFooter } from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  LayoutDashboard, LineChart, Bell, Archive, User as UserIcon,
  Brain, LogOut, Globe2, Menu, Users, Wallet, Building, Briefcase, Link2, Sprout, Crown, Settings, Zap, Eye, Search, Flame, CalendarDays, GraduationCap, Layers, Cpu, Activity, HelpCircle, Compass, History, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import brandLogo from "@/assets/foresmart4-logo.png";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang, dir } = useI18n();
  const { isAdmin } = useAccess();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [path]);

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  if (!user) return <LoginRequired />;

  const hint = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const items: { to: string; icon: typeof LayoutDashboard; label: string; hint: string }[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), hint: hint("نظرة عامة شاملة على حسابك والأسواق", "Overview of your account and markets") },
    { to: "/ai-dashboard", icon: Brain, label: t("nav.aiDashboard"), hint: hint("لوحة الذكاء الاصطناعي والتحليلات اللحظية", "AI dashboard and real-time analytics") },
    { to: "/market-universe", icon: Compass, label: hint("كون الأسهم", "Market Universe"), hint: hint("ابحث في S&P 500 و Nasdaq 100 مع أسعار حقيقية", "Search S&P 500 and Nasdaq 100 with live quotes") },
    { to: "/backtest-lab", icon: GraduationCap, label: t("nav.backtestLab"), hint: hint("اختبر استراتيجيات على بيانات تاريخية", "Test strategies against historical data") },
    { to: "/decision-engine", icon: Cpu, label: t("nav.decisionEngine"), hint: hint("محرك القرار الكمي", "Quantitative decision engine") },
    { to: "/data-fusion", icon: Layers, label: t("nav.dataFusion"), hint: hint("دمج مصادر البيانات المتعددة", "Multi-source data fusion") },
    { to: "/global-intel", icon: Globe2, label: t("nav.globalIntel"), hint: hint("ذكاء جيوسياسي واقتصادي عالمي", "Global geopolitical & macro intel") },
    { to: "/markets", icon: LineChart, label: t("nav.markets"), hint: hint("الأسواق العالمية مباشرة", "Live global markets") },
    { to: "/heatmap", icon: Flame, label: t("nav.heatmap"), hint: hint("خريطة حرارية لأداء الأصول", "Heatmap of asset performance") },
    { to: "/calendar", icon: CalendarDays, label: t("nav.calendar"), hint: hint("التقويم الاقتصادي", "Economic calendar") },
    { to: "/paper-trading", icon: GraduationCap, label: t("nav.simulation"), hint: hint("تداول تجريبي آمن بدون مخاطر", "Risk-free paper trading") },
    { to: "/assets-portfolio", icon: Briefcase, label: hint("محفظة الأصول", "Assets Portfolio"), hint: hint("محفظة شاملة: أسهم، ETFs، سندات، كريبتو، معادن، كاش", "Universal portfolio: stocks, ETFs, bonds, crypto, metals, cash") },
    { to: "/wallet", icon: Wallet, label: t("nav.wallet"), hint: hint("أرصدة Binance الحقيقية (كريبتو فقط)", "Real Binance balances (crypto only)") },
    { to: "/subscription", icon: Crown, label: t("nav.subscription"), hint: hint("خطط الاشتراك والدفع عبر PayPal", "Subscription plans & PayPal checkout") },
    { to: "/billing", icon: Crown, label: t("nav.billing"), hint: hint("الفواتير وحالة الاشتراك", "Billing & subscription status") },
    { to: "/portfolios", icon: Briefcase, label: t("nav.watchlists"), hint: hint("المحافظ والمراقبة", "Portfolios & watchlists") },
    { to: "/external-accounts", icon: Link2, label: t("nav.external"), hint: hint("ربط Alpaca, IBKR, محافظ كريبتو", "Link Alpaca, IBKR, crypto wallets") },
    { to: "/bank-accounts", icon: Building, label: t("nav.banks"), hint: hint("الحسابات البنكية", "Bank accounts") },
    { to: "/advisor", icon: Brain, label: t("nav.advisor"), hint: hint("مستشار AI شخصي", "Personal AI advisor") },
    { to: "/signals", icon: Zap, label: t("nav.signals"), hint: hint("إشارات التداول", "Trade signals") },
    { to: "/scanner", icon: Search, label: t("nav.scanner"), hint: hint("ماسح الفرص اللحظي", "Real-time opportunity scanner") },
    { to: "/watchlist", icon: Eye, label: t("nav.watchlist"), hint: hint("قائمة المراقبة", "Watchlist") },
    { to: "/growth-plan", icon: Sprout, label: t("nav.growthPlan"), hint: hint("خطة نمو رأس المال", "Capital growth plan") },
    { to: "/alerts", icon: Bell, label: t("nav.alerts"), hint: hint("التنبيهات", "Alerts") },
    { to: "/alert-center", icon: Bell, label: t("nav.alertCenter"), hint: hint("مركز التنبيهات", "Alert center") },
    { to: "/portfolio-ai", icon: Briefcase, label: t("nav.portfolioAI"), hint: hint("محفظة مدعومة بالذكاء", "AI-driven portfolio") },
    { to: "/ai-learning", icon: Brain, label: t("nav.aiLearning"), hint: hint("تعلم الذكاء الاصطناعي", "AI learning lab") },
    { to: "/market-intelligence", icon: Brain, label: hint("ذكاء السوق", "Market Intelligence"), hint: hint("ذكاء السوق المتقدم", "Advanced market intelligence") },
    { to: "/market-data-monitor", icon: Activity, label: hint("مراقب بيانات السوق", "Market Data Monitor"), hint: hint("صحة بيانات السوق", "Market data feed health") },
    { to: "/provider-health", icon: Activity, label: hint("صحة المزودين", "Provider Health"), hint: hint("صحة مزودي البيانات", "Data provider health") },
    { to: "/archive", icon: Archive, label: t("nav.archive"), hint: hint("الأرشيف", "Archive") },
    ...(isAdmin ? [{ to: "/members", icon: Users, label: t("nav.members"), hint: hint("إدارة الأعضاء (مشرفون)", "Members admin") }] : []),
    { to: "/help", icon: HelpCircle, label: hint("مركز المساعدة", "Help Center"), hint: hint("شرح المحفظة، Binance، Alpaca، IBKR، الاشتراكات", "Wallet, Binance, Alpaca, IBKR, subscriptions") },
    { to: "/changelog", icon: History, label: hint("سجل التغييرات", "Changelog"), hint: hint("آخر نسخة منشورة من الواجهة مع التاريخ والملخص", "Latest published frontend release with date and summary") },
    { to: "/profile", icon: UserIcon, label: t("nav.profile"), hint: hint("الملف الشخصي", "Profile") },
    { to: "/settings", icon: Settings, label: t("nav.settings"), hint: hint("الإعدادات", "Settings") },
  ];

  const editorUrl = "https://lovable.dev/projects/5a68377c-93dc-42f4-9999-fc0850af1ae2";

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
      {items.map((it) => {
        const active = path === it.to;
        const link = (
          <Link
            key={it.to}
            to={it.to}
            onClick={onItemClick}
            aria-label={it.label}
            title={it.hint}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <it.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
            {!collapsed && <span className="truncate">{it.label}</span>}
          </Link>
        );
        return (
          <Tooltip key={it.to} delayDuration={250}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side={dir === "rtl" ? "left" : "right"} className="max-w-xs">
              <div className="text-xs font-semibold">{it.label}</div>
              <div className="text-[11px] text-muted-foreground">{it.hint}</div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );

  const SidebarFooter = () => (
    <div className="space-y-1 border-t border-sidebar-border p-2">
      <a
        href={editorUrl}
        target="_blank"
        rel="noreferrer"
        title={hint("نشر آخر تحديثات الواجهة إلى الموقع المباشر بنقرة واحدة", "Publish the latest frontend to the live site in one click")}
        className="flex w-full items-center gap-3 rounded-lg gradient-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 min-h-11"
      >
        <Rocket className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{hint("نشر التحديث", "Publish update")}</span>}
      </a>
      <button
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 min-h-11"
      >
        <Globe2 className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{lang === "ar" ? "English" : "العربية"}</span>}
      </button>
      <button
        onClick={handleSignOut}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 min-h-11"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{t("logout")}</span>}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-col border-border bg-sidebar text-sidebar-foreground transition-all duration-200 md:flex",
          dir === "rtl" ? "border-s" : "border-e",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          {!collapsed ? (
            <Link to="/dashboard" className="flex items-center gap-2 truncate">
              <img src={brandLogo} alt={t("appName")} className="h-9 w-9 shrink-0 rounded-lg object-contain" />
              <span className="font-display text-base font-bold truncate">{t("appName")}</span>
            </Link>
          ) : (
            <Link to="/dashboard" className="mx-auto">
              <img src={brandLogo} alt={t("appName")} className="h-8 w-8 rounded-lg object-contain" />
            </Link>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle sidebar" onClick={() => setCollapsed((c) => !c)}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <NavList />
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={dir === "rtl" ? "right" : "left"}
              className="flex w-[85vw] max-w-xs flex-col bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
                <img src={brandLogo} alt={t("appName")} className="h-9 w-9 shrink-0 rounded-lg object-contain" />
                <span className="font-display text-base font-bold truncate">{t("appName")}</span>
              </div>
              <NavList onItemClick={() => setMobileOpen(false)} />
              <SidebarFooter />
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex items-center gap-2 truncate">
            <img src={brandLogo} alt={t("appName")} className="h-7 w-7 rounded-md object-contain" />
            <span className="font-display text-sm font-bold truncate">{t("appName")}</span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label="Toggle language"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            <Globe2 className="h-5 w-5" />
          </Button>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <PaymentTestModeBanner />
          <AccessGate>
            <Outlet />
          </AccessGate>
          <div className="px-4 sm:px-6 py-2 text-center text-[11px] text-muted-foreground">
            ⚠ {t("disclaimerTitle")} — {t("disclaimerBody").slice(0, 140)}…
          </div>
          <LegalFooter />
        </main>
      </div>
    </div>
  );
}
