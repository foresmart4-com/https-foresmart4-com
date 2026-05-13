import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, AlertTriangle, TrendingUp } from "lucide-react";
import { getEconomicEvents } from "@/lib/economic-calendar.functions";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

interface EvtItem {
  date: string; time: string; country: string; flag: string;
  event: string; impact: "low" | "medium" | "high"; previous?: string; forecast?: string;
}

function CalendarPage() {
  const { lang } = useI18n();
  const [events, setEvents] = useState<EvtItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getEconomicEvents();
        setEvents(data.events as EvtItem[]);
      } finally { setLoading(false); }
    })();
  }, []);

  const grouped = events.reduce<Record<string, EvtItem[]>>((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e); return acc;
  }, {});

  const impactColor = (i: string) =>
    i === "high" ? "bg-rose-500/20 text-rose-400 border-rose-500/40" :
    i === "medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/40" :
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> {lang === "ar" ? "التقويم الاقتصادي" : "Economic Calendar"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar" ? "أهم الأحداث الاقتصادية والمؤشرات التي تحرك الأسواق هذا الأسبوع." : "Key economic events and indicators moving markets this week."}
        </p>
      </header>

      {loading && <div className="text-center text-muted-foreground py-12">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>}

      {Object.entries(grouped).map(([date, items]) => (
        <Card key={date} className="overflow-hidden">
          <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">{date}</div>
          <div className="divide-y divide-border">
            {items.map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-4 hover:bg-muted/20">
                <div className="text-xs font-mono text-muted-foreground w-14">{e.time}</div>
                <div className="text-2xl">{e.flag}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.event}</div>
                  <div className="text-xs text-muted-foreground">{e.country}</div>
                </div>
                <Badge variant="outline" className={impactColor(e.impact)}>
                  {e.impact === "high" && <AlertTriangle className="h-3 w-3 me-1" />}
                  {e.impact}
                </Badge>
                <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground w-32">
                  {e.forecast && <span><TrendingUp className="h-3 w-3 inline" /> {lang === "ar" ? "متوقع" : "Forecast"}: {e.forecast}</span>}
                  {e.previous && <span>{lang === "ar" ? "سابق" : "Prev"}: {e.previous}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
