import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, Globe2, Activity, AlertTriangle, CloudRain, TrendingUp, Brain, Gauge } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { runGlobalIntel, subscribeGlobalIntel, type GlobalIntelSnapshot, buildExplain } from "@/services/global-intel";
import { aiGlobalNarrative } from "@/lib/global-intel.functions";

const sevColor: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-orange-500/10 text-orange-500",
  critical: "bg-red-500/10 text-red-500",
};
const biasColor: Record<string, string> = {
  bullish: "text-emerald-500", bearish: "text-red-500", neutral: "text-muted-foreground",
};

const KIND_AR: Record<string, string> = {
  supply_shock: "صدمة العرض",
  event_driven: "محرك الأحداث",
  macro_tailwind: "دعم الماكرو",
  breakout: "اختراق",
};
const WEATHER_KIND_AR: Record<string, string> = {
  "Hurricane": "إعصار", "Typhoon": "تيفون", "Flood": "فيضان",
  "Drought": "جفاف", "Heatwave": "موجة حرارة", "Cold snap": "موجة برد",
  "Storm": "عاصفة", "Wildfire": "حريق غابات", "Earthquake": "زلزال",
  "Blizzard": "عاصفة ثلجية", "Frost": "صقيع", "Tornado": "إعصار أرضي",
};
const BIAS_AR: Record<string, string> = { bullish: "صاعد", bearish: "هابط", neutral: "محايد" };
const SEV_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
const SCENARIO_AR: Record<string, string> = {
  "Bull case": "سيناريو صاعد",
  "Base case": "سيناريو أساسي",
  "Bear case": "سيناريو هابط",
};

function tKind(v: string, ar: boolean) { return ar ? (KIND_AR[v] ?? v) : v; }
function tBias(v: string, ar: boolean) { return ar ? (BIAS_AR[v] ?? v) : v; }
function tSev(v: string, ar: boolean) { return ar ? (SEV_AR[v] ?? v) : v; }
function tScenario(v: string, ar: boolean) { return ar ? (SCENARIO_AR[v] ?? v) : v; }
function tDriver(d: string, ar: boolean): string {
  if (!ar) return d;
  const strong = d.match(/^Strong tape move \((.+)\)$/);
  if (strong) return `حركة سعرية قوية (${strong[1]})`;
  const macro = d.match(/^(\d+) macro print\(s\) align with (\w+) bias$/);
  if (macro) return `${macro[1]} إشارة ماكرو متوافقة`;
  if (d === "Geopolitical flow supportive") return "التدفق الجيوسياسي داعم";
  if (d === "Supply-chain stress detected") return "ضغط سلسلة الإمداد مرصود";
  return d;
}

