import { useEffect, useMemo, useState } from "react";
import { Brain, AlertTriangle, Activity, Sparkles, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { generateBrainSnapshot, type BrainSnapshot } from "@/services/intelligence/dynamicBrain";

export function DynamicAIBrainPanel({ ar = false }: { ar?: boolean }) {
  const [snap, setSnap] = useState<BrainSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    try { setSnap(generateBrainSnapshot()); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 45_000);
    return () => clearInterval(id);
  }, []);

  const topConf = useMemo(() => snap?.confidence.slice(0, 5) ?? [], [snap]);
  const criticalAnoms = useMemo(() => snap?.anomalies.filter((a) => a.severity !== "info") ?? [], [snap]);

  return (
    <Card className="p-5 border-primary/20 bg-gradient-to-br from-card to-card/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{ar ? "العقل الديناميكي للذكاء الاصطناعي" : "Dynamic AI Brain"}</h3>
          <Badge variant="outline" className="text-[10px]">{ar ? "حي" : "LIVE"}</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!snap ? (
        <div className="text-sm text-muted-foreground py-8 text-center">{ar ? "جاري التحليل..." : "Analyzing..."}</div>
      ) : (
        <div className="space-y-5">
          {/* Market summary */}
          <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{snap.summary.headline}</span>
              <Badge variant="secondary" className="text-[10px] uppercase">{snap.summary.regime}</Badge>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc ps-5">
              {snap.summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>

          {/* Confidence */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> {ar ? "أعلى ثقة" : "Top Confidence"}
            </div>
            <div className="space-y-2">
              {topConf.map((c) => (
                <div key={c.symbol} className="rounded-md border border-border/40 p-2.5 bg-background/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{c.symbol}</span>
                    <Badge variant={c.score > 70 ? "default" : c.score > 50 ? "secondary" : "outline"} className="text-[10px]">
                      {c.score}%
                    </Badge>
                  </div>
                  <Progress value={c.score} className="h-1.5" />
                  {c.rationale.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                      {c.rationale.slice(0, 2).join(" • ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Anomalies */}
          {criticalAnoms.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {ar ? "شذوذ السوق" : "Anomalies"}
              </div>
              <div className="space-y-1.5">
                {criticalAnoms.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs rounded-md border border-border/40 p-2 bg-background/40">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[9px] uppercase">
                        {a.kind.replace("_", " ")}
                      </Badge>
                      <span className="font-medium">{a.symbol}</span>
                    </div>
                    <span className="text-muted-foreground">{a.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend snapshot */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              {ar ? "اتجاهات حية" : "Live Trends"}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {snap.trends.slice(0, 9).map((t) => (
                <div key={t.symbol} className="rounded-md border border-border/40 p-1.5 bg-background/40 flex items-center justify-between">
                  <span className="text-xs font-medium">{t.symbol}</span>
                  <div className="flex items-center gap-1">
                    {t.bias === "long" ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                      : t.bias === "short" ? <TrendingDown className="h-3 w-3 text-red-500" />
                      : <span className="h-3 w-3 inline-block rounded-full bg-muted" />}
                    <span className="text-[10px] text-muted-foreground">{t.strength}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/40">
            {ar ? "آخر تحديث: " : "Updated: "}{new Date(snap.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
