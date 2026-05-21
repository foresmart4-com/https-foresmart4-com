import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUserAssets } from "@/lib/assets.functions";
import { useMarketIntel } from "@/hooks/useMarketIntel";
import { buildPortfolioAI, CLASS_LABEL_AR_MAP, type Action } from "@/lib/portfolio-ai-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, Shield, Target, AlertTriangle, Sparkles, Gauge, Info, PlusCircle } from "lucide-react";
import { DataModeBadge } from "@/components/assets/DataModeBadge";

export const Route = createFileRoute("/_app/portfolio-ai")({
  component: PortfolioAIPage,
  head: () => ({
    meta: [
      { title: "محرك الذكاء للمحفظة — ForeSmart" },
      { name: "description", content: "تحليل ذكي غير ملزم لمحفظة الأصول: توصيات، عوامل مؤثرة، ومؤشرات مخاطر." },
    ],
  }),
});

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
function fmtPct(n: number, d = 1) { return `${n.toFixed(d)}%`; }

function HintNumber({ value, hint, className = "" }: { value: string; hint: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
          {value}
          <Info className="h-3 w-3 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-right">{hint}</TooltipContent>
    </Tooltip>
  );
}

const actionVariant: Record<Action, "default" | "destructive" | "outline" | "secondary"> = {
  increase: "default", reduce: "destructive", hold: "outline", watch: "secondary",
};

