import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Archive, History, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAssetHistory, type AssetHistory } from "@/lib/market-history.functions";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/archive")({
  component: ArchivePage,
});

interface Row {
  id: string; symbol: string; asset_name: string; price: number;
  change_pct: number | null; high: number | null; low: number | null;
  volume: number | null; captured_at: string;
}

type Category = "crypto" | "metals" | "currencies" | "stocks";

const ASSET_OPTIONS: Record<Category, { symbol: string; name: string }[]> = {
  crypto: [
    { symbol: "BTC", name: "Bitcoin" },
    { symbol: "ETH", name: "Ethereum" },
    { symbol: "SOL", name: "Solana" },
    { symbol: "BNB", name: "BNB" },
  ],
  metals: [
    { symbol: "XAU", name: "Gold (PAXG)" },
    { symbol: "XAG", name: "Silver (KAG)" },
  ],
  currencies: [
    { symbol: "EUR/USD", name: "Euro / USD" },
    { symbol: "GBP/USD", name: "Pound / USD" },
    { symbol: "USD/JPY", name: "USD / JPY" },
    { symbol: "USD/SAR", name: "USD / SAR" },
  ],
  stocks: [
    { symbol: "AAPL", name: "Apple" },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "NVDA", name: "NVIDIA" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "2222.SR", name: "Saudi Aramco" },
    { symbol: "1120.SR", name: "Al Rajhi Bank" },
    { symbol: "2010.SR", name: "SABIC" },
  ],
};

