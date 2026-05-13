import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getMarketData, deriveSignal, type AssetQuote, type AssetCategory } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { PriceChart } from "@/components/PriceChart";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp, TrendingUp, BarChart3, RefreshCw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — ForeSmart" },
      { name: "description", content: "Live market dashboard: prices, KPIs, charts and AI buy/sell signals across crypto, metals and currencies." },
      { property: "og:title", content: "ForeSmart Dashboard" },
      { property: "og:description", content: "Live KPIs, charts and AI signals across global markets." },
      { property: "og:url", content: "https://foresmart4.store/dashboard" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/dashboard" }],
  }),
});

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [cat, setCat] = useState<AssetCategory>("crypto");
  const [selected, setSelected] = useState<string | null>(null);

  const marketFn = useServerFn(getMarketData);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["market"],
    queryFn: () => marketFn(),
    refetchInterval: 60000,
  });

  const filtered = useMemo(() => (data?.assets ?? []).filter((a) => a.category === cat), [data, cat]);
  const active = useMemo(
    () => filtered.find((a) => a.symbol === selected) ?? filtered[0],
    [filtered, selected],
  );

  const fmt = (n: number, dp = 2) => n?.toLocaleString(undefined, { maximumFractionDigits: dp }) ?? "—";

  const sig = useMemo(
    () => (active ? deriveSignal(active.history.map((p) => p.p)) : null),
    [active],
  );

  const saveSnapshot = async () => {
    if (!active || !user) return;
    const { error } = await supabase.from("market_archive").insert({
      user_id: user.id,
      symbol: active.symbol,
      asset_name: active.name,
      price: active.price,
      change_pct: active.changePct,
      high: active.high24h,
      low: active.low24h,
      volume: active.volume,
    });
    if (error) toast.error(error.message);
    else toast.success(t("saved"));
  };

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "نظرة شاملة على الأسواق المباشرة" : "Live overview of the markets"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("me-2 h-4 w-4", isFetching && "animate-spin")} />
          {t("refresh")}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("highToday")} value={active ? fmt(active.high24h, 4) : "—"} icon={ArrowUp} accent="success" />
        <KpiCard label={t("lowToday")} value={active ? fmt(active.low24h, 4) : "—"} icon={ArrowDown} accent="danger" />
        <KpiCard
          label={t("dailyChange")}
          value={active ? `${active.changePct.toFixed(2)}%` : "—"}
          icon={TrendingUp}
          accent={active && active.changePct >= 0 ? "success" : "danger"}
        />
        <KpiCard label={t("volume")} value={active ? fmt(active.volume, 0) : "—"} icon={BarChart3} accent="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="rounded-xl gradient-card border border-border p-5 shadow-card lg:col-span-2">
          {isLoading || !active ? (
            <div className="grid h-80 place-items-center text-muted-foreground">{t("loading")}</div>
          ) : (
            <>
              <PriceChart asset={active} />
              {sig && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
                  <div>
                    <div className="text-xs text-muted-foreground">{t("signal")}</div>
                    <div className={cn(
                      "font-display text-xl font-bold",
                      sig.signal === "buy" && "text-success",
                      sig.signal === "sell" && "text-danger",
                      sig.signal === "hold" && "text-warning",
                    )}>
                      {t(sig.signal)}
                    </div>
                  </div>
                  <div className="text-end text-xs text-muted-foreground">
                    <div>{t("rsi")}: <span className="text-foreground font-medium">{sig.rsi?.toFixed(1) ?? "—"}</span></div>
                    <div>{t("sma")}: <span className="text-foreground font-medium">{sig.sma ? fmt(sig.sma, 4) : "—"}</span></div>
                  </div>
                  <Button size="sm" variant="outline" onClick={saveSnapshot}>
                    <Save className="me-2 h-4 w-4" /> {t("snapshot")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Asset list */}
        <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <Tabs value={cat} onValueChange={(v) => { setCat(v as AssetCategory); setSelected(null); }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="crypto">{t("crypto")}</TabsTrigger>
              <TabsTrigger value="metals">{t("metals")}</TabsTrigger>
              <TabsTrigger value="currencies">{t("currencies")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-3 max-h-96 space-y-1 overflow-auto pe-1">
            {filtered.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setSelected(a.symbol)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg p-3 text-start transition-colors",
                  active?.symbol === a.symbol ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/50",
                )}
              >
                <div>
                  <div className="text-sm font-semibold">{a.symbol}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[120px]">{a.name}</div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-medium">{fmt(a.price, 4)}</div>
                  <div className={cn("text-xs", a.changePct >= 0 ? "text-success" : "text-danger")}>
                    {a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: "success" | "danger" | "primary" }) {
  const accentCls = {
    success: "text-success bg-success/10",
    danger: "text-danger bg-danger/10",
    primary: "text-primary bg-primary/10",
  }[accent];
  return (
    <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", accentCls)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
