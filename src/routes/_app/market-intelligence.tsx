import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUniversalQuote, type UniversalQuote } from "@/lib/universal-quote.functions";
import { analyzeAsset, type AssetVerdict } from "@/lib/asset-analysis.functions";
import { addUserAsset } from "@/lib/assets.functions";
import { AddToWatchlistDialog } from "@/components/pickers/AddToWatchlistDialog";
import { CreateAlertDialog } from "@/components/pickers/CreateAlertDialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  ASSET_PICKER, CATEGORY_LABELS, findAsset,
  type IntelCategory, type PickerAsset,
} from "@/lib/asset-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, TrendingUp, TrendingDown, Sparkles, Loader2,
  Plus, Eye, BellPlus, ShieldAlert, AlertTriangle, Info,
} from "lucide-react";

export const Route = createFileRoute("/_app/market-intelligence")({
  component: MarketIntelligencePage,
  head: () => ({
    meta: [
      { title: "Market Intelligence — ForeSmart" },
      { name: "description", content: "اختر أصلاً من قائمة موحدة (أسهم، كريبتو، معادن، سلع، سندات) واحصل على تحليل عربي شامل بالسعر الحي والمصدر ودرجة الثقة." },
    ],
  }),
});

const LIVE_TRADING_ENABLED = false;

// ---------- Arabic action mapping ----------
type DisplayAction = "buy" | "sell" | "hold" | "watch" | "high_risk";

function mapAction(v: AssetVerdict): { display: DisplayAction; ar: string; en: string; cls: string } {
  if (v.riskLevel === "high") return { display: "high_risk", ar: "مخاطرة عالية", en: "High Risk", cls: "bg-rose-600 text-white" };
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    buy:   { ar: "شراء محتمل", en: "Potential Buy",  cls: "bg-emerald-600 text-white" },
    sell:  { ar: "بيع محتمل",  en: "Potential Sell", cls: "bg-rose-500 text-white" },
    hold:  { ar: "انتظار",      en: "Hold/Wait",      cls: "bg-amber-500/20 text-amber-700 border-amber-500/30" },
    watch: { ar: "مراقبة",      en: "Monitor",        cls: "bg-sky-500/20 text-sky-700 border-sky-500/30" },
  };
  const m = map[v.action] ?? map.hold;
  return { display: v.action as DisplayAction, ...m };
}