function PortfolioAIPage() {
  const list = useServerFn(listUserAssets);
  const assetsQ = useQuery({
    queryKey: ["user-assets"],
    queryFn: () => list(),
    refetchInterval: 60_000,
  });
  const { data: intel } = useMarketIntel(undefined, 60_000);

  const pack = useMemo(() => {
    if (!assetsQ.data) return null;
    return buildPortfolioAI(assetsQ.data.assets, intel);
  }, [assetsQ.data, intel]);

  if (assetsQ.isLoading) {
    return <div className="container mx-auto max-w-7xl p-6 text-muted-foreground">جاري التحميل…</div>;
  }

  if (!pack || pack.recommendations.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> محرك الذكاء للمحفظة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              لا توجد أصول لتحليلها. أضف أصولًا إلى محفظتك حتى يستطيع المحرك تقديم تحليل وتوصيات تحليلية غير ملزمة.
            </p>
            <Button asChild>
              <Link to="/assets-portfolio"><PlusCircle className="h-4 w-4 ml-2" />أضف أصولًا إلى المحفظة</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = pack.metrics;
  const s = pack.summary;

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> محرك الذكاء للمحفظة
          </h1>
          <p className="text-sm text-muted-foreground">
            تحليل غير ملزم مبني على أصولك الفعلية في محفظة الأصول.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">الوضع: {s.stanceAr}</Badge>
          <Badge>ثقة التحليل {s.confidence}%</Badge>
          <Button asChild size="sm" variant="outline">
            <Link to="/assets-portfolio">إدارة الأصول</Link>
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>{pack.disclaimerAr} التداول الحقيقي معطّل (<code>LIVE_TRADING_ENABLED=false</code>).</span>
        </CardContent>
      </Card>

      {/* Key metrics */}
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="إجمالي المحفظة" value={fmtUSD(m.totalValue)} hint="مجموع القيمة السوقية الحالية لجميع الأصول النشطة." />
        <Metric label="الربح/الخسارة" value={`${m.pnl >= 0 ? "+" : ""}${fmtUSD(m.pnl)} (${fmtPct(m.pnlPct)})`}
          hint="الفرق بين القيمة السوقية الحالية والتكلفة الإجمالية." valueClass={m.pnl >= 0 ? "text-emerald-500" : "text-rose-500"} />
        <Metric label="درجة المخاطر" value={`${m.riskScore}/100`}
          hint="مؤشر تجميعي للمخاطر يعتمد على التقلب وتركيز الأصول. كلما زاد الرقم زادت المخاطر." />
        <Metric label="VaR 95% يومي" value={m.varPct !== null ? fmtPct(m.varPct, 2) : "غير كافٍ من البيانات"}
          hint="أقصى خسارة يومية متوقعة بثقة 95% بناءً على تقلب أصول المحفظة." />
      </div>

      {/* Allocation summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">توزيع المحفظة</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4 text-sm">
          <AllocRow label="نقد" pct={m.cashPct} hint="نسبة النقد من إجمالي المحفظة." />
          <AllocRow label="أسهم وصناديق" pct={m.equityPct} hint="نسبة الأسهم الأمريكية/السعودية وصناديق ETF." />
          <AllocRow label="كريبتو" pct={m.cryptoPct} hint="نسبة العملات الرقمية." />
          <AllocRow label="دفاعي" pct={m.defensivePct} hint="مجموع النقد والسندات والمعادن." />
        </CardContent>
      </Card>

      {/* Summary card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> ملخص قرار الذكاء
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">الوضع العام</p>
            <p className="text-lg font-bold">{s.stanceAr}</p>
            <p className="text-xs text-muted-foreground">
              تنويع: <HintNumber value={`${m.diversification}/100`} hint="مؤشر تنوع المحفظة. الأعلى أفضل." />
              {" · "}
              Sharpe: <HintNumber value={m.sharpe !== null ? m.sharpe.toString() : "غير متاح"} hint="نسبة العائد إلى المخاطرة. الأعلى يعني عائدًا أفضل مقابل التقلب." />
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">أهم 3 مخاطر</p>
            <ul className="space-y-1 text-xs list-disc pr-4">
              {s.topRisksAr.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">أهم 3 فرص</p>
            <ul className="space-y-1 text-xs list-disc pr-4">
              {s.topOpportunitiesAr.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
          <div className="md:col-span-3 rounded-md border bg-primary/5 p-3 text-sm">
            <span className="font-semibold">أفضل إجراء مقترح:</span> {s.bestActionAr}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> توصيات تحليلية لكل أصل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pack.recommendations.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="text-xs text-muted-foreground">— {r.name}</span>
                  <Badge variant="outline" className="text-[10px]">{CLASS_LABEL_AR_MAP[r.assetClass]}</Badge>
                  <DataModeBadge mode={r.dataMode} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={actionVariant[r.action]}>{r.actionAr}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help">ثقة {r.confidence}%</Badge>
                    </TooltipTrigger>
                    <TooltipContent>مدى ثقة المحرك بهذه التوصية</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-muted-foreground">الوزن الحالي</p>
                  <HintNumber value={fmtPct(r.weight * 100)} hint="نسبة هذا الأصل من إجمالي المحفظة حالياً." />
                </div>
                <div>
                  <p className="text-muted-foreground">الوزن المستهدف</p>
                  <HintNumber value={fmtPct(r.targetWeight * 100)} hint="السقف الموصى به وفقاً لطبيعة الأصل والوضع العام." />
                </div>
                <div>
                  <p className="text-muted-foreground">القيمة والربح</p>
                  <span>{fmtUSD(r.marketValue)} · </span>
                  <span className={r.pnl >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {r.pnl >= 0 ? "+" : ""}{fmtPct(r.pnlPct)}
                  </span>
                </div>
              </div>

              <Progress value={Math.min(100, (r.weight / Math.max(r.targetWeight, 0.01)) * 100)} className="h-1.5" />

              <p className="text-xs">{r.rationaleAr}</p>

              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">العوامل المؤثرة:</p>
                  <ul className="list-disc pr-4 space-y-0.5">
                    {r.factorsAr.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">المخاطر:</p>
                  <ul className="list-disc pr-4 space-y-0.5">
                    {r.risksAr.length ? r.risksAr.map((rk, i) => <li key={i}>{rk}</li>)
                      : <li className="text-muted-foreground">لا توجد مخاطر إضافية ملحوظة</li>}
                  </ul>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">متى يتغير القرار؟</span> {r.triggerAr}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4" /> محرك العوامل (Factors Engine)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pack.factors.map((f) => (
            <div key={f.key} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.labelAr}</span>
                <Badge variant={f.impactAr === "إيجابي" ? "default" : f.impactAr === "سلبي" ? "destructive" : "outline"}>
                  {f.impactAr}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{f.valueAr}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Shield className="h-3 w-3" /> جميع الأرقام أعلاه للإطلاع فقط ولا تُعد توصية مالية.
      </p>
    </div>
  );
}

function Metric({ label, value, hint, valueClass = "" }: { label: string; value: string; hint: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 cursor-help">
              {label} <Info className="h-3 w-3" />
            </p>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-right">{hint}</TooltipContent>
        </Tooltip>
        <p className={`mt-1 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AllocRow({ label, pct, hint }: { label: string; pct: number; hint: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground cursor-help inline-flex items-center gap-1">{label} <Info className="h-3 w-3" /></span>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
        <span className="font-mono">{fmtPct(pct * 100)}</span>
      </div>
      <Progress value={pct * 100} className="h-1.5" />
    </div>
  );
}
