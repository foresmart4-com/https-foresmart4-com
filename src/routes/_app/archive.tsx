import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Archive,
  Flame,
  History,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAssetHistory,
  getTopGainers,
  getTopStockGainers,
  type AssetHistory,
  type TopGainer,
  type TopStockGainer,
} from "@/lib/market-history.functions";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/archive")({
  component: ArchivePage,
});

interface Row {
  id: string;
  symbol: string;
  asset_name: string;
  price: number;
  change_pct: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  captured_at: string;
}

type Category = "crypto" | "metals" | "currencies" | "stocks";
type DisplayCurrency = "USD" | "SAR";

const USD_SAR_RATE = 3.75;

function convertToDisplayCurrency(
  value: number,
  sourceCurrency: string,
  targetCurrency: DisplayCurrency,
  referenceRate?: number,
) {
  const source = sourceCurrency.toUpperCase();
  if (source === targetCurrency) return value;
  if (source === "USD" && targetCurrency === "SAR") return value * USD_SAR_RATE;
  if (source === "SAR" && targetCurrency === "USD") return value / USD_SAR_RATE;
  if (source === "JPY") {
    const usdValue = value / (referenceRate || 150);
    return targetCurrency === "USD" ? usdValue : usdValue * USD_SAR_RATE;
  }
  return targetCurrency === "SAR" ? value * USD_SAR_RATE : value;
}

