import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarDays, AlertTriangle, TrendingUp, Info, RefreshCw, ExternalLink } from "lucide-react";
import { getEconomicEvents } from "@/lib/economic-calendar.functions";
import { useBooleanPref } from "@/lib/investor-prefs";
import type { IntelCategory } from "@/lib/asset-picker";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Economic Calendar — ForeSmart" },
      { name: "description", content: "High-impact macro events with bilingual market impact explanations." },
    ],
  }),
});

interface EvtItem {
  date: string; time: string; country: string; flag: string;
  event: string; impact: "low" | "medium" | "high";
  previous?: string; forecast?: string;
}

function explainImpact(e: EvtItem, lang: "ar" | "en"): string {
  const n = e.event.toLowerCase();
  if (n.includes("cpi") || n.includes("inflation")) {
    return lang === "ar"
      ? "قراءة أعلى من المتوقع ترفع توقعات تشديد السياسة النقدية وتضغط على الأسهم والذهب، وتقوي الدولار."
      : "A hotter print lifts hawkish bets, pressures equities & gold, and strengthens the dollar.";
  }
  if (n.includes("rate decision") || n.includes("fomc") || n.includes("boj") || n.includes("boe") || n.includes("ecb") || n.includes("pboc")) {
    return lang === "ar"
      ? "قرارات الفائدة تحرك العملات وعوائد السندات والأسهم الحساسة للفائدة — انتبه لنبرة البيان والتوقعات."
      : "Rate decisions drive FX, yields and rate-sensitive equities — watch statement tone and dot-plot.";
  }
  if (n.includes("payroll") || n.includes("unemployment") || n.includes("jobless")) {
    return lang === "ar"
      ? "بيانات سوق العمل تعكس قوة الاقتصاد وتؤثر مباشرة على توقعات الفائدة."
      : "Labor data reflects economic strength and directly steers rate expectations.";
  }
  if (n.includes("gdp")) {
    return lang === "ar"
      ? "نمو الناتج المحلي يحدد اتجاه الأسهم الدورية ومخاطر الركود."
      : "GDP growth sets the tone for cyclicals and recession risk pricing.";
  }
  if (n.includes("pmi")) {
    return lang === "ar"
      ? "مؤشرات النشاط الصناعي/الخدمي — قراءة فوق 50 توسع، تحت 50 انكماش."
      : "Activity indices — above 50 expansion, below 50 contraction.";
  }
  if (n.includes("crude") || n.includes("oil")) {
    return lang === "ar"
      ? "مخزونات النفط تحرك أسعار الخام وأسهم الطاقة بشكل مباشر."
      : "Oil inventories move crude prices and energy equities directly.";
  }
  if (n.includes("zew") || n.includes("sentiment") || n.includes("confidence")) {
    return lang === "ar"
      ? "مؤشرات الثقة تعكس توقعات المستثمرين والمستهلكين وتأثيرها على الأصول الخطرة."
      : "Sentiment surveys reflect investor/consumer outlook and risk-asset appetite.";
  }
  return lang === "ar"
    ? "حدث اقتصادي قد يؤثر على تقلبات الأسواق ذات الصلة."
    : "Macro event that may influence related market volatility.";
}

