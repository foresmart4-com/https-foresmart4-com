import { createFileRoute, Outlet, Link, useRouterState, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, LineChart, Bell, Archive, User as UserIcon,
  Brain, LogOut, Globe2, Menu, TrendingUp, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (!user) return <Navigate to="/auth" />;

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { to: "/markets", icon: LineChart, label: t("markets") },
    { to: "/advisor", icon: Brain, label: t("advisor") },
    { to: "/alerts", icon: Bell, label: t("alerts") },
    { to: "/archive", icon: Archive, label: t("archive") },
    ...(isAdmin ? [{ to: "/members", icon: Users, label: t("members") }] : []),
    { to: "/profile", icon: UserIcon, label: t("profile") },
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
        <AccessGate>
          <Outlet />
          <footer className="border-t border-border px-6 py-4 text-center text-[11px] text-muted-foreground">
            ⚠ {t("disclaimerTitle")} — {t("disclaimerBody").slice(0, 140)}…
          </footer>
        </AccessGate>
      </main>
    </div>
  );
}