function ArchivePage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("market_archive").select("*").order("captured_at", { ascending: false }).limit(200)
      .then(({ data }) => data && setRows(data as Row[]));
  }, [user]);

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <Archive className="h-7 w-7 text-primary" /> {t("archiveTitle")}
      </h1>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {lang === "ar" ? "تاريخ الأسواق" : "Market history"}
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="gap-2">
            <Archive className="h-4 w-4" />
            {lang === "ar" ? "اللقطات المحفوظة" : "Saved snapshots"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <HistoryView />
        </TabsContent>

        <TabsContent value="snapshots">
          <SnapshotsTable rows={rows} lang={lang} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryView() {
  const { lang } = useI18n();
  const [category, setCategory] = useState<Category>("crypto");
  const [symbol, setSymbol] = useState<string>("BTC");
  const [days, setDays] = useState<number>(30);

  // Reset symbol when category changes
  useEffect(() => {
    setSymbol(ASSET_OPTIONS[category][0].symbol);
  }, [category]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<AssetHistory, Error>({
    queryKey: ["asset-history", category, symbol, days],
    queryFn: () => getAssetHistory({ data: { category, symbol, days } }),
    retry: 1,
    staleTime: 5 * 60_000,
  });

  const chartData = useMemo(
    () => (data?.points ?? []).map((p) => ({ date: p.date, close: p.close })),
    [data],
  );

  const stats = useMemo(() => {
    const pts = data?.points ?? [];
    if (!pts.length) return null;
    const closes = pts.map((p) => p.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const high = Math.max(...closes);
    const low = Math.min(...closes);
    const changePct = first ? ((last - first) / first) * 100 : 0;
    return { first, last, high, low, changePct };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {lang === "ar" ? "السوق" : "Market"}
          </label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="crypto">{lang === "ar" ? "العملات الرقمية" : "Crypto"}</SelectItem>
              <SelectItem value="metals">{lang === "ar" ? "المعادن" : "Metals"}</SelectItem>
              <SelectItem value="currencies">{lang === "ar" ? "العملات" : "Currencies"}</SelectItem>
              <SelectItem value="stocks">{lang === "ar" ? "الأسهم" : "Stocks"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {lang === "ar" ? "الأصل" : "Asset"}
          </label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSET_OPTIONS[category].map((a) => (
                <SelectItem key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {lang === "ar" ? "المدة" : "Range"}
          </label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{lang === "ar" ? "7 أيام" : "7 days"}</SelectItem>
              <SelectItem value="30">{lang === "ar" ? "30 يومًا" : "30 days"}</SelectItem>
              <SelectItem value="90">{lang === "ar" ? "90 يومًا" : "90 days"}</SelectItem>
              <SelectItem value="180">{lang === "ar" ? "180 يومًا" : "180 days"}</SelectItem>
              <SelectItem value="365">{lang === "ar" ? "سنة" : "1 year"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label={lang === "ar" ? "أعلى" : "High"} value={stats.high} />
          <StatCard label={lang === "ar" ? "أدنى" : "Low"} value={stats.low} />
          <StatCard label={lang === "ar" ? "البداية" : "Start"} value={stats.first} />
          <StatCard
            label={lang === "ar" ? "التغير" : "Change"}
            value={`${stats.changePct >= 0 ? "+" : ""}${stats.changePct.toFixed(2)}%`}
            accent={stats.changePct >= 0 ? "success" : "danger"}
            icon={stats.changePct >= 0 ? TrendingUp : TrendingDown}
          />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">{data?.name ?? symbol}</div>
            <div className="text-xs text-muted-foreground">{data?.currency ?? "USD"}</div>
          </div>
        </div>
        <div className="h-72">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {lang === "ar" ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : isError || chartData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <AlertTriangle className="h-6 w-6 text-warning" />
              <div className="max-w-md text-sm">
                {isError
                  ? (lang === "ar" ? "تعذّر تحميل بيانات السوق الآن. أعد المحاولة أو اختر أصلًا آخر." : "Market data could not be loaded. Try again or choose another asset.")
                  : (lang === "ar" ? "لا توجد قيم تاريخية متاحة لهذا الاختيار حاليًا." : "No historical values are available for this selection yet.")}
              </div>
              {isError && <div className="text-xs text-muted-foreground/80">{error.message}</div>}
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
                disabled={isFetching}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                {lang === "ar" ? "إعادة المحاولة" : "Retry"}
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="oklch(0.74 0.16 175)" />
                    <stop offset="100%" stopColor="oklch(0.65 0.22 290)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }} width={60} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.035 250)",
                    border: "1px solid oklch(0.3 0.03 250)",
                    borderRadius: 8,
                    color: "oklch(0.97 0.01 250)",
                  }}
                  formatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                />
                <Line type="monotone" dataKey="close" stroke="url(#hg)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {(data?.points?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-2 text-end">{lang === "ar" ? "افتتاح" : "Open"}</th>
                  <th className="px-4 py-2 text-end">{lang === "ar" ? "أعلى" : "High"}</th>
                  <th className="px-4 py-2 text-end">{lang === "ar" ? "أدنى" : "Low"}</th>
                  <th className="px-4 py-2 text-end">{lang === "ar" ? "إغلاق" : "Close"}</th>
                  <th className="px-4 py-2 text-end">{lang === "ar" ? "حجم" : "Volume"}</th>
                </tr>
              </thead>
              <tbody>
                {[...(data?.points ?? [])].reverse().map((p) => (
                  <tr key={p.date} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{p.date}</td>
                    <td className="px-4 py-2 text-end text-muted-foreground">{p.open?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                    <td className="px-4 py-2 text-end text-success">{p.high?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                    <td className="px-4 py-2 text-end text-danger">{p.low?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                    <td className="px-4 py-2 text-end font-semibold">{p.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="px-4 py-2 text-end text-xs text-muted-foreground">
                      {p.volume ? p.volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, accent, icon: Icon,
}: { label: string; value: number | string; accent?: "success" | "danger"; icon?: React.ComponentType<{ className?: string }> }) {
  const display = typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : value;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 flex items-center gap-2 font-display text-xl font-bold",
        accent === "success" && "text-success",
        accent === "danger" && "text-danger",
      )}>
        {Icon && <Icon className="h-5 w-5" />}
        {display}
      </div>
    </div>
  );
}

function SnapshotsTable({ rows, lang, t }: { rows: Row[]; lang: string; t: (k: never) => string }) {
  return (
    <div className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start">{t("asset" as never)}</th>
            <th className="px-4 py-3 text-end">{t("price" as never)}</th>
            <th className="px-4 py-3 text-end">{t("change" as never)}</th>
            <th className="px-4 py-3 text-end">{t("highToday" as never)}</th>
            <th className="px-4 py-3 text-end">{t("lowToday" as never)}</th>
            <th className="px-4 py-3 text-end">{t("capturedAt" as never)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">—</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="font-semibold">{r.symbol}</div>
                <div className="text-xs text-muted-foreground">{r.asset_name}</div>
              </td>
              <td className="px-4 py-3 text-end font-medium">{r.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
              <td className={cn("px-4 py-3 text-end", (r.change_pct ?? 0) >= 0 ? "text-success" : "text-danger")}>
                {r.change_pct !== null ? `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(2)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-end text-muted-foreground">{r.high?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
              <td className="px-4 py-3 text-end text-muted-foreground">{r.low?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
              <td className="px-4 py-3 text-end text-xs text-muted-foreground">
                {new Date(r.captured_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
