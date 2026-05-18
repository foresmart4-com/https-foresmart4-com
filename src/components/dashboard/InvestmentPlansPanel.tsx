import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Plus, TrendingUp, Trash2, Play, Pause, Brain, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PLAN_TEMPLATES, getTemplate, type PlanType } from "@/services/investment/planEngine";
import { generateAllocation, type AllocationInput } from "@/services/investment/allocationEngine";
import { projectPlan } from "@/services/investment/projectionEngine";
import { listInvestmentPlans, saveInvestmentPlan, setPlanStatus } from "@/lib/realBroker.functions";
import type { MarketIntel } from "@/services/analysis";

interface PlanRow {
  id: string; name: string; plan_type: PlanType; duration_days: number;
  capital_amount: number; currency: string; status: string;
  ai_confidence: number | null;
  allocation: Record<string, unknown>; projection: Record<string, unknown>;
  target_markets: string[]; risk_level: string;
}

export function InvestmentPlansPanel({ data, ar }: { data: MarketIntel | null; ar: boolean }) {
  const fetchPlans = useServerFn(listInvestmentPlans);
  const savePlan = useServerFn(saveInvestmentPlan);
  const updateStatus = useServerFn(setPlanStatus);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetchPlans();
      setPlans((res.plans as PlanRow[]) ?? []);
    } catch { /* unauth */ }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const allocationInputs: AllocationInput[] = useMemo(() => {
    const signals = data?.signals ?? [];
    return signals.map((s) => ({
      assetKey: s.asset,
      bias: s.action === "BUY" ? "long" : s.action === "SELL" ? "short" : "neutral",
      confidence: s.confidence,
      momentum: s.action === "BUY" ? 60 : s.action === "SELL" ? -60 : 0,
      volatility: data?.quotes.find((q) => q.key === s.asset)?.volatility ?? 40,
      liquidity: 65,
      edgeScore: s.confidence,
      regimeAlignment: data?.regime?.confidence ?? 50,
    }));
  }, [data]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <h3 className="font-display text-lg font-bold">
            {ar ? "باقات تحليلات الذكاء الاصطناعي" : "AI Analytics Memberships"}
          </h3>
        </div>
        <CreatePlanDialog
          ar={ar} open={open} setOpen={setOpen}
          allocationInputs={allocationInputs}
          onCreated={async () => { setOpen(false); await refresh(); }}
          savePlan={savePlan}
        />
      </header>

      {loading ? (
        <Card className="border-border/50 bg-card/40 backdrop-blur-xl p-6 text-sm text-muted-foreground">
          {ar ? "تحميل..." : "Loading plans..."}
        </Card>
      ) : plans.length === 0 ? (
        <Card className="border-border/50 bg-card/40 backdrop-blur-xl p-6 text-sm text-muted-foreground">
          {ar ? "لا توجد خطط — أنشئ خطتك الأولى." : "No plans yet — create your first plan."}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} ar={ar} onStatus={async (s) => {
              await updateStatus({ data: { id: p.id, status: s } });
              await refresh();
            }} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanCard({ plan, ar, onStatus }: {
  plan: PlanRow; ar: boolean;
  onStatus: (s: "active" | "paused" | "cancelled") => Promise<void>;
}) {
  const tpl = getTemplate(plan.plan_type);
  const proj = plan.projection as { base?: { returnPct: number; finalValue: number }; expectedReturnPct?: number };
  const alloc = plan.allocation as { slices?: Array<{ asset: string; weightPct: number }>; diversificationScore?: number };
  const statusColor = {
    active: "bg-success/15 text-success border-success/30",
    paused: "bg-warning/15 text-warning border-warning/30",
    draft: "bg-muted/40 text-muted-foreground border-border",
    completed: "bg-primary/15 text-primary border-primary/30",
    cancelled: "bg-danger/15 text-danger border-danger/30",
  }[plan.status] ?? "bg-muted/40 text-muted-foreground border-border";

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-xl p-4 transition-all hover:border-primary/40 hover:shadow-[0_8px_40px_rgba(99,102,241,0.18)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display text-base font-bold">{plan.name}</h4>
          <p className="text-xs text-muted-foreground">{ar ? tpl.nameAr : tpl.name}</p>
        </div>
        <Badge className={cn("border", statusColor)}>{plan.status}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label={ar ? "رأس المال" : "Capital"} value={`${plan.capital_amount.toLocaleString()} ${plan.currency}`} />
        <Metric label={ar ? "المدة" : "Duration"} value={`${plan.duration_days}d`} />
        <Metric label={ar ? "العائد المتوقع" : "Expected"} value={`${proj?.expectedReturnPct?.toFixed(1) ?? "—"}%`} />
        <Metric label={ar ? "ثقة AI" : "AI Conf"} value={`${Math.round(plan.ai_confidence ?? 0)}/100`} />
        <Metric label={ar ? "التنويع" : "Diversification"} value={`${alloc?.diversificationScore ?? "—"}`} />
        <Metric label={ar ? "المخاطرة" : "Risk"} value={plan.risk_level} />
      </dl>

      {alloc?.slices && (
        <div className="mt-3 flex flex-wrap gap-1">
          {alloc.slices.map((s) => (
            <span key={s.asset} className="rounded-md border border-border/50 bg-background/40 px-2 py-0.5 text-[11px] font-mono">
              {s.asset} {s.weightPct.toFixed(0)}%
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {plan.status === "active" ? (
          <Button size="sm" variant="outline" onClick={() => onStatus("paused")} className="flex-1">
            <Pause className="mr-1 h-3 w-3" /> {ar ? "إيقاف مؤقت" : "Pause"}
          </Button>
        ) : (
          <Button size="sm" onClick={() => onStatus("active")} className="flex-1">
            <Play className="mr-1 h-3 w-3" /> {ar ? "تفعيل" : "Activate"}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => onStatus("cancelled")} aria-label="cancel">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/30 px-2 py-1">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs font-bold">{value}</dd>
    </div>
  );
}

function CreatePlanDialog({ ar, open, setOpen, allocationInputs, onCreated, savePlan }: {
  ar: boolean; open: boolean; setOpen: (b: boolean) => void;
  allocationInputs: AllocationInput[]; onCreated: () => Promise<void>;
  savePlan: ReturnType<typeof useServerFn<typeof saveInvestmentPlan>>;
}) {
  const [type, setType] = useState<PlanType>("balanced");
  const [name, setName] = useState("My Growth Plan");
  const [capital, setCapital] = useState(1000);
  const [duration, setDuration] = useState(180);
  const [submitting, setSubmitting] = useState(false);

  const tpl = getTemplate(type);

  const preview = useMemo(() => {
    const alloc = generateAllocation(tpl, capital, allocationInputs);
    const proj = projectPlan(tpl, capital, duration, alloc.aggregateConfidence);
    return { alloc, proj };
  }, [tpl, capital, duration, allocationInputs]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await savePlan({ data: {
        name, plan_type: type, duration_days: duration, capital_amount: capital,
        currency: "USDT",
        target_markets: tpl.targetMarkets,
        risk_level: tpl.riskLevel,
        allocation: preview.alloc as unknown as Record<string, unknown>,
        projection: preview.proj as unknown as Record<string, unknown>,
        ai_confidence: preview.alloc.aggregateConfidence,
      } });
      await onCreated();
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-3 w-3" /> {ar ? "خطة جديدة" : "New Plan"}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ar ? "إنشاء خطة استثمار" : "Create Investment Plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{ar ? "الاسم" : "Name"}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{ar ? "النوع" : "Type"}</Label>
              <Select value={type} onValueChange={(v) => setType(v as PlanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_TEMPLATES.map((t) => (
                    <SelectItem key={t.type} value={t.type}>{ar ? t.nameAr : t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{ar ? "المدة (أيام)" : "Duration (days)"}</Label>
              <Input type="number" value={duration} min={7} max={3650}
                onChange={(e) => setDuration(Math.max(7, Number(e.target.value) || 0))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{ar ? "رأس المال (USDT)" : "Capital (USDT)"}</Label>
            <Input type="number" value={capital} min={50}
              onChange={(e) => setCapital(Math.max(0, Number(e.target.value) || 0))} />
          </div>

          <div className="rounded-lg border border-border/50 bg-background/30 p-3 text-xs">
            <p className="mb-2 flex items-center gap-1 font-bold">
              <Brain className="h-3 w-3 text-primary" />
              {ar ? "معاينة AI" : "AI Preview"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <PreviewMetric label={ar ? "الثقة" : "Confidence"} value={`${preview.alloc.aggregateConfidence}/100`} />
              <PreviewMetric label={ar ? "العائد" : "Return"} value={`${preview.proj.expectedReturnPct}%`} />
              <PreviewMetric label={ar ? "التقلب" : "Vol"} value={`${preview.proj.volatilityPct}%`} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {preview.alloc.slices.map((s) => (
                <span key={s.asset} className="rounded border border-border/40 bg-card/40 px-1.5 py-0.5 font-mono text-[10px]">
                  {s.asset} {s.weightPct.toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={submitting} onClick={submit}>
            {submitting ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الخطة" : "Save Plan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/30 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-bold">{value}</p>
    </div>
  );
}
