import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STOCKS_UNIVERSE } from "@/lib/stocks-universe";
import { INDEX_LABELS, inIndex, type StockIndex } from "@/lib/stock-indices";
import { finnhubQuote } from "@/lib/finnhub.functions";
import { Search, RefreshCw, AlertTriangle, LineChart } from "lucide-react";

export const Route = createFileRoute("/_app/market-universe")({
  head: () => ({
    meta: [
      { title: "Market Universe — ForeSmart" },
      { name: "description", content: "Search S&P 500 and Nasdaq 100 stocks with real quotes from Finnhub / Alpaca." },
    ],
  }),
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><MarketUniversePage /></ErrorBoundary>,
});

function MarketUniversePage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState<StockIndex>("sp500");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);

  const companies = useMemo(() => {
    const us = STOCKS_UNIVERSE.us;
    const q = query.trim().toLowerCase();
    return us
      .filter((c) => inIndex(c.symbol, idx))
      .filter((c) => {
        if (!q) return true;
        return (
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.sector ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [query, idx]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6" dir={dir}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <LineChart className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-bold">{ar ? "كون الأسهم — Market Universe" : "Market Universe"}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "ابحث عن الشركات الأمريكية من S&P 500 و Nasdaq 100. أسعار حقيقية عبر Finnhub / Alpaca، ومفاتيح API محفوظة على السيرفر فقط."
            : "Search US companies across S&P 500 and Nasdaq 100. Real quotes via Finnhub / Alpaca — API keys stay on the server."}
        </p>
      </div>

      <Card className="border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {ar
              ? "Binance للعملات الرقمية فقط. تنفيذ أوامر تداول الأسهم يبقى معطلًا (LIVE_TRADING_ENABLED=false) حتى ربط Alpaca / IBKR وظهور الرصيد."
              : "Binance is crypto only. Stock order execution stays disabled (LIVE_TRADING_ENABLED=false) until Alpaca / IBKR is linked and balance appears."}
          </span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "ابحث برمز السهم أو اسم الشركة..." : "Search by ticker, name or sector..."}
              className="ps-9"
            />
          </div>
          <Tabs value={idx} onValueChange={(v) => setIdx(v as StockIndex)}>
            <TabsList>
              <TabsTrigger value="sp500">{INDEX_LABELS.sp500[lang]}</TabsTrigger>
              <TabsTrigger value="nasdaq100">{INDEX_LABELS.nasdaq100[lang]}</TabsTrigger>
              <TabsTrigger value="all">{INDEX_LABELS.all[lang]}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {ar ? `النتائج: ${companies.length}` : `Results: ${companies.length}`}
        </div>
      </Card>

      <Card className="p-0">
        <div className="table-scroll max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/40 text-xs uppercase text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2 text-start">{ar ? "الرمز" : "Symbol"}</th>
                <th className="px-4 py-2 text-start">{ar ? "الشركة" : "Company"}</th>
                <th className="px-4 py-2 text-start">{ar ? "القطاع" : "Sector"}</th>
                <th className="px-4 py-2 text-start">{ar ? "المؤشر" : "Index"}</th>
                <th className="px-4 py-2 text-end">{ar ? "السعر الحقيقي" : "Live Quote"}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono font-semibold">{c.symbol}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.sector}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {inIndex(c.symbol, "sp500") && <Badge variant="secondary">S&P 500</Badge>}
                      {inIndex(c.symbol, "nasdaq100") && <Badge variant="secondary">Nasdaq 100</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-end">
                    <Button size="sm" variant="outline" onClick={() => setActiveSymbol(c.symbol)}>
                      {ar ? "جلب السعر" : "Fetch"}
                    </Button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{ar ? "لا توجد نتائج" : "No results"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {activeSymbol && <LiveQuotePanel symbol={activeSymbol} onClose={() => setActiveSymbol(null)} />}
    </div>
  );
}

function LiveQuotePanel({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const quoteFn = useServerFn(finnhubQuote);
  const q = useQuery({
    queryKey: ["mu-finnhub-quote", symbol],
    queryFn: () => quoteFn({ data: { symbol } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const ok = q.data?.ok;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="font-mono">{symbol}</Badge>
          <span className="text-sm text-muted-foreground">{ar ? "السعر الحقيقي عبر Finnhub" : "Live quote via Finnhub"}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            {ar ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>{ar ? "إغلاق" : "Close"}</Button>
        </div>
      </div>
      <div className="mt-3 text-sm">
        {q.isLoading && <p className="text-muted-foreground">{ar ? "جارٍ الجلب..." : "Fetching..."}</p>}
        {ok && q.data?.quote && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label={ar ? "السعر" : "Price"} value={fmt(q.data.quote.c)} />
            <Stat label={ar ? "التغير" : "Change"} value={fmt(q.data.quote.d)} />
            <Stat label={ar ? "النسبة %" : "% Change"} value={`${fmt(q.data.quote.dp)}%`} />
            <Stat label={ar ? "أعلى" : "High"} value={fmt(q.data.quote.h)} />
            <Stat label={ar ? "أدنى" : "Low"} value={fmt(q.data.quote.l)} />
          </div>
        )}
        {q.data && !ok && (
          <p className="text-destructive">{q.data.error ?? (ar ? "فشل جلب السعر" : "Failed to fetch quote")}</p>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function fmt(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