function formatDisplayMoney(value: number, currency: DisplayCurrency) {
  const abs = Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return currency === "USD" ? `${sign}$${abs}` : `${sign}${abs} ﷼`;
}

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
    supabase
      .from("market_archive")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(200)
      .then(({ data }) => data && setRows(data as Row[]));
  }, [user]);

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <Archive className="h-7 w-7 text-primary" /> {t("archiveTitle")}
      </h1>

      <Tabs defaultValue="gainers" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="gainers" className="gap-2">
            <Flame className="h-4 w-4" />
            {lang === "ar" ? "عملات الارتفاع" : "Top gainers"}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {lang === "ar" ? "تاريخ الأسواق" : "Market history"}
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="gap-2">
            <Archive className="h-4 w-4" />
            {lang === "ar" ? "اللقطات المحفوظة" : "Saved snapshots"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gainers" className="space-y-6">
          <TopGainersView />
          <TopStockGainersView />
        </TabsContent>

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

function TopGainersView() {
  const { lang } = useI18n();
  const fn = useServerFn(getTopGainers);
  const { data, isLoading, isError, isFetching, error, refetch } = useQuery<TopGainer[], Error>({
    queryKey: ["top-gainers", 20],
    queryFn: () => fn({ data: { limit: 20 } }),
    retry: 1,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Flame className="h-4 w-4 text-warning" />
            {lang === "ar" ? "أعلى العملات ارتفاعًا (24 ساعة)" : "Top gaining coins (24h)"}
          </div>
          <div className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "بيانات مباشرة من سوق العملات الرقمية"
              : "Live data from the crypto market"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40"
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {lang === "ar" ? "جارٍ التحميل..." : "Loading..."}
        </div>
      ) : isError || !Array.isArray(data) || data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-warning" />
          <div className="text-sm">
            {isError
              ? lang === "ar"
                ? "تعذّر تحميل عملات الارتفاع. حاول مجددًا."
                : "Could not load top gainers. Try again."
              : lang === "ar"
                ? "لا توجد بيانات حاليًا."
                : "No data available right now."}
          </div>
          {isError && <div className="text-xs">{error?.message}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{lang === "ar" ? "العملة" : "Coin"}</th>
                <th className="px-4 py-3 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
                <th className="px-4 py-3 text-end">
                  {lang === "ar" ? "التغير 24س" : "24h change"}
                </th>
                <th className="px-4 py-3 text-end">
                  {lang === "ar" ? "القيمة السوقية" : "Market cap"}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.symbol + i} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.image && (
                        <img
                          src={c.image}
                          alt={c.name}
                          className="h-6 w-6 rounded-full"
                          loading="lazy"
                        />
                      )}
                      <div>
                        <div className="font-semibold">{c.symbol}</div>
                        <div className="text-xs text-muted-foreground">{c.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end font-medium">
                    ${c.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-end font-semibold",
                      c.changePct24h >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.changePct24h >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {c.changePct24h >= 0 ? "+" : ""}
                      {c.changePct24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-xs text-muted-foreground">
                    {c.marketCap
                      ? `$${c.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopStockGainersView() {
  const { lang } = useI18n();
  const [market, setMarket] = useState<"all" | "us" | "saudi">("all");
  const fn = useServerFn(getTopStockGainers);
  const { data, isLoading, isError, isFetching, error, refetch } = useQuery<
    TopStockGainer[],
    Error
  >({
    queryKey: ["top-stock-gainers", market],
    queryFn: () => fn({ data: { market, limit: 15 } }),
    retry: 1,
    staleTime: 60_000,
  });

  const fmtPrice = (p: number, ccy: string) => {
    const sign = ccy === "USD" ? "$" : ccy === "SAR" ? "﷼" : "";
    return `${sign}${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}${sign ? "" : ` ${ccy}`}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Flame className="h-4 w-4 text-warning" />
            {lang === "ar" ? "أعلى الأسهم ارتفاعًا" : "Top gaining stocks"}
          </div>
          <div className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "بالدولار للأسهم الأمريكية وبالريال للأسهم السعودية"
              : "USD for US stocks, SAR for Saudi stocks"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={market} onValueChange={(v) => setMarket(v as "all" | "us" | "saudi")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل الأسواق" : "All markets"}</SelectItem>
              <SelectItem value="us">
                {lang === "ar" ? "السوق الأمريكي ($)" : "US Market ($)"}
              </SelectItem>
              <SelectItem value="saudi">
                {lang === "ar" ? "السوق السعودي (﷼)" : "Saudi Market (﷼)"}
              </SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {lang === "ar" ? "جارٍ التحميل..." : "Loading..."}
        </div>
      ) : isError || !Array.isArray(data) || data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-warning" />
          <div className="text-sm">
            {isError
              ? lang === "ar"
                ? "تعذّر تحميل الأسهم. حاول مجددًا."
                : "Could not load stocks. Try again."
              : lang === "ar"
                ? "لا توجد بيانات حاليًا."
                : "No data available right now."}
          </div>
          {isError && <div className="text-xs">{error?.message}</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{lang === "ar" ? "السهم" : "Stock"}</th>
                <th className="px-4 py-3 text-start">{lang === "ar" ? "السوق" : "Market"}</th>
                <th className="px-4 py-3 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
                <th className="px-4 py-3 text-end">{lang === "ar" ? "العملة" : "Currency"}</th>
                <th className="px-4 py-3 text-end">
                  {lang === "ar" ? "التغير اليومي" : "Daily change"}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => (
                <tr key={s.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.symbol}</div>
                    <div className="text-xs text-muted-foreground">{s.name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.market === "us"
                      ? lang === "ar"
                        ? "🇺🇸 أمريكي"
                        : "🇺🇸 US"
                      : lang === "ar"
                        ? "🇸🇦 سعودي"
                        : "🇸🇦 Saudi"}
                  </td>
                  <td className="px-4 py-3 text-end font-medium">
                    {fmtPrice(s.price, s.currency)}
                  </td>
                  <td className="px-4 py-3 text-end text-xs text-muted-foreground">{s.currency}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-end font-semibold",
                      s.changePct >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {s.changePct >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {s.changePct >= 0 ? "+" : ""}
                      {s.changePct.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryView() {
  const { lang } = useI18n();
  const [category, setCategory] = useState<Category>("crypto");
  const [symbol, setSymbol] = useState<string>("BTC");
  const [days, setDays] = useState<number>(30);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");

  // Reset symbol when category changes
  useEffect(() => {
    setSymbol(ASSET_OPTIONS[category][0].symbol);
  }, [category]);

  const fn = useServerFn(getAssetHistory);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<AssetHistory, Error>({
    queryKey: ["asset-history", category, symbol, days],
    queryFn: () => fn({ data: { category, symbol, days } }),
    retry: 1,
    staleTime: 5 * 60_000,
  });

  const sourceCurrency = data?.currency ?? "USD";
  const referenceRate = data?.points.at(-1)?.close;

  const chartData = useMemo(
    () => (data?.points ?? []).map((p) => ({ date: p.date, close: p.close })),
    [data],
  );

  const historyRows = useMemo(
    () =>
      (data?.points ?? [])
        .map((p, index, points) => {
          const previous = points[index - 1];
          const rawChange = previous ? p.close - previous.close : null;
          const changePct = previous?.close ? (rawChange! / previous.close) * 100 : null;
          const convertedChange =
            rawChange === null
              ? null
              : convertToDisplayCurrency(
                  rawChange,
                  sourceCurrency,
                  displayCurrency,
                  p.close || referenceRate,
                );
          return { ...p, convertedChange, changePct };
        })
        .reverse(),
    [data, displayCurrency, referenceRate, sourceCurrency],
  );

  const stats = useMemo(() => {
    const pts = data?.points ?? [];
    if (!pts.length) return null;
    const closes = pts.map((p) => p.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const high = Math.max(...closes);
    const low = Math.min(...closes);
    const rawChange = last - first;
    const changeValue = convertToDisplayCurrency(
      rawChange,
      data?.currency ?? "USD",
      displayCurrency,
      last || referenceRate,
    );
    const changePct = first ? ((last - first) / first) * 100 : 0;
    return { first, last, high, low, changePct, changeValue };
  }, [data, displayCurrency, referenceRate]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {lang === "ar" ? "السوق" : "Market"}
          </label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_OPTIONS[category].map((a) => (
                <SelectItem key={a.symbol} value={a.symbol}>
                  {a.name} ({a.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {lang === "ar" ? "المدة" : "Range"}
          </label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{lang === "ar" ? "7 أيام" : "7 days"}</SelectItem>
              <SelectItem value="30">{lang === "ar" ? "30 يومًا" : "30 days"}</SelectItem>
              <SelectItem value="90">{lang === "ar" ? "90 يومًا" : "90 days"}</SelectItem>
              <SelectItem value="180">{lang === "ar" ? "180 يومًا" : "180 days"}</SelectItem>
              <SelectItem value="365">{lang === "ar" ? "سنة" : "1 year"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {lang === "ar" ? "عملة تغير القيمة" : "Change currency"}
          </label>
          <Select
            value={displayCurrency}
            onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">
                {lang === "ar" ? "بالدولار ($)" : "US Dollar ($)"}
              </SelectItem>
              <SelectItem value="SAR">
                {lang === "ar" ? "بالريال (﷼)" : "Saudi Riyal (﷼)"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 md:grid-cols-5">
          <StatCard label={lang === "ar" ? "أعلى" : "High"} value={stats.high} />
          <StatCard label={lang === "ar" ? "أدنى" : "Low"} value={stats.low} />
          <StatCard label={lang === "ar" ? "البداية" : "Start"} value={stats.first} />
          <StatCard
            label={
              lang === "ar"
                ? `تغير القيمة (${displayCurrency === "USD" ? "دولار" : "ريال"})`
                : `Value change (${displayCurrency})`
            }
            value={formatDisplayMoney(stats.changeValue, displayCurrency)}
            accent={stats.changeValue >= 0 ? "success" : "danger"}
            icon={stats.changeValue >= 0 ? TrendingUp : TrendingDown}
          />
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
                  ? lang === "ar"
                    ? "تعذّر تحميل بيانات السوق الآن. أعد المحاولة أو اختر أصلًا آخر."
                    : "Market data could not be loaded. Try again or choose another asset."
                  : lang === "ar"
                    ? "لا توجد قيم تاريخية متاحة لهذا الاختيار حاليًا."
                    : "No historical values are available for this selection yet."}
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
                <CartesianGrid
                  stroke="oklch(0.3 0.03 250)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.035 250)",
                    border: "1px solid oklch(0.3 0.03 250)",
                    borderRadius: 8,
                    color: "oklch(0.97 0.01 250)",
                  }}
                  formatter={(v: number) =>
                    v.toLocaleString(undefined, { maximumFractionDigits: 4 })
                  }
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="url(#hg)"
                  strokeWidth={2.5}
                  dot={false}
                />
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
                  <th className="px-4 py-2 text-end">
                    {lang === "ar"
                      ? `تغير القيمة (${displayCurrency === "USD" ? "دولار" : "ريال"})`
                      : `Value change (${displayCurrency})`}
                  </th>
                  <th className="px-4 py-2 text-end">
                    {lang === "ar" ? "نسبة التغير" : "Change %"}
                  </th>
                  <th className="px-4 py-2 text-end">{lang === "ar" ? "حجم" : "Volume"}</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((p) => (
                  <tr key={p.date} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{p.date}</td>
                    <td className="px-4 py-2 text-end text-muted-foreground">
                      {p.open?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-end text-success">
                      {p.high?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-end text-danger">
                      {p.low?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-end font-semibold">
                      {p.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-end font-semibold",
                        (p.convertedChange ?? 0) >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {p.convertedChange === null
                        ? "—"
                        : formatDisplayMoney(p.convertedChange, displayCurrency)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-end",
                        (p.changePct ?? 0) >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {p.changePct === null
                        ? "—"
                        : `${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2 text-end text-xs text-muted-foreground">
                      {p.volume
                        ? p.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : "—"}
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
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  accent?: "success" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const display =
    typeof value === "number"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : value;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 flex items-center gap-2 font-display text-xl font-bold",
          accent === "success" && "text-success",
          accent === "danger" && "text-danger",
        )}
      >
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
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                —
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="font-semibold">{r.symbol}</div>
                <div className="text-xs text-muted-foreground">{r.asset_name}</div>
              </td>
              <td className="px-4 py-3 text-end font-medium">
                {r.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-end",
                  (r.change_pct ?? 0) >= 0 ? "text-success" : "text-danger",
                )}
              >
                {r.change_pct !== null
                  ? `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(2)}%`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-end text-muted-foreground">
                {r.high?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
              </td>
              <td className="px-4 py-3 text-end text-muted-foreground">
                {r.low?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
              </td>
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
