import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCryptoLive } from "@/lib/marketApi";
import { batchDecisions, type AssetContext, type MarketCategory, type TradingDecision } from "@/lib/marketIntelligence";
import { tryCreateOrderFromDecision, useAutoTrading } from "@/lib/autoTrading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Brain, ShieldAlert, TrendingUp, TrendingDown, Pause, Octagon, Target, AlertTriangle, Bot , Activity } from "lucide-react";

const SAUDI_MOCK: AssetContext[] = [
  { symbol: "2222.SR", name_ar: "أرامكو السعودية", name_en: "Saudi Aramco", category: "saudi", price: 28.40, change24h: 1.42, currency: "SAR" },
  { symbol: "1120.SR", name_ar: "الراجحي", name_en: "Al Rajhi", category: "saudi", price: 92.10, change24h: 0.35, currency: "SAR" },
  { symbol: "2010.SR", name_ar: "سابك", name_en: "SABIC", category: "saudi", price: 71.20, change24h: -0.84, currency: "SAR" },
  { symbol: "TASI",    name_ar: "تاسي", name_en: "TASI", category: "saudi", price: 11820, change24h: 0.62, currency: "SAR" },
];

const US_MOCK: AssetContext[] = [
  { symbol: "AAPL",  name_ar: "آبل", name_en: "Apple",   category: "us", price: 224.10, change24h: 0.94, currency: "USD" },
  { symbol: "NVDA",  name_ar: "إنفيديا", name_en: "NVIDIA", category: "us", price: 142.20, change24h: 2.18, currency: "USD" },
  { symbol: "TSLA",  name_ar: "تيسلا", name_en: "Tesla",  category: "us", price: 248.30, change24h: -3.12, currency: "USD" },
  { symbol: "MSFT",  name_ar: "مايكروسوفت", name_en: "Microsoft", category: "us", price: 421.50, change24h: 0.42, currency: "USD" },
];

const COMM_MOCK: AssetContext[] = [
  { symbol: "XAU", name_ar: "الذهب", name_en: "Gold (oz)", category: "commodities", price: 2418, change24h: 0.94, currency: "USD" },
  { symbol: "WTI", name_ar: "النفط",  name_en: "Crude WTI", category: "commodities", price: 78.20, change24h: -1.21, currency: "USD" },
  { symbol: "SLV", name_ar: "الفضة",  name_en: "Silver",    category: "commodities", price: 31.40, change24h: 0.55, currency: "USD" },
];

type Filter = "all" | MarketCategory;

export function AIDecisionPanel() {
  const { lang } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const { settings } = useAutoTrading();

  const { data: crypto } = useQuery({ queryKey: ["crypto-live"], queryFn: fetchCryptoLive, refetchInterval: 60_000 });
  const cryptoCtx: AssetContext[] = useMemo(
    () => (crypto ?? []).map((c) => ({
      symbol: c.symbol, name_ar: c.name_ar, name_en: c.name_en,
      category: "crypto", price: c.price, change24h: c.change24h, currency: "USD",
    })),
    [crypto],
  );
  const isMock = (crypto?.[0]?.source ?? "mock") === "mock";

  const all = useMemo(() => {
    const list: AssetContext[] = [];
    if (filter === "all" || filter === "saudi") list.push(...SAUDI_MOCK);
    if (filter === "all" || filter === "us") list.push(...US_MOCK);
    if (filter === "all" || filter === "crypto") list.push(...cryptoCtx);
    if (filter === "all" || filter === "commodities") list.push(...COMM_MOCK);
    return list;
  }, [filter, cryptoCtx]);

  const decisions = useMemo(() => batchDecisions(all), [all]);

  const handleAutoTrade = (d: TradingDecision) => {
    const res = tryCreateOrderFromDecision(d, isMock && d.category === "crypto" ? false : true);
    if (!res.ok) {
      const map: Record<string, string> = {
        auto_trading_disabled: lang === "ar" ? "التداول الآلي معطل" : "Auto trading disabled",
        hold_no_order: lang === "ar" ? "القرار: انتظار — لا أمر" : "Hold — no order",
        risk_too_high: lang === "ar" ? "المخاطر عالية والثقة غير كافية" : "Risk too high",
        below_min_confidence: lang === "ar" ? "الثقة أقل من الحد المطلوب" : "Below min confidence",
        asset_not_allowed: lang === "ar" ? "الأصل غير مسموح" : "Asset not allowed",
        daily_loss_limit_reached: lang === "ar" ? "تم بلوغ حد الخسارة اليومي" : "Daily loss limit reached",
      };
      toast.warning(map[res.reason] ?? res.reason);
      return;
    }
    toast.success(lang === "ar" ? `أمر تجريبي ${d.action} على ${d.asset}` : `Simulated ${d.action} on ${d.asset}`);
  };

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">
            {lang === "ar" ? "قرارات الذكاء الاصطناعي" : "AI Trading Decisions"}
          </h2>
          <Badge variant="outline" className="text-[10px]">
            {lang === "ar" ? "محرك تجريبي" : "Mock engine"}
          </Badge>
          {settings.enabled && (
            <Badge className="text-[10px] bg-success/20 text-success border-success/30">
              <Bot className="h-3 w-3 me-1" />Auto ON
            </Badge>
          )}
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">{lang === "ar" ? "الكل" : "All"}</TabsTrigger>
            <TabsTrigger value="saudi" className="text-xs">{lang === "ar" ? "السعودي" : "Saudi"}</TabsTrigger>
            <TabsTrigger value="us" className="text-xs">US</TabsTrigger>
            <TabsTrigger value="crypto" className="text-xs">Crypto</TabsTrigger>
            <TabsTrigger value="commodities" className="text-xs">{lang === "ar" ? "السلع" : "Commodities"}</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="m-4 rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        {lang === "ar"
          ? "هذا تحليل مساعد وليس توصية مالية ملزمة. كل الأوامر تجريبية فقط."
          : "Assistive analysis only — not binding financial advice. All orders are simulated."}
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {decisions.map((d) => <DecisionCard key={d.asset} d={d} onAutoTrade={handleAutoTrade} />)}
        {decisions.length === 0 && (
          <p className="col-span-full p-6 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد بيانات" : "No data"}
          </p>
        )}
      </div>
    </Card>
  );
}

