import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMarketIntelligence,
  getPortfolioRiskScore,
  getWatchlistIntelligence,
} from "@/lib/market-intelligence.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { DataStatusBadge } from "@/components/DataStatusBadge";
import {
  Brain, TrendingUp, TrendingDown, Activity, AlertTriangle,
  Sparkles, Calendar, Newspaper, Layers, Loader2, ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/_app/market-intelligence")({
  component: MarketIntelligencePage,
  head: () => ({
    meta: [
      { title: "Market Intelligence — ForeSmart" },
      { name: "description", content: "Multi-timeframe trend, sentiment, regime, risk, and portfolio intelligence for any symbol." },
    ],
  }),
});

type Report = Awaited<ReturnType<typeof getMarketIntelligence>>;
type PortfolioScore = Awaited<ReturnType<typeof getPortfolioRiskScore>>;
type WatchlistOut = Awaited<ReturnType<typeof getWatchlistIntelligence>>;

const REC_STYLES: Record<string, string> = {
  strong_buy: "bg-success text-white border-success/50",
  buy: "bg-success/15 text-success border-success/30",
  hold: "bg-muted text-muted-foreground",
  reduce: "bg-warning/15 text-warning border-warning/30",
  sell: "bg-danger text-white border-danger/50",
};

const RISK_STYLES: Record<string, string> = {
  low: "bg-success/15 text-success border-success/30",
  moderate: "bg-warning/15 text-warning border-warning/30",
  elevated: "bg-warning/20 text-warning border-warning/40",
  high: "bg-danger/15 text-danger border-danger/30",
};

const PRESET_SYMBOLS = ["AAPL", "BTC", "ETH", "SPX", "NDX", "XAU"];

function MarketIntelligencePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);

  const callReport = useServerFn(getMarketIntelligence);
  const callPortfolio = useServerFn(getPortfolioRiskScore);
  const callWatchlist = useServerFn(getWatchlistIntelligence);

  const [symbol, setSymbol] = useState("AAPL");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [portfolioText, setPortfolioText] = useState("AAPL:0.3, MSFT:0.3, NVDA:0.2, SPY:0.2");
  const [portfolio, setPortfolio] = useState<PortfolioScore | null>(null);
  const [pLoading, setPLoading] = useState(false);

  const [watchText, setWatchText] = useState("AAPL, MSFT, NVDA, TSLA, GLD");
  const [watch, setWatch] = useState<WatchlistOut | null>(null);
  const [wLoading, setWLoading] = useState(false);

  const runReport = useCallback(async (s: string) => {
    setLoading(true); setErr(null);
    try {
      const r = await callReport({ data: { symbol: s.trim().toUpperCase() } });
      setReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [callReport]);

  const runPortfolio = useCallback(async () => {
    setPLoading(true);
    try {
      const positions = portfolioText.split(",").map((p) => {
        const [sym, w] = p.split(":").map((x) => x.trim());
        return { symbol: sym, weight: Number(w) || 0 };
      }).filter((p) => p.symbol && p.weight > 0);
      if (!positions.length) return;
      const r = await callPortfolio({ data: { positions } });
      setPortfolio(r);
    } finally { setPLoading(false); }
  }, [callPortfolio, portfolioText]);

  const runWatchlist = useCallback(async () => {
    setWLoading(true);
    try {
      const symbols = watchText.split(",").map((s) => s.trim()).filter(Boolean);
      if (!symbols.length) return;
      const r = await callWatchlist({ data: { symbols } });
      setWatch(r);
    } finally { setWLoading(false); }
  }, [callWatchlist, watchText]);

  const tfRows = report?.timeframes ?? [];

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6" dir={ar ? "rtl" : "ltr"}>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
        <div className="gradient-hero absolute inset-0 pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  {ar ? "محرك الاستخبارات" : "Intelligence Engine"}
                </div>
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                  <span className="text-gradient">{t("ذكاء السوق", "Market Intelligence")}</span>
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {t(
                    "تحليل متعدد الإطارات الزمنية، مشاعر الأخبار، النظام السوقي، المخاطر، ومخرجات قابلة للتفسير.",
                    "Multi-timeframe trend, news sentiment, regime, risk, and explainable AI outputs.",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{ar ? "تلميح:" : "Tip:"}</span>
            {ar ? "أدخل أي رمز مالي للحصول على تحليل فوري متعدد الأبعاد." : "Enter any financial symbol for instant multi-dimensional analysis."}
            <DataStatusBadge status="simulation" className="ms-auto" />
          </div>
        </div>
      </div>

      {/* ─── Symbol input ─────────────────────────────────────────────── */}
      <Card className="gradient-card border border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-base">{t("تحليل رمز", "Analyse symbol")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runReport(symbol); }}
              placeholder={t("مثال: AAPL, NVDA, GLD", "e.g. AAPL, NVDA, GLD")}
              className="max-w-xs"
            />
            <Button onClick={() => runReport(symbol)} disabled={loading || !symbol.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ms-2">{t("تحليل", "Analyse")}</span>
            </Button>
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => { setSymbol(s); runReport(s); }}
                className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && !report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      )}

      {report && (
        <>
          {/* ─── Summary tiles ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="hover-lift gradient-card border border-border shadow-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t("التوصية", "Recommendation")}</div>
                <Badge className={`mt-2 ${REC_STYLES[report.recommendation]}`}>
                  {report.recommendation.replace("_", " ").toUpperCase()}
                </Badge>
                <div className="text-xs mt-2 text-muted-foreground">
                  {t("ثقة", "Confidence")} {report.confidencePct}%
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift gradient-card border border-border shadow-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t("السعر", "Price")}</div>
                <div className="text-2xl font-bold mt-1">{report.price.toFixed(2)}</div>
                <div className={`text-sm flex items-center gap-1 ${report.changePct >= 0 ? "text-success" : "text-danger"}`}>
                  {report.changePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {report.changePct >= 0 ? "+" : ""}{report.changePct.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift gradient-card border border-border shadow-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t("الاتجاه", "Trend score")}</div>
                <div className="text-2xl font-bold mt-1">{report.trendScore}</div>
                <Progress value={(report.trendScore + 100) / 2} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card className="hover-lift gradient-card border border-border shadow-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t("التذبذب", "Volatility")}</div>
                <div className="text-2xl font-bold mt-1">{report.volatilityScore}</div>
                <Progress value={report.volatilityScore} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card className="hover-lift gradient-card border border-border shadow-card">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t("المخاطر", "Risk")}</div>
                <Badge className={`mt-2 ${RISK_STYLES[report.risk.band]}`}>
                  {report.risk.score}/100 · {report.risk.band}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* ─── Rationale ────────────────────────────────────────────── */}
          <Card className="gradient-card border border-border shadow-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> {t("ملخص الذكاء الاصطناعي", "AI rationale")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              {ar ? report.rationaleAr : report.rationale}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ─── Timeframes ───────────────────────────────────────── */}
            <Card className="gradient-card border border-border shadow-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" /> {t("الإطارات الزمنية", "Timeframes")}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-start py-2">TF</th>
                      <th className="text-end">Δ%</th>
                      <th className="text-end">{t("اتجاه", "Trend")}</th>
                      <th className="text-end">{t("قوة", "Strength")}</th>
                      <th className="text-end">{t("تذبذب", "Vol%")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tfRows.map((s) => (
                      <tr key={s.timeframe} className="border-b last:border-0">
                        <td className="py-2 font-medium">{s.timeframe}</td>
                        <td className={`text-end ${s.changePct >= 0 ? "text-success" : "text-danger"}`}>
                          {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                        </td>
                        <td className="text-end uppercase text-xs">{s.trend}</td>
                        <td className="text-end">{s.trendStrength}</td>
                        <td className="text-end">{s.volatilityPct.toFixed(2)}</td>
                      </tr>
                    ))}
                    {!tfRows.length && (
                      <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-xs">
                        {t("لا تتوفر بيانات شموع.", "No candle data available.")}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* ─── Regime + alerts ──────────────────────────────────── */}
            <Card className="gradient-card border border-border shadow-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" /> {t("النظام والتنبيهات", "Regime & smart alerts")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium">{t("النظام", "Regime")}: </span>
                  <Badge variant="secondary">{report.regime.regime.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-muted-foreground ms-2">{report.regime.confidence}%</span>
                  <div className="text-xs text-muted-foreground mt-1">{report.regime.reason}</div>
                </div>
                <div className="space-y-2">
                  {report.smartAlerts.length === 0 && (
                    <div className="text-xs text-muted-foreground">{t("لا توجد تنبيهات حالياً.", "No alerts.")}</div>
                  )}
                  {report.smartAlerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 rounded border bg-muted/30">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${a.severity === "critical" ? "text-danger" : a.severity === "warn" ? "text-warning" : "text-muted-foreground"}`} />
                      <div>
                        <div className="font-medium text-xs uppercase">{a.kind.replace(/_/g, " ")}</div>
                        <div>{a.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ─── Sentiment ────────────────────────────────────────── */}
            <Card className="gradient-card border border-border shadow-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Newspaper className="h-4 w-4" /> {t("المشاعر الإخبارية", "News sentiment")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="capitalize">{report.sentiment.label.replace("_", " ")}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {report.sentiment.bullishHits}↑ / {report.sentiment.bearishHits}↓ · {report.sentiment.total} {t("عناوين", "headlines")}
                  </span>
                </div>
                <div className="space-y-1">
                  {report.sentiment.topHeadlines.map((h, i) => (
                    <a key={i} href={h.url} target="_blank" rel="noreferrer" className="block text-sm hover:underline">
                      <span className={`me-2 text-xs ${h.polarity > 0 ? "text-success" : "text-danger"}`}>
                        {h.polarity > 0 ? "+" : ""}{h.polarity}
                      </span>
                      {h.headline}
                      <span className="text-xs text-muted-foreground ms-2">— {h.source}</span>
                    </a>
                  ))}
                  {!report.sentiment.topHeadlines.length && (
                    <div className="text-xs text-muted-foreground">{t("لا أخبار قطبية حالياً.", "No polarised headlines.")}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ─── Calendar ─────────────────────────────────────────── */}
            <Card className="gradient-card border border-border shadow-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> {t("التقويم الاقتصادي", "Economic calendar")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.calendar.upcoming.length === 0 && (
                  <div className="text-xs text-muted-foreground">{t("لا أحداث ضمن النافذة.", "No events in window.")}</div>
                )}
                <ul className="space-y-2">
                  {report.calendar.upcoming.slice(0, 8).map((e, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Badge variant={e.impact === "high" ? "destructive" : e.impact === "medium" ? "secondary" : "outline"}>
                        {e.impact}
                      </Badge>
                      <div>
                        <div className="font-medium">{e.event} <span className="text-xs text-muted-foreground">({e.country})</span></div>
                        <div className="text-xs text-muted-foreground">{new Date(e.whenISO).toLocaleString()} — {e.expectedEffect}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* ─── Explainability ───────────────────────────────────────── */}
          <Card className="gradient-card border border-border shadow-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" /> {t("تفسير القرار", "Decision explainability")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.explain.map((n, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
                    <div className="col-span-4 md:col-span-3 font-medium">{n.label}</div>
                    <div className="col-span-2 text-xs text-muted-foreground">w {Math.round(n.weight * 100)}%</div>
                    <div className="col-span-3 md:col-span-2">
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={`h-full ${n.contribution >= 0 ? "bg-success" : "bg-danger"}`}
                          style={{ width: `${Math.min(100, Math.abs(n.contribution))}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-3 md:col-span-5 text-xs text-muted-foreground">{n.detail}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Portfolio risk ───────────────────────────────────────────── */}
      <Card className="gradient-card border border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> {t("مخاطر المحفظة", "Portfolio risk score")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={portfolioText}
              onChange={(e) => setPortfolioText(e.target.value)}
              placeholder="AAPL:0.3, MSFT:0.3, NVDA:0.2, SPY:0.2"
              className="max-w-md"
            />
            <Button onClick={runPortfolio} disabled={pLoading}>
              {pLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("احسب", "Score")}
            </Button>
          </div>
          {portfolio && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label={t("المخاطر", "Risk")} value={portfolio.portfolioRisk} />
              <Metric label={t("تذبذب", "Volatility")} value={portfolio.volatility} />
              <Metric label={t("اتجاه", "Trend")} value={portfolio.trend} signed />
              <Metric label={t("المشاعر", "Sentiment")} value={portfolio.sentiment} signed />
              <Metric label={t("ثقة", "Confidence")} value={portfolio.confidence} />
            </div>
          )}
          {portfolio && portfolio.topRisks.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t("أعلى المخاطر", "Top risks")}</div>
              {portfolio.topRisks.map((r) => (
                <div key={r.symbol} className="text-sm flex items-center gap-2">
                  <span className="font-medium w-16">{r.symbol}</span>
                  <Badge className={RISK_STYLES[r.band]}>{r.risk} · {r.band}</Badge>
                  <span className="text-xs text-muted-foreground">{r.drivers.join("; ")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Watchlist intelligence ───────────────────────────────────── */}
      <Card className="gradient-card border border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> {t("ذكاء قائمة المتابعة", "Watchlist intelligence")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={watchText}
              onChange={(e) => setWatchText(e.target.value)}
              placeholder="AAPL, MSFT, NVDA"
              className="max-w-md"
            />
            <Button onClick={runWatchlist} disabled={wLoading}>
              {wLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حلّل", "Analyse")}
            </Button>
          </div>
          {watch && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-start py-2">{t("الرمز", "Symbol")}</th>
                    <th className="text-end">{t("السعر", "Price")}</th>
                    <th className="text-end">Δ%</th>
                    <th className="text-end">{t("توصية", "Reco")}</th>
                    <th className="text-end">{t("ثقة", "Conf")}</th>
                    <th className="text-end">{t("مشاعر", "Sentiment")}</th>
                    <th className="text-end">{t("مخاطر", "Risk")}</th>
                    <th className="text-end">{t("تنبيهات", "Alerts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {watch.items.map((it) => (
                    <tr key={it.symbol} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        <button className="hover:underline" onClick={() => { setSymbol(it.symbol); runReport(it.symbol); }}>
                          {it.symbol}
                        </button>
                      </td>
                      {"error" in it ? (
                        <td colSpan={7} className="text-end text-xs text-muted-foreground">{it.error}</td>
                      ) : (
                        <>
                          <td className="text-end">{it.price.toFixed(2)}</td>
                          <td className={`text-end ${it.changePct >= 0 ? "text-success" : "text-danger"}`}>
                            {it.changePct >= 0 ? "+" : ""}{it.changePct.toFixed(2)}%
                          </td>
                          <td className="text-end">
                            <Badge className={REC_STYLES[it.recommendation]}>{it.recommendation.replace("_", " ")}</Badge>
                          </td>
                          <td className="text-end">{it.confidencePct}%</td>
                          <td className="text-end capitalize text-xs">{it.sentiment.replace("_", " ")}</td>
                          <td className="text-end">
                            <Badge className={RISK_STYLES[it.risk]}>{it.risk}</Badge>
                          </td>
                          <td className="text-end">{it.alerts}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const color = signed
    ? value > 0 ? "text-success" : value < 0 ? "text-danger" : ""
    : "";
  return (
    <div className="gradient-card border border-border rounded-lg p-3 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{signed && value > 0 ? "+" : ""}{value}</div>
    </div>
  );
}