function modeBadge(mode: string, ar: boolean) {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    live:    { ar: "حي",      en: "Live",    cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    delayed: { ar: "متأخر",   en: "Delayed", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
    manual:  { ar: "يدوي",    en: "Manual",  cls: "bg-muted text-muted-foreground" },
    mock:    { ar: "تجريبي",  en: "Mock",    cls: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  };
  const m = map[mode] ?? map.mock;
  return <Badge variant="outline" className={m.cls}>{ar ? m.ar : m.en}</Badge>;
}

function MarketIntelligencePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const { user } = useAuth();

  const callQuote = useServerFn(getUniversalQuote);
  const callAnalyze = useServerFn(analyzeAsset);
  const callAddAsset = useServerFn(addUserAsset);
  

  const [category, setCategory] = useState<IntelCategory>("us_stock");
  const [selected, setSelected] = useState<PickerAsset | null>(ASSET_PICKER.us_stock[0]);
  const [customSymbol, setCustomSymbol] = useState("");

  const [quote, setQuote] = useState<UniversalQuote | null>(null);
  const [verdict, setVerdict] = useState<AssetVerdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wlOpen, setWlOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const CAT_TO_ASSET_TYPE: Record<IntelCategory, "US_STOCK" | "SAUDI_STOCK" | "CRYPTO" | "METAL" | "COMMODITY" | "ETF"> = {
    us_stock: "US_STOCK", sa_stock: "SAUDI_STOCK", crypto: "CRYPTO",
    metal: "METAL", commodity: "COMMODITY", etf_bond: "ETF",
  };
  const pickedAsset = quote ? {
    symbol: quote.symbol,
    name: selected?.name ?? quote.name,
    asset_type: CAT_TO_ASSET_TYPE[category],
    last_price: quote.price ?? null,
  } : null;

  const assetsForCategory = ASSET_PICKER[category];

  const onCategory = (c: IntelCategory) => {
    setCategory(c);
    setSelected(ASSET_PICKER[c][0]);
    setQuote(null); setVerdict(null); setErr(null);
  };

  const runAnalysis = useCallback(async () => {
    const sym = selected?.symbol || customSymbol.trim().toUpperCase();
    if (!sym) return;
    const name = selected?.name || sym;
    setLoading(true); setErr(null); setQuote(null); setVerdict(null);
    try {
      const q = await callQuote({ data: { category, symbol: sym, name } });
      setQuote(q);
      const a = await callAnalyze({
        data: {
          symbol: q.symbol, name, category,
          price: q.price || 0, changePct: q.changePct || 0,
          high24h: q.high24h, low24h: q.low24h,
          language: ar ? "ar" : "en",
        },
      });
      if (a.error) setErr(a.error);
      setVerdict(a.verdict);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally { setLoading(false); }
  }, [callQuote, callAnalyze, selected, customSymbol, category, ar]);

  // ----- actions -----
  const addToPortfolio = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      const classMap: Record<IntelCategory, string> = {
        us_stock: "us_stock", sa_stock: "sa_stock", crypto: "crypto",
        metal: "metal", commodity: "commodity", etf_bond: "etf",
      };
      await callAddAsset({
        data: {
          asset_class: classMap[category] as any,
          symbol: quote.symbol,
          name: selected?.name ?? quote.name,
          quantity: 1,
          avg_cost: quote.price || 0,
          currency: "USD",
          market: category.toUpperCase(),
        },
      });
    },
    onSuccess: () => toast.success(t("تمت الإضافة إلى المحفظة", "Added to portfolio")),
    onError: (e: any) => toast.error(e?.message ?? "error"),
  });


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" dir={ar ? "rtl" : "ltr"}>
      <header>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" />
          {t("ذكاء السوق", "Market Intelligence")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("اختر فئة الأصل ثم الرمز، واحصل على السعر الحي وتحليل عربي شامل بالعوامل والسيناريو المعاكس ودرجة الثقة.",
             "Pick an asset class then a symbol, get a live quote and a full Arabic analysis with drivers, counter-scenario and confidence.")}
        </p>
      </header>

      {!LIVE_TRADING_ENABLED && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-700" />
          <div>
            <div className="font-medium text-amber-800">{t("التداول الحقيقي معطّل", "Live trading disabled")}</div>
            <div className="text-amber-800/80 text-xs">
              {t("جميع الأزرار تنفّذ معاينة أو تحديث المحفظة/قائمة المتابعة فقط — لا يتم إرسال أوامر تداول حقيقية.",
                 "All buttons only run previews or update your portfolio/watchlist. No live orders are submitted.")}
            </div>
          </div>
        </div>
      )}

      {/* Picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("اختر الأصل", "Pick an asset")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={category} onValueChange={(v) => onCategory(v as IntelCategory)}>
            <TabsList className="flex flex-wrap h-auto">
              {(Object.keys(ASSET_PICKER) as IntelCategory[]).map((c) => (
                <TabsTrigger key={c} value={c} className="text-xs">
                  {ar ? CATEGORY_LABELS[c].ar : CATEGORY_LABELS[c].en}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">{t("من القائمة", "From list")}</Label>
              <Select
                value={selected?.symbol ?? ""}
                onValueChange={(v) => { setSelected(findAsset(category, v) ?? null); setCustomSymbol(""); }}
              >
                <SelectTrigger><SelectValue placeholder={t("اختر رمز", "Select symbol")} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {assetsForCategory.map((a) => (
                    <SelectItem key={a.symbol} value={a.symbol}>
                      <span className="font-mono text-xs me-2">{a.symbol}</span>
                      {ar ? (a.nameAr ?? a.name) : a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("أو رمز يدوي", "Or custom symbol")}</Label>
              <Input
                value={customSymbol}
                onChange={(e) => { setCustomSymbol(e.target.value); setSelected(null); }}
                placeholder={t("مثال: AAPL", "e.g. AAPL")}
                className="font-mono"
              />
            </div>
          </div>
          <Button onClick={runAnalysis} disabled={loading || (!selected && !customSymbol.trim())} className="w-full md:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ms-2">{t("تحليل الأصل", "Analyse asset")}</span>
          </Button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>

      {/* Quote + Verdict */}
      {quote && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Price card */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("السعر الحالي", "Current Price")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold">{quote.price ? quote.price.toFixed(quote.price > 100 ? 2 : 4) : "—"}</div>
              <div className={`text-sm flex items-center gap-1 ${quote.changePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {quote.changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}% (24h)
              </div>
              <div className="flex items-center gap-2 pt-1">
                {modeBadge(quote.mode, ar)}
                <span className="text-xs text-muted-foreground">{t("المصدر", "Source")}: <span className="font-medium">{quote.source}</span></span>
              </div>
              {quote.high24h && quote.low24h && (
                <div className="text-xs text-muted-foreground">
                  H: {quote.high24h.toFixed(2)} · L: {quote.low24h.toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verdict card */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" /> {t("القرار والتحليل", "Verdict & Analysis")}
              </CardTitle>
              {verdict && (
                <div className="flex items-center gap-2">
                  <Badge className={mapAction(verdict).cls}>
                    {ar ? mapAction(verdict).ar : mapAction(verdict).en}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {!verdict && loading && <div className="text-sm text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> {t("جارٍ توليد التحليل…", "Generating…")}</div>}
              {!verdict && !loading && <div className="text-sm text-muted-foreground">{t("لا يتوفر تحليل بعد.", "No analysis yet.")}</div>}
              {verdict && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <MetricBox label={t("الثقة", "Confidence")} value={verdict.confidence.toUpperCase()} tone={
                      verdict.confidence === "high" ? "good" : verdict.confidence === "low" ? "bad" : "neutral"
                    } />
                    <MetricBox label={t("المخاطرة", "Risk")} value={(verdict.riskLevel ?? "medium").toUpperCase()} tone={
                      verdict.riskLevel === "high" ? "bad" : verdict.riskLevel === "low" ? "good" : "neutral"
                    } />
                    <MetricBox label={t("الأفق", "Horizon")} value={verdict.horizon.toUpperCase()} tone="neutral" />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">{t("سبب القرار", "Decision rationale")}</div>
                    <p className="text-sm leading-relaxed mt-1">{ar ? verdict.arabicSummary : verdict.rationale}</p>
                  </div>

                  {verdict.drivers?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-emerald-600" /> {t("العوامل المؤثرة (صاعدة)", "Drivers (bullish)")}
                      </div>
                      <ul className="text-sm list-disc ms-5 mt-1 space-y-0.5">
                        {verdict.drivers.slice(0, 6).map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}

                  {verdict.risks?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-rose-600" /> {t("العوامل المؤثرة (هابطة) / مخاطر", "Drivers (bearish) / risks")}
                      </div>
                      <ul className="text-sm list-disc ms-5 mt-1 space-y-0.5">
                        {verdict.risks.slice(0, 6).map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}

                  {verdict.counterScenario && (
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {t("السيناريو المعاكس", "Counter-scenario")}
                      </div>
                      <p className="text-sm mt-1">{verdict.counterScenario}</p>
                    </div>
                  )}

                  {(verdict.entry || verdict.stopLoss || verdict.targets?.length) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      {verdict.entry && <KV label={t("نقطة الدخول", "Entry")} value={verdict.entry} />}
                      {verdict.stopLoss && <KV label={t("وقف الخسارة", "Stop")} value={verdict.stopLoss} />}
                      {verdict.targets?.length ? <KV label={t("الأهداف", "Targets")} value={verdict.targets.join(" • ")} /> : null}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button size="sm" onClick={() => addToPortfolio.mutate()} disabled={addToPortfolio.isPending || !user}>
                      {addToPortfolio.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      <span className="ms-1">{t("أضف إلى محفظتي", "Add to my portfolio")}</span>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setWlOpen(true)} disabled={!user}>
                      <Eye className="h-3 w-3" />
                      <span className="ms-1">{t("أضف إلى قائمة المتابعة", "Add to watchlist")}</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAlertOpen(true)} disabled={!user}>
                      <BellPlus className="h-3 w-3" />
                      <span className="ms-1">{t("إنشاء تنبيه سعر","Create price alert")}</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                    <Info className="h-3 w-3" />
                    {t("التحليل لأغراض معلوماتية ولا يُعدّ توصية ملزمة. التداول الحقيقي معطّل.",
                       "Analysis is informational only — not binding advice. Live trading disabled.")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <AddToWatchlistDialog open={wlOpen} onOpenChange={setWlOpen} prefilled={pickedAsset} />
      <CreateAlertDialog open={alertOpen} onOpenChange={setAlertOpen} prefilled={pickedAsset} />
    </div>
  );
}

function MetricBox({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  const cls = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

