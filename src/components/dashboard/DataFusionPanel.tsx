import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  fusionBus, allHealth, PROVIDERS, subscribe, start, stop, listSubscriptions,
  getMacro, cacheStats, compressSeries, getMergedSeries,
  type FusedQuote, type ProviderHealth, type RegimeSnapshot, type MacroOverlay,
  type AssetClass,
} from "@/services/fusion";

const SEED_FEEDS: { sym: string; cls: AssetClass }[] = [
  { sym: "BTCUSDT", cls: "crypto" },
  { sym: "ETHUSDT", cls: "crypto" },
  { sym: "AAPL", cls: "equity" },
  { sym: "SPY", cls: "etf" },
  { sym: "EURUSD", cls: "forex" },
  { sym: "XAUUSD", cls: "commodity" },
];

export function DataFusionPanel() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [quotes, setQuotes] = useState<Record<string, FusedQuote>>({});
  const [health, setHealth] = useState<ProviderHealth[]>(allHealth());
  const [regimes, setRegimes] = useState<Record<string, RegimeSnapshot>>({});
  const [macro, setMacro] = useState<MacroOverlay>(getMacro());
  const [events, setEvents] = useState<string[]>([]);
  const [compression, setCompression] = useState<{ ratio: number; count: number } | null>(null);

  useEffect(() => {
    SEED_FEEDS.forEach((f) => subscribe(f.sym, f.cls));
    start();
    const offQ = fusionBus.onType("quote", (e) =>
      setQuotes((prev) => ({ ...prev, [e.quote.symbol]: e.quote })));
    const offH = fusionBus.onType("provider:health", () => setHealth(allHealth()));
    const offR = fusionBus.onType("regime", (e) =>
      setRegimes((prev) => ({ ...prev, [e.snapshot.symbol]: e.snapshot })));
    const offM = fusionBus.onType("macro", (e) => setMacro(e.overlay));
    const offAnom = fusionBus.onType("anomaly", (e) =>
      setEvents((prev) => [`anomaly ${e.symbol} z=${e.score} (${e.reason})`, ...prev].slice(0, 30)));
    const offFail = fusionBus.onType("provider:failover", (e) =>
      setEvents((prev) => [`failover ${e.symbol} ${e.from} → ${e.to}`, ...prev].slice(0, 30)));
    const offStale = fusionBus.onType("stale", (e) =>
      setEvents((prev) => [`stale ${e.provider}:${e.symbol}`, ...prev].slice(0, 30)));
    // Kick a historical merge per symbol to warm regime classification + compression.
    Promise.all(listSubscriptions().map((s) => getMergedSeries(s.symbol, 240)))
      .then((all) => {
        const flat = all.flat();
        if (flat.length) {
          const c = compressSeries(flat);
          setCompression({ ratio: c.ratio, count: c.count });
        }
      })
      .catch(() => undefined);
    return () => { offQ(); offH(); offR(); offM(); offAnom(); offFail(); offStale(); stop(); };
  }, []);

  const stats = cacheStats();
  const subs = useMemo(() => listSubscriptions(), [quotes]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{ar ? "محرّك دمج البيانات الموحّد" : "Unified Data Fusion Engine"}</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">VIX {macro.vix.toFixed(1)}</Badge>
            <Badge variant="outline">DXY {macro.dxy.toFixed(2)}</Badge>
            <Badge variant="outline">10Y {macro.yields10y.toFixed(2)}%</Badge>
            <Badge variant={macro.riskOn >= 0 ? "default" : "destructive"}>
              {ar ? "مخاطرة:" : "Risk"} {ar ? (macro.riskOn >= 0 ? "مفعّلة" : "مغلقة") : (macro.riskOn >= 0 ? "ON" : "OFF")} {macro.riskOn.toFixed(2)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {ar
            ? "تجميع متعدد المزودين • تطبيع الرموز • دمج البيانات اللحظية والتاريخية • التحويل التلقائي عند الفشل • كشف البيانات المنتهية الصلاحية • تسجيل درجة الثقة • تصنيف النظام والتقلب • طبقة الماكرو • كشف الشذوذ • ذاكرة التخزين المؤقتة الذكية وضغط السلاسل الزمنية."
            : "Multi-provider aggregation • symbol normalization • realtime + historical merge • failover • stale detection • confidence scoring • regime + volatility classification • macro overlay • anomaly detection • intelligent cache + time-series compression."}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">{ar ? "الأسعار المدمجة" : "Fused Quotes"}</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">{ar ? "الرمز" : "Symbol"}</th><th>{ar ? "السعر" : "Price"}</th><th>{ar ? "الفارق" : "Spread"}</th>
                  <th>{ar ? "الثقة" : "Conf"}</th><th>{ar ? "شذوذ" : "Anom"}</th><th>{ar ? "المصادر" : "Sources"}</th>
                </tr></thead>
                <tbody>
                  {subs.map((s) => {
                    const q = quotes[s.symbol];
                    return (
                      <tr key={s.symbol} className="border-t border-border/40">
                        <td className="py-1 font-medium">{s.symbol}</td>
                        <td>{q ? q.consensusPrice.toFixed(4) : "—"}</td>
                        <td>{q ? q.spread.toFixed(4) : "—"}</td>
                        <td>{q ? (q.confidence * 100).toFixed(0) + "%" : "—"}</td>
                        <td>{q ? (q.anomalyScore * 100).toFixed(0) + "%" : "—"}</td>
                        <td className="text-muted-foreground">{q?.contributingProviders.join(", ") ?? s.provider}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{ar ? "صحة المزودين" : "Provider Health"}</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">{ar ? "المزوّد" : "Provider"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "زمن الاستجابة" : "Latency"}</th>
                  <th>{ar ? "الأخطاء" : "Err"}</th><th>{ar ? "الثقة" : "Conf"}</th>
                </tr></thead>
                <tbody>
                  {health.map((h) => {
                    const spec = PROVIDERS.find((p) => p.id === h.provider);
                    const kindLabel = ar
                      ? (spec?.kind === "websocket" ? "ويب سوكت" : spec?.kind === "polling" ? "استطلاع" : spec?.kind ?? "")
                      : spec?.kind ?? "";
                    return (
                      <tr key={h.provider} className="border-t border-border/40">
                        <td className="py-1">{spec?.label ?? h.provider} <span className="text-muted-foreground">({kindLabel})</span></td>
                        <td>
                          <Badge variant={h.up ? "default" : "destructive"}>
                            {h.stale ? (ar ? "منتهي الصلاحية" : "stale") : h.up ? (ar ? "يعمل" : "live") : (ar ? "متوقف" : "down")}
                          </Badge>
                        </td>
                        <td>{h.latencyMs}ms</td>
                        <td>{(h.errorRate * 100).toFixed(0)}%</td>
                        <td>{(h.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{ar ? "النظام والتقلب" : "Regime & Volatility"}</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">{ar ? "الرمز" : "Symbol"}</th><th>{ar ? "النظام" : "Regime"}</th><th>{ar ? "تقلب" : "Vol"}</th>
                  <th>{ar ? "الاتجاه" : "Trend"}</th><th>{ar ? "الثقة" : "Conf"}</th>
                </tr></thead>
                <tbody>
                  {Object.values(regimes).map((r) => (
                    <tr key={r.symbol} className="border-t border-border/40">
                      <td className="py-1 font-medium">{r.symbol}</td>
                      <td><Badge variant="outline">{r.regime}</Badge></td>
                      <td>{r.volatility}</td>
                      <td>{(r.trendStrength * 100).toFixed(0)}%</td>
                      <td>{(r.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                  {Object.keys(regimes).length === 0 && (
                    <tr><td colSpan={5} className="py-3 text-muted-foreground">{ar ? "يتحمّل..." : "Warming up…"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{ar ? "مخبأ الأسعار:" : "Cache quotes:"} {stats.quotes}</Badge>
              <Badge variant="secondary">{ar ? "مخبأ OHLC:" : "Cache OHLC:"} {stats.ohlc}</Badge>
              {compression && (
                <Badge variant="secondary">
                  {ar ? "ضغط" : "Compression"} {(compression.ratio * 100).toFixed(0)}% ({compression.count} {ar ? "شمعة" : "bars"})
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{ar ? "أحداث المسار" : "Pipeline Events"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEvents([])}>{ar ? "مسح" : "Clear"}</Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs font-mono">
              {events.length === 0 && <li className="text-muted-foreground">{ar ? "لا توجد أحداث بعد." : "No events yet."}</li>}
              {events.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
