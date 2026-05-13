import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, TrendingUp, TrendingDown, Target } from "lucide-react";
import { getMarketData, calcRSI } from "@/lib/market-data";
import { getStocksData } from "@/lib/stocks-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/scanner")({ component: ScannerPage });

interface Row {
  symbol: string; name: string; category: string;
  price: number; changePct: number; rsi: number | null; score: number;
}

function ScannerPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: "all",
    minChange: -50,
    maxChange: 50,
    rsiMax: 100,
    rsiMin: 0,
    search: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([getMarketData(), getStocksData()]);
        const all: Row[] = [];
        for (const a of m.assets) {
          const prices = a.history.map((h) => h.p);
          const rsi = calcRSI(prices);
          const score = computeScore(a.changePct, rsi);
          all.push({ symbol: a.symbol, name: a.name, category: a.category, price: a.price, changePct: a.changePct, rsi, score });
        }
        for (const a of s.stocks) {
          const rsi = calcRSI(a.history);
          const score = computeScore(a.changePct, rsi);
          all.push({ symbol: a.symbol, name: a.name, category: "stocks-" + a.region, price: a.price, changePct: a.changePct, rsi, score });
        }
        setRows(all.sort((x, y) => y.score - x.score));
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filters.category !== "all" && !r.category.startsWith(filters.category)) return false;
    if (r.changePct < filters.minChange || r.changePct > filters.maxChange) return false;
    if (r.rsi !== null && (r.rsi < filters.rsiMin || r.rsi > filters.rsiMax)) return false;
    if (filters.search && !r.symbol.toLowerCase().includes(filters.search.toLowerCase()) && !r.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  }), [rows, filters]);

  const addToWatchlist = async (r: Row) => {
    if (!user) return;
    const { error } = await supabase.from("watchlist_items").insert({
      user_id: user.id, symbol: r.symbol, asset_name: r.name, category: r.category,
    });
    if (error) toast.error(error.message);
    else toast.success(lang === "ar" ? "أُضيف إلى المتابعة" : "Added to watchlist");
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Search className="h-7 w-7 text-primary" /> {lang === "ar" ? "سكانر الفرص" : "Opportunity Scanner"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar" ? "افحص آلاف الأصول بمعايير قابلة للتخصيص واكتشف الفرص الأفضل." : "Scan assets with custom filters to find top opportunities."}
        </p>
      </header>

      <Card className="p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "بحث" : "Search"}</label>
          <Input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="BTC, AAPL..." />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الفئة" : "Category"}</label>
          <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "الكل" : "All"}</SelectItem>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="stocks">Stocks</SelectItem>
              <SelectItem value="metals">Metals</SelectItem>
              <SelectItem value="oil">Oil</SelectItem>
              <SelectItem value="currencies">FX</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "تغير %" : "Change %"} ({filters.minChange} → {filters.maxChange})</label>
          <Slider value={[filters.minChange, filters.maxChange]} min={-30} max={30} step={1}
            onValueChange={(v) => setFilters({ ...filters, minChange: v[0], maxChange: v[1] })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">RSI ({filters.rsiMin} → {filters.rsiMax})</label>
          <Slider value={[filters.rsiMin, filters.rsiMax]} min={0} max={100} step={1}
            onValueChange={(v) => setFilters({ ...filters, rsiMin: v[0], rsiMax: v[1] })} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="p-3 text-start">{lang === "ar" ? "الرمز" : "Symbol"}</th>
                <th className="p-3 text-start">{lang === "ar" ? "الاسم" : "Name"}</th>
                <th className="p-3 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
                <th className="p-3 text-end">{lang === "ar" ? "التغير" : "Change"}</th>
                <th className="p-3 text-end">RSI</th>
                <th className="p-3 text-end">{lang === "ar" ? "النقاط" : "Score"}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</td></tr>}
              {!loading && filtered.slice(0, 100).map((r) => {
                const up = r.changePct >= 0;
                return (
                  <tr key={r.symbol + r.category} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-semibold">{r.symbol}</td>
                    <td className="p-3 text-muted-foreground">{r.name}</td>
                    <td className="p-3 text-end">{r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className={"p-3 text-end font-medium " + (up ? "text-emerald-500" : "text-rose-500")}>
                      <span className="inline-flex items-center gap-1">
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {r.changePct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-3 text-end">{r.rsi?.toFixed(0) ?? "-"}</td>
                    <td className="p-3 text-end">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary font-semibold">
                        <Target className="h-3 w-3" /> {r.score.toFixed(0)}
                      </span>
                    </td>
                    <td className="p-3 text-end">
                      <Button size="sm" variant="outline" onClick={() => addToWatchlist(r)} className="gap-1">
                        <Plus className="h-3 w-3" /> {lang === "ar" ? "متابعة" : "Watch"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{lang === "ar" ? "لا نتائج" : "No results"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function computeScore(changePct: number, rsi: number | null): number {
  // Higher score = better opportunity. Reward oversold + positive momentum.
  let s = 50;
  if (rsi !== null) {
    if (rsi < 30) s += 25;
    else if (rsi < 45) s += 12;
    else if (rsi > 70) s -= 20;
  }
  s += Math.max(-15, Math.min(25, changePct * 1.5));
  return Math.max(0, Math.min(100, s));
}
