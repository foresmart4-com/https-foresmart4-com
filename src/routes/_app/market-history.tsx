/**
 * /market-history — Historical Market Archive UI (Phase 11).
 *
 * Uses the unified history-router via createServerFn. Lets the user pick an
 * asset from the curated Asset Universe, choose a range (24h..3y) and
 * interval, then view a candle/line chart with OHLC stats, provider, data
 * mode, and archive coverage.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { History, RefreshCw, Database, Activity, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  getHistoricalCandles,
  refreshHistoricalCandles,
  getArchiveCoverage,
  type Range,
  type Interval,
} from "@/lib/market-archive.functions";
import { ALL_INTEL_ASSETS } from "@/lib/asset-picker";

export const Route = createFileRoute("/_app/market-history")({
  component: MarketHistoryPage,
  head: () => ({
    meta: [
      { title: "أرشيف السوق التاريخي — ForeSmart" },
      { name: "description", content: "Historical market archive with multi-provider routing, persistent cache, and 3-year coverage." },
    ],
  }),
});

const RANGES: Range[] = ["24h", "7d", "30d", "90d", "1y", "3y"];
const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "1d"];

function MarketHistoryPage() {
  const fetchHistory = useServerFn(getHistoricalCandles);
  const refresh = useServerFn(refreshHistoricalCandles);
  const fetchCoverage = useServerFn(getArchiveCoverage);

  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState<Range>("30d");
  const [interval, setInterval] = useState<Interval>("1d");

  const assets = useMemo(() => ALL_INTEL_ASSETS, []);

  const histKey = ["history", symbol, range, interval] as const;
  const history = useQuery({
    queryKey: histKey,
    queryFn: () => fetchHistory({ data: { symbol, range, interval } }),
    staleTime: 30_000,
  });

  const coverage = useQuery({
    queryKey: ["history-coverage", symbol],
    queryFn: () => fetchCoverage({ data: { symbol } }),
    staleTime: 60_000,
  });

  const candles = history.data?.candles ?? [];
  const chartData = candles.map((c) => ({
    t: new Date(c.timestamp).toLocaleString("ar"),
    close: c.close,
    high: c.high,
    low: c.low,
  }));

  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = first && last ? ((last.close - first.close) / first.close) * 100 : 0;

  const handleRefresh = async () => {
    await refresh({ data: { symbol, range, interval } });
    history.refetch();
    coverage.refetch();
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6" dir="rtl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            أرشيف السوق التاريخي
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={history.isFetching}>
            <RefreshCw className={`me-2 h-4 w-4 ${history.isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">الأصل</label>
              <div className="flex gap-2">
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {assets.map((a) => (
                      <SelectItem key={a.symbol} value={a.symbol}>
                        {a.nameAr ?? a.name} ({a.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="w-32" placeholder="رمز مخصص" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">المدى</label>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RANGES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">الفاصل الزمني</label>
              <Select value={interval} onValueChange={(v) => setInterval(v as Interval)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {history.data && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1"><Activity className="h-3 w-3" /> المزود: {history.data.provider ?? "—"}</Badge>
              <Badge variant={history.data.mode === "live" ? "default" : "secondary"}>الوضع: {history.data.mode}</Badge>
              <Badge variant="outline">الفئة: {history.data.assetClass}</Badge>
              <Badge variant="outline">عدد الشموع: {history.data.candles.length}</Badge>
              {history.data.fallbackUsed && <Badge variant="secondary">تم تفعيل مزود احتياطي</Badge>}
              {!history.data.success && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> فشل: {history.data.error ?? "غير معروف"}
                </Badge>
              )}
              {history.data.success && !history.data.supported && (
                <Badge variant="secondary">المدى/الفاصل غير مدعوم لهذا الأصل</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الرسم البياني</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <div className="py-12 text-center text-muted-foreground">جاري التحميل…</div>
          ) : candles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              لا توجد بيانات تاريخية متاحة لهذا الأصل ضمن هذا المدى/الفاصل.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {last && first && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="الافتتاح (أول شمعة)" value={first.open.toFixed(4)} />
          <StatCard label="الإغلاق (آخر شمعة)" value={last.close.toFixed(4)} />
          <StatCard label="أعلى سعر" value={Math.max(...candles.map((c) => c.high)).toFixed(4)} />
          <StatCard label="أدنى سعر" value={Math.min(...candles.map((c) => c.low)).toFixed(4)} />
          <StatCard label="التغير %" value={`${change.toFixed(2)}%`} accent={change >= 0 ? "pos" : "neg"} />
          <StatCard label="عدد الشموع" value={String(candles.length)} />
          <StatCard label="من" value={new Date(first.timestamp).toLocaleDateString("ar")} />
          <StatCard label="إلى" value={new Date(last.timestamp).toLocaleDateString("ar")} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> تغطية الأرشيف ({symbol})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!coverage.data ? (
            <div className="text-sm text-muted-foreground">جاري التحميل…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {coverage.data.map((c) => (
                <div key={c.interval} className="rounded border p-3 text-xs">
                  <div className="font-medium">{c.interval}</div>
                  <div className="text-muted-foreground">{c.count} شمعة محفوظة</div>
                  {c.firstAt && c.lastAt && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(c.firstAt).toLocaleDateString("ar")} ← {new Date(c.lastAt).toLocaleDateString("ar")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold ${accent === "pos" ? "text-green-600" : accent === "neg" ? "text-red-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
