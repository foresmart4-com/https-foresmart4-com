import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarDays, AlertTriangle, TrendingUp, Info } from "lucide-react";
import { getEconomicEvents } from "@/lib/economic-calendar.functions";

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

// Heuristic Arabic/English explanation of what each indicator means for markets.
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

const REGION_MAP: Record<string, string> = {
  "United States": "us", "Euro Area": "eu", "Germany": "eu", "United Kingdom": "uk",
  "China": "cn", "Japan": "jp", "Saudi Arabia": "sa", "United Arab Emirates": "sa",
};

function CalendarPage() {
  const { lang } = useI18n();
  const [events, setEvents] = useState<EvtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [impactFilter, setImpactFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [region, setRegion] = useState<string>("all");
  const [range, setRange] = useState<"all" | "today" | "week">("all");
  const [source, setSource] = useState<string>("");
  const [mode, setMode] = useState<"live" | "delayed" | "mock">("mock");

  useEffect(() => {
    (async () => {
      try {
        const data = await getEconomicEvents();
        setEvents(data.events as EvtItem[]);
        setSource(data.source || "");
        setMode((data.mode as "live" | "delayed" | "mock") || "mock");
      } finally { setLoading(false); }
    })();
  }, []);

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
    lang === "ar"
      ? i === "high" ? "تأثير قوي" : i === "medium" ? "تأثير متوسط" : "تأثير ضعيف"
      : i;

  return (
    <TooltipProvider>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <header>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" /> {lang === "ar" ? "التقويم الاقتصادي" : "Economic Calendar"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "أهم الأحداث الاقتصادية والمؤشرات التي تحرك الأسواق — مع شرح فوري لتأثير كل حدث."
              : "Key macro events and indicators moving markets — with instant impact explanations."}
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "تأثير قوي" : "High impact"}</div><div className="text-2xl font-bold text-rose-400">{counts.high}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "تأثير متوسط" : "Medium"}</div><div className="text-2xl font-bold text-amber-400">{counts.medium}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "تأثير ضعيف" : "Low"}</div><div className="text-2xl font-bold text-emerald-400">{counts.low}</div></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={impactFilter} onValueChange={(v) => setImpactFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل التأثيرات" : "All impact"}</SelectItem>
              <SelectItem value="high">{lang === "ar" ? "قوي فقط" : "High only"}</SelectItem>
              <SelectItem value="medium">{lang === "ar" ? "متوسط فقط" : "Medium only"}</SelectItem>
              <SelectItem value="low">{lang === "ar" ? "ضعيف فقط" : "Low only"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل المناطق" : "All regions"}</SelectItem>
              <SelectItem value="us">🇺🇸 {lang === "ar" ? "أمريكا" : "US"}</SelectItem>
              <SelectItem value="eu">🇪🇺 {lang === "ar" ? "أوروبا" : "Europe"}</SelectItem>
              <SelectItem value="uk">🇬🇧 {lang === "ar" ? "بريطانيا" : "UK"}</SelectItem>
              <SelectItem value="cn">🇨🇳 {lang === "ar" ? "الصين" : "China"}</SelectItem>
              <SelectItem value="jp">🇯🇵 {lang === "ar" ? "اليابان" : "Japan"}</SelectItem>
              <SelectItem value="sa">🇸🇦 {lang === "ar" ? "الخليج" : "Gulf"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && <div className="text-center text-muted-foreground py-12">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>}

        {!loading && Object.keys(grouped).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">{lang === "ar" ? "لا توجد أحداث مطابقة." : "No matching events."}</Card>
        )}

        {Object.entries(grouped).map(([date, items]) => (
          <Card key={date} className="overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">{date}</div>
            <div className="divide-y divide-border">
              {items.map((e, i) => (
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
                          {explainImpact(e, lang as "ar" | "en")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-xs text-muted-foreground">{e.country}</div>
                    <div className="text-xs text-muted-foreground/90 mt-1 leading-relaxed">
                      {explainImpact(e, lang as "ar" | "en")}
                    </div>
                  </div>
                  <Badge variant="outline" className={impactColor(e.impact)}>
                    {e.impact === "high" && <AlertTriangle className="h-3 w-3 me-1" />}
                    {impactLabel(e.impact)}
                  </Badge>
                  <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground w-32 pt-1">
                    {e.forecast && <span><TrendingUp className="h-3 w-3 inline" /> {lang === "ar" ? "متوقع" : "Forecast"}: {e.forecast}</span>}
                    {e.previous && <span>{lang === "ar" ? "سابق" : "Prev"}: {e.previous}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