export function GlobalIntelPanel() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [snap, setSnap] = useState<GlobalIntelSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState<Awaited<ReturnType<typeof aiGlobalNarrative>> | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);
  const aiNarrative = useServerFn(aiGlobalNarrative);

  const refresh = async (force = true) => {
    setLoading(true);
    try { setSnap(await runGlobalIntel(force)); } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh(false);
    const id = setInterval(() => void refresh(true), 60_000);
    const unsub = subscribeGlobalIntel((s) => setSnap(s));
    return () => { clearInterval(id); unsub?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askAI = async () => {
    if (!snap) return;
    setNarrLoading(true);
    try {
      const r = await aiNarrative({ data: {
        language: lang,
        generatedAt: snap.generatedAt,
        geoEvents: snap.geoEvents.slice(0, 8).map((g) => ({
          kind: g.kind, headline: g.headline, severity: g.severity, region: g.region, marketImpact: g.marketImpact,
        })),
        econEvents: snap.econEvents.slice(0, 8).map((e) => ({
          indicator: e.indicator, region: e.region, value: e.value, surprise: e.surprise, marketImpact: e.marketImpact,
        })),
        weatherEvents: snap.weatherEvents.slice(0, 6).map((w) => ({
          kind: w.kind, region: w.region, severity: w.severity, supplyChainRisk: w.supplyChainRisk,
        })),
        topOpportunities: snap.opportunities.slice(0, 6).map((o) => ({
          asset: o.asset, assetName: o.assetName, bias: o.bias,
          confidence: o.confidence, expectedReturn: o.expectedReturn, kind: o.kind,
          drivers: o.drivers.slice(0, 4),
        })),
      } });
      setNarrative(r);
    } finally { setNarrLoading(false); }
  };

  const consensusByAsset = useMemo(() => {
    const map = new Map(snap?.consensus.map((c) => [c.symbol, c]) ?? []);
    return map;
  }, [snap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">{lang === "ar" ? "الذكاء العالمي" : "Global Intelligence"}</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refresh(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ms-2">{lang === "ar" ? "تحديث" : "Refresh"}</span>
          </Button>
          <Button size="sm" onClick={askAI} disabled={!snap || narrLoading}>
            {narrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            <span className="ms-2">{lang === "ar" ? "موجز AI" : "AI Briefing"}</span>
          </Button>
        </div>
      </div>

      {snap && (
        <div className="grid gap-3 md:grid-cols-4">
          <Stat icon={<Activity className="h-4 w-4" />} label={lang === "ar" ? "المصادر" : "Sources"} value={snap.ingestion.sources} />
          <Stat icon={<Activity className="h-4 w-4" />} label={lang === "ar" ? "أحداث/ساعة" : "Events/hr"} value={snap.ingestion.eventsLastHour} />
          <Stat icon={<Gauge className="h-4 w-4" />} label={lang === "ar" ? "زمن المعالجة" : "Latency"} value={`${snap.ingestion.latencyMs}ms`} />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label={lang === "ar" ? "دقة النظام" : "Hit rate"} value={`${(snap.accuracy.hitRate * 100).toFixed(0)}%`} />
        </div>
      )}

      {narrative?.result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4" /> {narrative.result.headline}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge variant="outline">{narrative.result.regime}</Badge>
            <p className="text-muted-foreground">{narrative.result.narrative}</p>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "ar" ? "أهم التوجهات" : "Top bias"}</div>
                <ul className="mt-1 space-y-1">
                  {narrative.result.topBias.map((b, i) => (
                    <li key={i} className="flex justify-between text-xs">
                      <span><b>{b.asset}</b> · <span className={biasColor[b.bias] ?? ""}>{tBias(b.bias, ar)}</span></span>
                      <span className="text-muted-foreground">{(b.confidence * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "ar" ? "مخاطر" : "Risk factors"}</div>
                <ul className="mt-1 list-disc ps-4 text-xs text-muted-foreground">
                  {narrative.result.riskFactors.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="opps">
        <TabsList className="flex-wrap">
          <TabsTrigger value="opps">{lang === "ar" ? "الفرص" : "Opportunities"}</TabsTrigger>
          <TabsTrigger value="geo">{lang === "ar" ? "جيوسياسي" : "Geopolitical"}</TabsTrigger>
          <TabsTrigger value="econ">{lang === "ar" ? "اقتصادي" : "Economic"}</TabsTrigger>
          <TabsTrigger value="weather">{lang === "ar" ? "طقس" : "Weather"}</TabsTrigger>
          <TabsTrigger value="accuracy">{lang === "ar" ? "الدقة" : "Accuracy"}</TabsTrigger>
        </TabsList>

        <TabsContent value="opps" className="space-y-2">
          {snap?.opportunities.map((o) => {
            const c = consensusByAsset.get(o.asset);
            const exp = c ? buildExplain(c, o, { geo: snap.geoEvents, econ: snap.econEvents, weather: snap.weatherEvents }) : null;
            return (
              <Card key={o.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{o.assetName}</span>
                      <span className={`ms-2 text-sm ${biasColor[o.bias]}`}>{tBias(o.bias, ar)}</span>
                      <Badge variant="outline" className="ms-2">{tKind(o.kind, ar)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lang === "ar" ? "ثقة" : "Conf"} {(o.confidence * 100).toFixed(0)}% · {lang === "ar" ? "العائد المتوقع" : "EV"} {o.expectedReturn}% · {o.horizonHrs}{lang === "ar" ? "س" : "h"}
                    </div>
                  </div>
                  <Progress value={o.confidence * 100} className="h-1.5" />
                  {exp && (
                    <div className="space-y-1 text-xs">
                      <div className="text-muted-foreground">{exp.summary}</div>
                      <div className="flex flex-wrap gap-1">
                        {exp.scenarios.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {tScenario(s.label, ar)} {Math.round(s.probability * 100)}%
                          </Badge>
                        ))}
                      </div>
                      {o.drivers.length > 0 && (
                        <ul className="list-disc ps-4 text-muted-foreground">
                          {o.drivers.slice(0, 3).map((d, i) => <li key={i}>{tDriver(d, ar)}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!snap?.opportunities.length && <p className="text-sm text-muted-foreground">—</p>}
        </TabsContent>

        <TabsContent value="geo" className="space-y-2">
          {snap?.geoEvents.map((g) => (
            <Card key={g.id}><CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> <span>{g.headline}</span></div>
              <div className="flex gap-2">
                <Badge className={sevColor[g.severity]}>{tSev(g.severity, ar)}</Badge>
                <Badge variant="outline">{g.region}</Badge>
                <span className={`text-xs ${biasColor[g.marketImpact]}`}>{tBias(g.marketImpact, ar)}</span>
              </div>
            </CardContent></Card>
          ))}
          {!snap?.geoEvents.length && <p className="text-sm text-muted-foreground">—</p>}
        </TabsContent>

        <TabsContent value="econ" className="space-y-2">
          {snap?.econEvents.map((e) => (
            <Card key={e.id}><CardContent className="flex items-center justify-between p-3 text-sm">
              <span><b>{e.indicator}</b> · {e.region}</span>
              <div className="flex gap-2">
                <Badge variant="outline">{ar ? "ق" : "v"} {e.value.toFixed(2)}</Badge>
                {e.surprise !== undefined && <Badge variant="outline">{ar ? "مفاجأة" : "surp"} {e.surprise.toFixed(2)}</Badge>}
                <span className={`text-xs ${biasColor[e.marketImpact]}`}>{tBias(e.marketImpact, ar)}</span>
              </div>
            </CardContent></Card>
          ))}
          {!snap?.econEvents.length && <p className="text-sm text-muted-foreground">—</p>}
        </TabsContent>

        <TabsContent value="weather" className="space-y-2">
          {snap?.weatherEvents.map((w) => (
            <Card key={w.id}><CardContent className="flex items-center justify-between p-3 text-sm">
              <div className="flex items-center gap-2"><CloudRain className="h-4 w-4" /> <span>{ar ? (WEATHER_KIND_AR[w.kind] ?? w.kind) : w.kind} · {w.region}</span></div>
              <div className="flex gap-2">
                <Badge className={sevColor[w.severity]}>{tSev(w.severity, ar)}</Badge>
                <Badge variant="outline">{ar ? "مخاطر الإمداد" : "supply"} {Math.round(w.supplyChainRisk * 100)}%</Badge>
                <span className="text-xs text-muted-foreground">{w.affectedCommodities.join(", ")}</span>
              </div>
            </CardContent></Card>
          ))}
          {!snap?.weatherEvents.length && <p className="text-sm text-muted-foreground">—</p>}
        </TabsContent>

        <TabsContent value="accuracy">
          {snap && (
            <Card><CardContent className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-5">
              <Stat label={lang === "ar" ? "العينة" : "Sample"} value={snap.accuracy.sampleSize} />
              <Stat label={lang === "ar" ? "إصابة" : "Hit rate"} value={`${(snap.accuracy.hitRate * 100).toFixed(0)}%`} />
              <Stat label="Brier" value={snap.accuracy.brier.toFixed(3)} />
              <Stat label={lang === "ar" ? "انحراف" : "Drift"} value={`${(snap.accuracy.drift * 100).toFixed(0)}%`} />
              <Stat label={lang === "ar" ? "هلوسة" : "Hallucination"} value={`${(snap.accuracy.hallucinationRate * 100).toFixed(0)}%`} />
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="flex items-center justify-between p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </CardContent></Card>
  );
}
