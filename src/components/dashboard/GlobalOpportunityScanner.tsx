import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useGlobalScanner } from "@/hooks/useGlobalScanner";
import { useI18n } from "@/lib/i18n";
import { RefreshCcw, Radar, Bell, ArrowUp, ArrowDown, Minus, Zap, ShieldAlert } from "lucide-react";
import { patchAr } from "@/lib/aiTranslate";

const L = {
  title:    { en: "Global Opportunity Scanner", ar: "ماسح الفرص العالمي" },
  subtitle: { en: "Cross-market autonomous AI monitor", ar: "مراقب ذكاء اصطناعي متعدد الأسواق" },
  refresh:  { en: "Refresh", ar: "تحديث" },
  opps:     { en: "Opportunities", ar: "الفرص" },
  alerts:   { en: "Alerts", ar: "التنبيهات" },
  feeds:    { en: "Live Feeds", ar: "التغذيات الحية" },
  metrics:  { en: "Metrics", ar: "المؤشرات" },
  urgency:  { en: "Urgency", ar: "الأولوية" },
  conf:     { en: "Confidence", ar: "الثقة" },
  risk:     { en: "Risk-adj", ar: "معدّل المخاطر" },
  expected: { en: "Expected", ar: "العائد المتوقع" },
  horizon:  { en: "Horizon", ar: "الأفق" },
  flow:     { en: "Flow", ar: "تدفقات" },
  alloc:    { en: "Suggested allocation", ar: "تخصيص مقترح" },
  drivers:  { en: "Drivers", ar: "المحركات" },
  scenarios:{ en: "Scenarios", ar: "السيناريوهات" },
  impact:   { en: "Impact forecast", ar: "توقع التأثير" },
  corr:     { en: "Correlations", ar: "الترابطات" },
  empty:    { en: "Scanning markets…", ar: "جارٍ مسح الأسواق…" },
  liveOn:   { en: "Live", ar: "مباشر" },
  highUrg:  { en: "High urgency", ar: "أولوية عالية" },
  feedCount:{ en: "Active feeds", ar: "تغذيات نشطة" },
  reasoning:{ en: "AI reasoning", ar: "تفسير الذكاء" },
};
const t = (k: keyof typeof L, ar: boolean) => L[k][ar ? "ar" : "en"];