/** Map an event to up to 4 related assets (category + symbol) for quick analysis. */
function relatedAssets(e: EvtItem): Array<{ category: IntelCategory; symbol: string; label: string }> {
  const n = e.event.toLowerCase();
  const c = e.country;
  const out: Array<{ category: IntelCategory; symbol: string; label: string }> = [];
  const isUS = c === "United States";
  const isEU = c === "Euro Area" || c === "Germany";
  const isGulf = c === "Saudi Arabia" || c === "United Arab Emirates";

  if (n.includes("cpi") || n.includes("inflation") || n.includes("ppi")) {
    out.push({ category: "metal", symbol: "XAU", label: "XAU" });
    out.push({ category: "etf_bond", symbol: "TLT", label: "TLT" });
    if (isUS) out.push({ category: "etf_bond", symbol: "SPY", label: "SPY" });
  } else if (n.includes("rate decision") || n.includes("fomc") || n.includes("interest rate")) {
    out.push({ category: "etf_bond", symbol: "TLT", label: "TLT" });
    out.push({ category: "etf_bond", symbol: "SPY", label: "SPY" });
    out.push({ category: "crypto", symbol: "BTC", label: "BTC" });
    out.push({ category: "metal", symbol: "XAU", label: "XAU" });
  } else if (n.includes("payroll") || n.includes("nonfarm") || n.includes("unemployment") || n.includes("jobless")) {
    out.push({ category: "etf_bond", symbol: "SPY", label: "SPY" });
    out.push({ category: "us_stock", symbol: "JPM", label: "JPM" });
  } else if (n.includes("gdp")) {
    out.push({ category: "etf_bond", symbol: isEU ? "QQQ" : "SPY", label: isEU ? "QQQ" : "SPY" });
    out.push({ category: "us_stock", symbol: "AMZN", label: "AMZN" });
  } else if (n.includes("crude") || n.includes("oil") || n.includes("opec")) {
    out.push({ category: "commodity", symbol: "WTI/USD", label: "WTI" });
    out.push({ category: "commodity", symbol: "BRENT/USD", label: "Brent" });
    out.push({ category: "us_stock", symbol: "XOM", label: "XOM" });
    if (isGulf) out.push({ category: "sa_stock", symbol: "2222.SR", label: "Aramco" });
  } else if (n.includes("pmi")) {
    out.push({ category: "etf_bond", symbol: "SPY", label: "SPY" });
    out.push({ category: "us_stock", symbol: "CAT" as any, label: "CAT" });
  } else if (n.includes("retail")) {
    out.push({ category: "us_stock", symbol: "WMT", label: "WMT" });
    out.push({ category: "us_stock", symbol: "AMZN", label: "AMZN" });
  } else {
    out.push({ category: "etf_bond", symbol: "SPY", label: "SPY" });
  }

  return out.slice(0, 4);
}

const REGION_MAP: Record<string, string> = {
  "United States": "us", "Euro Area": "eu", "Germany": "eu", "United Kingdom": "uk",
  "China": "cn", "Japan": "jp", "Saudi Arabia": "sa", "United Arab Emirates": "sa",
};

const AUTO_REFRESH_MS = 60_000;

function CalendarPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [events, setEvents] = useState<EvtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [impactFilter, setImpactFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [region, setRegion] = useState<string>("all");
  const [range, setRange] = useState<"all" | "today" | "week">("all");
  const [source, setSource] = useState<string>("");
  const [mode, setMode] = useState<"live" | "delayed" | "mock">("mock");

  async function load() {
    setRefreshing(true);
    try {
      const data = await getEconomicEvents();
      setEvents(data.events as EvtItem[]);
      setSource(data.source || "");
      setMode((data.mode as "live" | "delayed" | "mock") || "mock");
      setLastUpdated(Date.now());
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return events.filter((e) => {
      if (impactFilter !== "all" && e.impact !== impactFilter) return false;
      if (region !== "all" && REGION_MAP[e.country] !== region) return false;
      if (range === "today" && e.date !== today) return false;
      if (range === "week" && (e.date < today || e.date > weekFromNow)) return false;
      return true;
    });
  }, [events, impactFilter, region, range]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, EvtItem[]>>((acc, e) => {
      (acc[e.date] = acc[e.date] || []).push(e); return acc;
    }, {});
  }, [filtered]);

  const counts = useMemo(() => ({
    high: events.filter((e) => e.impact === "high").length,
    medium: events.filter((e) => e.impact === "medium").length,
    low: events.filter((e) => e.impact === "low").length,
  }), [events]);

  const impactColor = (i: string) =>
    i === "high" ? "bg-rose-500/20 text-rose-400 border-rose-500/40" :
    i === "medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/40" :
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

  const impactLabel = (i: string) =>
    ar ? i === "high" ? "تأثير قوي" : i === "medium" ? "تأثير متوسط" : "تأثير ضعيف" : i;

  return (
    <TooltipProvider>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <CalendarDays className="h-7 w-7 text-primary" /> {ar ? "التقويم الاقتصادي" : "Economic Calendar"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ar
                ? "أهم الأحداث الاقتصادية والمؤشرات التي تحرك الأسواق — مع شرح فوري وروابط مباشرة إلى الأصول المتأثرة."
                : "Key macro events moving markets — with instant impact explanations and direct links to related assets."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-60"
              >
                <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
                {ar ? "تحديث الآن" : "Refresh now"}
              </button>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                {ar ? "تحديث تلقائي" : "Auto-refresh"}
              </label>
            </div>
            {(source || lastUpdated) && (
              <div className="flex items-center gap-2">
                {source && <span className="text-muted-foreground">{ar ? "المصدر: " : "Source: "}{source}</span>}
                {lastUpdated && (
                  <span className="text-muted-foreground">
                    • {ar ? "آخر تحديث: " : "Updated: "}{new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
                <span className={
                  "px-2 py-0.5 rounded border text-[10px] font-semibold " +
                  (mode === "live"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                    : mode === "delayed"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
                      : "border-violet-500/40 bg-violet-500/15 text-violet-500")
                }>
                  {mode === "live" ? (ar ? "حي" : "Live")
                    : mode === "delayed" ? (ar ? "متأخر" : "Delayed")
                    : (ar ? "تجريبي" : "Mock")}
                </span>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3"><div className="text-xs text-muted-foreground">{ar ? "تأثير قوي" : "High impact"}</div><div className="text-2xl font-bold text-rose-400">{counts.high}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">{ar ? "تأثير متوسط" : "Medium"}</div><div className="text-2xl font-bold text-amber-400">{counts.medium}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">{ar ? "تأثير ضعيف" : "Low"}</div><div className="text-2xl font-bold text-emerald-400">{counts.low}</div></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الفترة" : "All upcoming"}</SelectItem>
              <SelectItem value="today">{ar ? "اليوم" : "Today"}</SelectItem>
              <SelectItem value="week">{ar ? "هذا الأسبوع" : "This week"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={impactFilter} onValueChange={(v) => setImpactFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل التأثيرات" : "All impact"}</SelectItem>
              <SelectItem value="high">{ar ? "قوي فقط" : "High only"}</SelectItem>
              <SelectItem value="medium">{ar ? "متوسط فقط" : "Medium only"}</SelectItem>
              <SelectItem value="low">{ar ? "ضعيف فقط" : "Low only"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل المناطق" : "All regions"}</SelectItem>
              <SelectItem value="us">🇺🇸 {ar ? "أمريكا" : "US"}</SelectItem>
              <SelectItem value="eu">🇪🇺 {ar ? "أوروبا" : "Europe"}</SelectItem>
              <SelectItem value="uk">🇬🇧 {ar ? "بريطانيا" : "UK"}</SelectItem>
              <SelectItem value="cn">🇨🇳 {ar ? "الصين" : "China"}</SelectItem>
              <SelectItem value="jp">🇯🇵 {ar ? "اليابان" : "Japan"}</SelectItem>
              <SelectItem value="sa">🇸🇦 {ar ? "الخليج" : "Gulf"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && <div className="text-center text-muted-foreground py-12">{ar ? "جاري التحميل..." : "Loading..."}</div>}

        {!loading && Object.keys(grouped).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">{ar ? "لا توجد أحداث مطابقة." : "No matching events."}</Card>
        )}

        {Object.entries(grouped).map(([date, items]) => (
          <Card key={date} className="overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">{date}</div>
            <div className="divide-y divide-border">
              {items.map((e, i) => {
                const related = relatedAssets(e);
                return (
                  <div key={i} className="flex flex-wrap items-start gap-3 p-4 hover:bg-muted/20">
                    <div className="text-xs font-mono text-muted-foreground w-14 pt-1">{e.time}</div>
                    <div className="text-2xl">{e.flag}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        <span className="truncate">{e.event}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs leading-relaxed">
                            {explainImpact(e, ar ? "ar" : "en")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-xs text-muted-foreground">{e.country}</div>
                      <div className="text-xs text-muted-foreground/90 mt-1 leading-relaxed">
                        {explainImpact(e, ar ? "ar" : "en")}
                      </div>
                      {related.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground me-1">
                            {ar ? "الأصول المتأثرة:" : "Affected assets:"}
                          </span>
                          {related.map((r) => (
                            <Link
                              key={r.category + r.symbol}
                              to="/market-intelligence"
                              search={{ category: r.category, symbol: r.symbol, auto: true }}
                              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                            >
                              {r.label}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={impactColor(e.impact)}>
                      {e.impact === "high" && <AlertTriangle className="h-3 w-3 me-1" />}
                      {impactLabel(e.impact)}
                    </Badge>
                    <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground w-32 pt-1">
                      {e.forecast && <span><TrendingUp className="h-3 w-3 inline" /> {ar ? "متوقع" : "Forecast"}: {e.forecast}</span>}
                      {e.previous && <span>{ar ? "سابق" : "Prev"}: {e.previous}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
