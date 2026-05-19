import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, AlertTriangle, Flame, Ship, Fuel, Gavel, Brain } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getGdeltSnapshot, aiGdeltBriefing } from "@/lib/gdelt.functions";

type Snap = Awaited<ReturnType<typeof getGdeltSnapshot>>["snapshot"];
type Brief = Awaited<ReturnType<typeof aiGdeltBriefing>>["result"];

const sevColor: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-orange-500/10 text-orange-500",
  critical: "bg-red-500/10 text-red-500",
};
const biasColor: Record<string, string> = {
  bullish: "text-emerald-500", bearish: "text-red-500", neutral: "text-muted-foreground",
};

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function intensityClass(v: number) {
  if (v >= 0.75) return "bg-red-500/30 border-red-500/60";
  if (v >= 0.5) return "bg-orange-500/25 border-orange-500/50";
  if (v >= 0.25) return "bg-yellow-500/20 border-yellow-500/40";
  if (v > 0) return "bg-emerald-500/15 border-emerald-500/30";
  return "bg-muted/40 border-border";
}

export function GdeltIntelPanel() {
  const { lang } = useI18n();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const fetchSnap = useServerFn(getGdeltSnapshot);
  const askBrief = useServerFn(aiGdeltBriefing);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchSnap({ data: { timespan: "24h", maxRecords: 100, language: lang } });
      setSnap(r.snapshot);
    } catch { /* fallback-safe */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const briefing = async () => {
    if (!snap) return;
    setBriefLoading(true);
    try {
      const r = await askBrief({ data: {
        language: lang,
        topEvents: snap.topEvents.slice(0, 10).map((e) => ({
          kind: e.kind, headline: e.headline, region: e.region,
          severity: e.severity, marketImpact: e.marketImpact,
          escalationScore: +e.escalationScore.toFixed(2), confidence: +e.confidence.toFixed(2),
        })),
        metrics: {
          conflictSeverity: +snap.conflictSeverity.toFixed(2),
          macroRiskIndex: +snap.macroRiskIndex.toFixed(2),
          oilRisk: +snap.oilRisk.toFixed(2),
          shippingRisk: +snap.shippingRisk.toFixed(2),
          sanctionsCount: snap.sanctionsCount,
        },
      } });
      setBrief(r.result ?? null);
    } finally { setBriefLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold">
            {lang === "ar" ? "ذكاء GDELT الجيوسياسي" : "GDELT Geopolitical Intelligence"}
          </h3>
          {snap && !snap.ok && (
            <Badge variant="outline" className="text-xs">
              {lang === "ar" ? "وضع احتياطي" : "Fallback (cached)"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ms-2">{lang === "ar" ? "تحديث" : "Refresh"}</span>
          </Button>
          <Button size="sm" onClick={briefing} disabled={!snap || briefLoading}>
            {briefLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            <span className="ms-2">{lang === "ar" ? "موجز AI" : "AI Briefing"}</span>
          </Button>
        </div>
      </div>

      {/* Risk metrics */}
      <div className="grid gap-3 md:grid-cols-5">
        <RiskTile icon={<AlertTriangle className="h-4 w-4" />} label={lang === "ar" ? "شدة الصراع" : "Conflict severity"} value={snap?.conflictSeverity ?? 0} />
        <RiskTile icon={<Flame className="h-4 w-4" />} label={lang === "ar" ? "مؤشر مخاطر الماكرو" : "Macro risk"} value={snap?.macroRiskIndex ?? 0} />
        <RiskTile icon={<Fuel className="h-4 w-4" />} label={lang === "ar" ? "مخاطر النفط" : "Oil risk"} value={snap?.oilRisk ?? 0} />
        <RiskTile icon={<Ship className="h-4 w-4" />} label={lang === "ar" ? "مخاطر الشحن" : "Shipping risk"} value={snap?.shippingRisk ?? 0} />
        <Card><CardContent className="flex items-center justify-between p-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground"><Gavel className="h-4 w-4" />{lang === "ar" ? "عقوبات" : "Sanctions"}</span>
          <span className="font-semibold">{snap?.sanctionsCount ?? 0}</span>
        </CardContent></Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{lang === "ar" ? "الخريطة الحرارية الجيوسياسية" : "Geopolitical heatmap"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {(snap?.heatmap ?? []).map((h) => (
            <div key={h.region} className={`rounded-md border p-3 text-xs ${intensityClass(h.intensity)}`}>
              <div className="font-semibold">{h.region}</div>
              <div className="text-muted-foreground">{h.count} {lang === "ar" ? "حدث" : "events"}</div>
              <div className="mt-1 text-[10px]">{pct(h.intensity)}</div>
            </div>
          ))}
          {!snap?.heatmap.length && <p className="col-span-full text-xs text-muted-foreground">—</p>}
        </CardContent>
      </Card>

      {/* AI briefing */}
      {brief && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" /> {brief.headline}
              <Badge variant="outline" className="ms-2">{brief.risk_level}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{brief.narrative}</p>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "ar" ? "تأثير ماكرو" : "Macro impact"}</div>
                <ul className="mt-1 list-disc ps-4 text-xs">{brief.macro_impact.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "ar" ? "للمراقبة" : "Watch"}</div>
                <ul className="mt-1 list-disc ps-4 text-xs">{brief.watch.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{lang === "ar" ? "أبرز الأحداث" : "Top events"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {snap?.topEvents.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Badge variant="outline" className="shrink-0">{e.kind}</Badge>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="line-clamp-1 hover:underline">{e.headline}</a>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={sevColor[e.severity]}>{e.severity}</Badge>
                <Badge variant="outline">{e.region}</Badge>
                <span className={biasColor[e.marketImpact]}>{e.marketImpact}</span>
                <span className="text-muted-foreground">{pct(e.escalationScore)}</span>
              </div>
            </div>
          ))}
          {!snap?.topEvents.length && <p className="text-xs text-muted-foreground">—</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function RiskTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-lg font-semibold">{pct(value)}</div>
        <Progress value={value * 100} className="h-1.5" />
      </CardContent>
    </Card>
  );
}
