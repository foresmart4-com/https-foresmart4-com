import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame } from "lucide-react";
import { getMarketData } from "@/lib/market-data";
import { getStocksData } from "@/lib/stocks-data";

export const Route = createFileRoute("/_app/heatmap")({
  component: HeatmapPage,
  head: () => ({
    meta: [
      { title: "Market Heatmap — ForeSmart" },
      { name: "description", content: "Visual heatmap of asset performance across global markets." },
    ],
  }),
});

interface Cell { symbol: string; name: string; group: string; price: number; changePct: number; weight: number; }

function HeatmapPage() {
  const { lang } = useI18n();
  const [cells, setCells] = useState<Cell[]>([]);
  const [group, setGroup] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([getMarketData(), getStocksData()]);
        const arr: Cell[] = [];
        m.assets.forEach((a) => arr.push({
          symbol: a.symbol, name: a.name, group: a.category,
          price: a.price, changePct: a.changePct, weight: Math.max(1, Math.log(a.volume || 1)),
        }));
        s.stocks.forEach((a) => arr.push({
          symbol: a.symbol, name: a.name, group: "stocks-" + a.region,
          price: a.price, changePct: a.changePct, weight: 1,
        }));
        setCells(arr);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(
    () => cells.filter((c) => group === "all" || c.group.startsWith(group)),
    [cells, group],
  );

  const groups = useMemo(() => {
    const g = new Set(cells.map((c) => c.group.split("-")[0]));
    return Array.from(g);
  }, [cells]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Flame className="h-7 w-7 text-primary" /> {lang === "ar" ? "خريطة السوق الحرارية" : "Market Heatmap"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar" ? "نظرة بصرية فورية على أداء جميع الأصول." : "Visual snapshot of every asset's performance."}
          </p>
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "ar" ? "كل الأسواق" : "All markets"}</SelectItem>
            {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <Card className="p-3">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
            {filtered.map((c) => {
              const pct = c.changePct;
              const intensity = Math.min(1, Math.abs(pct) / 6);
              const bg = pct >= 0
                ? `oklch(0.55 ${0.15 + intensity * 0.1} 150 / ${0.4 + intensity * 0.6})`
                : `oklch(0.55 ${0.15 + intensity * 0.1} 25 / ${0.4 + intensity * 0.6})`;
              return (
                <div
                  key={c.symbol + c.group}
                  className="rounded-lg p-2.5 text-white transition-transform hover:scale-105 hover:z-10 cursor-default"
                  style={{ background: bg, minHeight: 70 }}
                  title={`${c.name} • $${c.price}`}
                >
                  <div className="font-bold text-sm truncate">{c.symbol}</div>
                  <div className={"text-xs font-semibold " + (pct >= 0 ? "" : "")}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] opacity-80 truncate">{c.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{lang === "ar" ? "الأخضر = صعود، الأحمر = هبوط، شدة اللون = حجم التغير" : "Green = up, Red = down, intensity = magnitude"}</span>
      </div>
    </div>
  );
}