function biasIcon(b: string) {
  if (b === "bullish") return <ArrowUp className="h-4 w-4 text-emerald-500" />;
  if (b === "bearish") return <ArrowDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function GlobalOpportunityScanner() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { snapshot, status, refresh } = useGlobalScanner();

  return (
    <Card className="p-4 sm:p-6 space-y-4" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Radar className="h-5 w-5 text-primary" /> {t("title", ar)}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle", ar)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === "live" ? "default" : "outline"}>{status === "live" ? t("liveOn", ar) : "…"}</Badge>
          <Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCcw className="h-4 w-4 me-1" />{t("refresh", ar)}</Button>
        </div>
      </div>

      {!snapshot ? <p className="text-sm text-muted-foreground">{t("empty", ar)}</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Mini label={t("feedCount", ar)} value={String(snapshot.metrics.feedCount)} />
            <Mini label={t("highUrg", ar)} value={String(snapshot.metrics.highUrgency)} tone="warn" />
            <Mini label={t("risk", ar)} value={String(snapshot.metrics.riskAdjustedAvg)} />
            <Mini label={ar ? "صاعد/هابط/محايد" : "Bull/Bear/Neut"} value={`${snapshot.metrics.bullish}/${snapshot.metrics.bearish}/${snapshot.metrics.neutral}`} />
          </div>

          <Tabs defaultValue="opps">
            <TabsList>
              <TabsTrigger value="opps">{t("opps", ar)}</TabsTrigger>
              <TabsTrigger value="alerts">{t("alerts", ar)} ({snapshot.alerts.length})</TabsTrigger>
              <TabsTrigger value="feeds">{t("feeds", ar)}</TabsTrigger>
            </TabsList>

            <TabsContent value="opps" className="mt-4 space-y-3">
              {snapshot.opportunities.length === 0 && <p className="text-sm text-muted-foreground">{t("empty", ar)}</p>}
              {snapshot.opportunities.map((o) => (
                <div key={o.id} className="rounded-lg border p-3 sm:p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {biasIcon(o.bias)}
                      <span className="font-semibold">{o.symbol}</span>
                      <span className="text-sm text-muted-foreground">{o.assetName}</span>
                      <Badge variant="outline" className="capitalize">{o.assetClass}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary"><Zap className="h-3 w-3 me-1" />{t("urgency", ar)} {o.urgency}</Badge>
                      <Badge variant="secondary">{t("conf", ar)} {o.confidence}%</Badge>
                      <Badge variant="secondary">{t("risk", ar)} {o.riskAdjustedScore}</Badge>
                      <Badge variant={o.expectedReturn >= 0 ? "default" : "destructive"}>{t("expected", ar)} {o.expectedReturn > 0 ? "+" : ""}{o.expectedReturn}%</Badge>
                      <Badge variant="outline">{t("horizon", ar)} {o.horizonHrs}h</Badge>
                    </div>
                  </div>
                  <Progress value={o.urgency} className="h-1.5" />
                  <p className="text-sm"><span className="font-medium">{t("reasoning", ar)}:</span> {patchAr(o.reasoning, ar)}</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-medium mb-1">{t("scenarios", ar)}</div>
                      {o.scenarios.map((s) => (
                        <div key={s.label} className="flex justify-between"><span>{patchAr(s.label, ar)}</span><span className="text-muted-foreground">P {(s.probability * 100).toFixed(0)}% · R {s.payoff}</span></div>
                      ))}
                    </div>
                    <div>
                      <div className="font-medium mb-1">{t("impact", ar)}</div>
                      {o.impactForecast.map((f) => (
                        <div key={f.window} className="flex justify-between"><span>{f.window}</span><span className="text-muted-foreground">{f.direction} · {f.magnitude}%</span></div>
                      ))}
                    </div>
                    {o.correlations.length > 0 && (
                      <div>
                        <div className="font-medium mb-1">{t("corr", ar)}</div>
                        {o.correlations.map((c) => (
                          <div key={c.partner} className="flex justify-between"><span>{c.partner}</span><span className="text-muted-foreground">ρ {c.correlation} · {patchAr(c.meaning, ar)}</span></div>
                        ))}
                      </div>
                    )}
                    <div>
                      <div className="font-medium mb-1">{t("alloc", ar)} / {t("flow", ar)}</div>
                      <div className="flex justify-between"><span>{t("alloc", ar)}</span><span className="text-muted-foreground">{o.portfolioFit.suggestedAllocPct}%</span></div>
                      <div className="flex justify-between"><span>{ar ? "يُنوّع" : "diversifies"}</span><span className="text-muted-foreground">{o.portfolioFit.diversifies ? (ar ? "نعم" : "yes") : (ar ? "لا" : "no")}</span></div>
                      {o.flowAlignment && (
                        <div className="flex justify-between"><span>{t("flow", ar)}</span><span className="text-muted-foreground">{o.flowAlignment.netFlow > 0 ? "+" : ""}{o.flowAlignment.netFlow} ({o.flowAlignment.drivers.join(", ")})</span></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="alerts" className="mt-4 space-y-2">
              {snapshot.alerts.length === 0 && <p className="text-sm text-muted-foreground">{t("empty", ar)}</p>}
              {snapshot.alerts.map((a) => (
                <div key={a.id} className="rounded-md border p-3 flex items-start gap-3">
                  {a.severity === "critical" ? <ShieldAlert className="h-5 w-5 text-red-500 mt-0.5" /> :
                    a.severity === "high" ? <Bell className="h-5 w-5 text-amber-500 mt-0.5" /> :
                    <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{a.title}</span>
                      <Badge variant="outline">{a.source}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                    {a.symbols.length > 0 && <div className="text-xs mt-1 text-muted-foreground">{a.symbols.join(" · ")}</div>}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="feeds" className="mt-4 space-y-1">
              {snapshot.feedsSummary.map((f) => (
                <div key={f.source} className="flex justify-between text-sm border-b py-1">
                  <span>{f.source}</span><span className="text-muted-foreground">{f.events} {ar ? "أحداث" : "events"}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "warn" ? "text-amber-500" : ""}`}>{value}</div>
    </div>
  );
}
