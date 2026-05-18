import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LoginRequired } from "@/components/LoginRequired";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";
import { LegalFooter } from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, LineChart, Bell, Archive, User as UserIcon,
  Brain, LogOut, Globe2, Menu, TrendingUp, Users, Wallet, Building, Briefcase, Link2, Sprout, Crown, Settings, Zap, Eye, Search, Flame, CalendarDays, GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

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

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  if (!user) return <LoginRequired />;

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { to: "/ai-dashboard", icon: Brain, label: lang === "ar" ? "لوحة الذكاء" : "AI Dashboard" },
    { to: "/markets", icon: LineChart, label: t("markets") },
    { to: "/heatmap", icon: Flame, label: lang === "ar" ? "خريطة حرارية" : "Heatmap" },
    { to: "/calendar", icon: CalendarDays, label: lang === "ar" ? "التقويم الاقتصادي" : "Calendar" },
    { to: "/paper-trading", icon: GraduationCap, label: lang === "ar" ? "محاكاة السوق" : "Market Simulation" },
    { to: "/wallet", icon: Wallet, label: lang === "ar" ? "المحفظة" : "Wallet" },
    { to: "/subscription", icon: Crown, label: lang === "ar" ? "الاشتراك" : "Subscription" },
    { to: "/portfolios", icon: Briefcase, label: lang === "ar" ? "قوائم المتابعة" : "Watchlists" },
    { to: "/external-accounts", icon: Link2, label: lang === "ar" ? "الربط الخارجي" : "External" },
    { to: "/bank-accounts", icon: Building, label: lang === "ar" ? "البنوك" : "Banks" },
    { to: "/advisor", icon: Brain, label: lang === "ar" ? "رؤى AI" : "AI Insights" },
    { to: "/signals", icon: Zap, label: lang === "ar" ? "إشارات السوق" : "Market Signals" },
    { to: "/scanner", icon: Search, label: lang === "ar" ? "سكانر الفرص" : "Scanner" },
    { to: "/watchlist", icon: Eye, label: lang === "ar" ? "المتابعة" : "Watchlist" },
    { to: "/growth-plan", icon: Sprout, label: lang === "ar" ? "خطة النمو" : "Growth Plan" },
    { to: "/alerts", icon: Bell, label: t("alerts") },
    { to: "/archive", icon: Archive, label: t("archive") },
    ...(isAdmin ? [{ to: "/members", icon: Users, label: t("members") }] : []),
    { to: "/profile", icon: UserIcon, label: t("profile") },
    { to: "/settings", icon: Settings, label: lang === "ar" ? "الضبط" : "Settings" },
  ];

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          dir === "rtl" ? "border-s" : "border-e",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2 truncate">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-primary shadow-glow">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-base font-bold truncate">{t("appName")}</span>
            </Link>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed((c) => !c)}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          {items.map((it) => {
            const active = path === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <it.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-2">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
          >
            <Globe2 className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{lang === "ar" ? "English" : "العربية"}</span>}
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t("logout")}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <PaymentTestModeBanner />
        <AccessGate>
          <Outlet />
        </AccessGate>
        <div className="px-6 py-2 text-center text-[11px] text-muted-foreground">
          ⚠ {t("disclaimerTitle")} — {t("disclaimerBody").slice(0, 140)}…
        </div>
        <LegalFooter />
      </main>
    </div>
  );
}
