import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <CardTitle>Unified Data Fusion Engine</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">VIX {macro.vix.toFixed(1)}</Badge>
            <Badge variant="outline">DXY {macro.dxy.toFixed(2)}</Badge>
            <Badge variant="outline">10Y {macro.yields10y.toFixed(2)}%</Badge>
            <Badge variant={macro.riskOn >= 0 ? "default" : "destructive"}>
              Risk {macro.riskOn >= 0 ? "ON" : "OFF"} {macro.riskOn.toFixed(2)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Multi-provider aggregation • symbol normalization • realtime + historical merge •
          failover • stale detection • confidence scoring • regime + volatility classification •
          macro overlay • anomaly detection • intelligent cache + time-series compression.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Fused Quotes</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">Symbol</th><th>Price</th><th>Spread</th>
                  <th>Conf</th><th>Anom</th><th>Sources</th>
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
          <CardHeader><CardTitle className="text-sm">Provider Health</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">Provider</th><th>Status</th><th>Latency</th>
                  <th>Err</th><th>Conf</th>
                </tr></thead>
                <tbody>
                  {health.map((h) => {
                    const spec = PROVIDERS.find((p) => p.id === h.provider);
                    return (
                      <tr key={h.provider} className="border-t border-border/40">
                        <td className="py-1">{spec?.label ?? h.provider} <span className="text-muted-foreground">({spec?.kind})</span></td>
                        <td>
                          <Badge variant={h.up ? "default" : "destructive"}>
                            {h.stale ? "stale" : h.up ? "up" : "down"}
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
          <CardHeader><CardTitle className="text-sm">Regime & Volatility</CardTitle></CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1">Symbol</th><th>Regime</th><th>Vol</th>
                  <th>Trend</th><th>Conf</th>
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
                    <tr><td colSpan={5} className="py-3 text-muted-foreground">Warming up…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Cache quotes: {stats.quotes}</Badge>
              <Badge variant="secondary">Cache OHLC: {stats.ohlc}</Badge>
              {compression && (
                <Badge variant="secondary">
                  Compression {(compression.ratio * 100).toFixed(0)}% ({compression.count} bars)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Pipeline Events</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEvents([])}>Clear</Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs font-mono">
              {events.length === 0 && <li className="text-muted-foreground">No events yet.</li>}
              {events.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
