import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { analyzeAsset, type AssetVerdict } from "@/lib/asset-analysis.functions";
import { useI18n } from "@/lib/i18n";
import { Brain, TrendingUp, TrendingDown, Pause, Eye, Target, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: {
    symbol: string;
    name?: string;
    category: string;
    price: number;
    changePct: number;
    high24h?: number;
    low24h?: number;
  } | null;
}

const actionMeta = {
  buy:   { icon: TrendingUp,   cls: "text-success bg-success/15 ring-success/30",  ar: "شراء", en: "Buy"  },
  sell:  { icon: TrendingDown, cls: "text-danger bg-danger/15 ring-danger/30",     ar: "بيع",  en: "Sell" },
  hold:  { icon: Pause,        cls: "text-warning bg-warning/15 ring-warning/30",  ar: "احتفاظ", en: "Hold" },
  watch: { icon: Eye,          cls: "text-primary bg-primary/15 ring-primary/30",  ar: "مراقبة", en: "Watch" },
} as const;

export function AssetAnalysisDialog({ open, onOpenChange, asset }: Props) {
  const { lang } = useI18n();
  const [verdict, setVerdict] = useState<AssetVerdict | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!asset) return;
    setBusy(true); setVerdict(null);
    try {
      const res = await analyzeAsset({
        data: {
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category,
          price: asset.price,
          changePct: asset.changePct,
          high24h: asset.high24h,
          low24h: asset.low24h,
          language: lang,
        },
      });
      if (res.error === "rate_limited") toast.error(lang === "ar" ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit");
      else if (res.error === "payment_required") toast.error(lang === "ar" ? "أضف رصيداً في Lovable AI" : "Add credits");
      else if (res.error) toast.error(lang === "ar" ? "تعذر التحليل" : "Analysis failed");
      else setVerdict(res.verdict);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (open && asset) run();
    if (!open) setVerdict(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset?.symbol]);

  const m = verdict ? actionMeta[verdict.action] ?? actionMeta.watch : null;
  const Icon = m?.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {lang === "ar" ? "تحليل ذكي" : "AI Analysis"}: {asset?.name || asset?.symbol}
          </DialogTitle>
        </DialogHeader>

        {asset && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{asset.symbol}</span>
              <span>{asset.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              <span className={cn("font-medium", asset.changePct >= 0 ? "text-success" : "text-danger")}>
                {asset.changePct >= 0 ? "+" : ""}{asset.changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 py-8 text-sm text-primary">
            <Activity className="h-4 w-4 animate-pulse" />
            {lang === "ar" ? "يتم تحليل الأصل والعوامل المؤثرة..." : "Analyzing asset and macro drivers..."}
          </div>
        )}

        {verdict && m && Icon && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold ring-1", m.cls)}>
                <Icon className="h-4 w-4" />
                {lang === "ar" ? m.ar : m.en}
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                {lang === "ar" ? "الثقة" : "Confidence"}: {verdict.confidence}
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                {lang === "ar" ? "المدى" : "Horizon"}: {verdict.horizon}
              </span>
              {verdict.positionSizePct && (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary">
                  {lang === "ar" ? "حجم الصفقة المقترح" : "Position size"}: {verdict.positionSizePct}
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-foreground/90">{verdict.rationale}</p>

            {(verdict.entry || verdict.stopLoss || verdict.targets?.length) && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label={lang === "ar" ? "الدخول" : "Entry"} value={verdict.entry} />
                <Stat label={lang === "ar" ? "وقف الخسارة" : "Stop"} value={verdict.stopLoss} tone="danger" />
                <Stat label={lang === "ar" ? "الأهداف" : "Targets"} value={verdict.targets?.join(" / ")} tone="success" icon={Target} />
              </div>
            )}

            {verdict.drivers?.length > 0 && (
              <Section title={lang === "ar" ? "المحركات" : "Drivers"} items={verdict.drivers} />
            )}
            {verdict.risks?.length > 0 && (
              <Section title={lang === "ar" ? "المخاطر" : "Risks"} items={verdict.risks} tone="warning" />
            )}

            {lang === "en" && verdict.arabicSummary && (
              <div dir="rtl" className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed">
                {verdict.arabicSummary}
              </div>
            )}

            <p className="text-center text-[11px] italic text-muted-foreground">
              {lang === "ar" ? "للأغراض التعليمية فقط — لا يُعتبر توصية مرخصة." : "Educational only — not licensed advice."}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={run} disabled={busy}>
            <RefreshCw className={cn("me-2 h-3.5 w-3.5", busy && "animate-spin")} />
            {lang === "ar" ? "إعادة التحليل" : "Re-analyze"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value?: string; tone?: "success" | "danger"; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 inline-flex items-center gap-1 font-medium", tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        {Icon && <Icon className="h-3 w-3" />}
        {value || "—"}
      </div>
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "warning" }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "warning" ? "border-warning/30 bg-warning/5" : "border-border bg-muted/20")}>
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold", tone === "warning" ? "text-warning" : "text-foreground")}>
        {tone === "warning" && <AlertTriangle className="h-3.5 w-3.5" />}
        {title}
      </div>
      <ul className="ms-4 space-y-1 text-sm text-foreground/90">
        {items.map((it, i) => <li key={i} className="list-disc">{it}</li>)}
      </ul>
    </div>
  );
}