const ACTION_META = {
  BUY:         { Icon: TrendingUp,   cls: "bg-success/15 text-success border-success/30",  ar: "شراء",     en: "Buy" },
  SELL:        { Icon: TrendingDown, cls: "bg-danger/15 text-danger border-danger/30",     ar: "بيع",      en: "Sell" },
  HOLD:        { Icon: Pause,        cls: "bg-warning/15 text-warning border-warning/30",  ar: "انتظار",   en: "Hold" },
  STOP_LOSS:   { Icon: ShieldAlert,  cls: "bg-danger/15 text-danger border-danger/30",     ar: "وقف خسارة", en: "Stop loss" },
  TAKE_PROFIT: { Icon: Target,       cls: "bg-success/15 text-success border-success/30",  ar: "جني ربح",  en: "Take profit" },
} as const;

function DecisionCard({ d, onAutoTrade }: { d: TradingDecision; onAutoTrade: (d: TradingDecision) => void }) {
  const { lang } = useI18n();
  const m = ACTION_META[d.action];
  const Icon = m?.Icon ?? Activity;
  const riskClass = d.riskLevel === "HIGH" ? "text-danger" : d.riskLevel === "MEDIUM" ? "text-warning" : "text-success";

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{d.asset}</div>
          <div className="text-[10px] uppercase text-muted-foreground">{d.category}</div>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold", m.cls)}>
          <Icon className="h-3 w-3" />{lang === "ar" ? m.ar : m.en}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-md bg-muted/40 px-1 py-1.5">
          <div className="text-muted-foreground">{lang === "ar" ? "الثقة" : "Confidence"}</div>
          <div className="font-semibold">{d.confidence}%</div>
        </div>
        <div className="rounded-md bg-muted/40 px-1 py-1.5">
          <div className="text-muted-foreground">{lang === "ar" ? "المخاطر" : "Risk"}</div>
          <div className={cn("font-semibold", riskClass)}>{d.riskLevel}</div>
        </div>
        <div className="rounded-md bg-muted/40 px-1 py-1.5">
          <div className="text-muted-foreground">{lang === "ar" ? "حجم" : "Size"}</div>
          <div className="font-semibold">{d.suggestedPositionSize}%</div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{d.reasonSummary}</p>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-md border border-danger/30 bg-danger/5 px-2 py-1">
          <div className="text-muted-foreground">{lang === "ar" ? "وقف خسارة" : "Stop"}</div>
          <div className="font-medium text-danger">{d.suggestedStopLoss}</div>
        </div>
        <div className="rounded-md border border-success/30 bg-success/5 px-2 py-1">
          <div className="text-muted-foreground">{lang === "ar" ? "جني ربح" : "Target"}</div>
          <div className="font-medium text-success">{d.suggestedTakeProfit}</div>
        </div>
      </div>

      {d.supportingFactors.length > 0 && (
        <details className="mt-2 text-[11px]">
          <summary className="cursor-pointer text-success">+ {d.supportingFactors.length} {lang === "ar" ? "عوامل داعمة" : "supporting"}</summary>
          <ul className="ms-4 mt-1 list-disc space-y-0.5 text-muted-foreground">
            {d.supportingFactors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </details>
      )}
      {d.warningFactors.length > 0 && (
        <details className="mt-1 text-[11px]">
          <summary className="cursor-pointer text-warning">⚠ {d.warningFactors.length} {lang === "ar" ? "تحذيرات" : "warnings"}</summary>
          <ul className="ms-4 mt-1 list-disc space-y-0.5 text-muted-foreground">
            {d.warningFactors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </details>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground">
          RSI {d.indicators.rsi} · {d.indicators.trend.toUpperCase()} · vol {d.indicators.volatility}%
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onAutoTrade(d)}>
          <Octagon className="h-3 w-3 me-1" />
          {lang === "ar" ? "تجربة آلية" : "Simulate"}
        </Button>
      </div>
    </div>
  );
}
