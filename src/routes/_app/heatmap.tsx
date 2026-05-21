import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Flame, TrendingUp, TrendingDown, Plus, Bell, BarChart3, RefreshCw, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMarketData } from "@/lib/market-data";
import { getStocksData } from "@/lib/stocks-data";
import { getUniversalQuoteBatch } from "@/lib/universal-quote.functions";
import { ASSET_PICKER } from "@/lib/asset-picker";
import { AddToWatchlistDialog } from "@/components/pickers/AddToWatchlistDialog";
import { CreateAlertDialog } from "@/components/pickers/CreateAlertDialog";
import type { PickedAsset } from "@/components/pickers/AssetPickerDialog";

export const Route = createFileRoute("/_app/heatmap")({
  component: HeatmapPage,
  head: () => ({
    meta: [
      { title: "Market Heatmap — ForeSmart" },
      { name: "description", content: "Visual heatmap across crypto, stocks, metals, commodities, ETFs/bonds & FX with conviction tiers." },
    ],
  }),
});

type Group = "crypto" | "metals" | "currencies" | "stocks-us" | "stocks-saudi" | "commodity" | "etf_bond";
interface Cell {
  symbol: string; name: string; group: Group;
  price: number; changePct: number; weight: number;
  source?: string; mode?: "live" | "delayed" | "manual" | "mock";
  updatedAt?: number;
}

const GROUP_LABEL: Record<Group, { ar: string; en: string }> = {
  crypto:         { ar: "العملات الرقمية", en: "Crypto" },
  metals:         { ar: "المعادن",         en: "Metals" },
  currencies:     { ar: "العملات",         en: "Currencies" },
  "stocks-us":    { ar: "أسهم أمريكية",    en: "US Stocks" },
  "stocks-saudi": { ar: "أسهم سعودية",     en: "Saudi Stocks" },
  commodity:      { ar: "السلع",           en: "Commodities" },
  etf_bond:       { ar: "صناديق وسندات",   en: "ETFs & Bonds" },
};

function toPicked(c: Cell): PickedAsset {
  if (c.group === "crypto")        return { symbol: c.symbol, name: c.name, asset_type: "CRYPTO",      market: "Crypto",       category: "crypto" };
  if (c.group === "metals")        return { symbol: c.symbol, name: c.name, asset_type: "METAL",       market: "Metals",       category: "metal" };
  if (c.group === "currencies")    return { symbol: c.symbol, name: c.name, asset_type: "COMMODITY",   market: "FX",           category: "commodity" };
  if (c.group === "stocks-saudi")  return { symbol: c.symbol, name: c.name, asset_type: "SAUDI_STOCK", market: "Tadawul",      category: "sa_stock" };
  if (c.group === "commodity")     return { symbol: c.symbol, name: c.name, asset_type: "COMMODITY",   market: "Commodities",  category: "commodity" };
  if (c.group === "etf_bond")      return { symbol: c.symbol, name: c.name, asset_type: "US_STOCK",    market: "US",           category: "etf_bond" };
  return                                  { symbol: c.symbol, name: c.name, asset_type: "US_STOCK",   market: "US",            category: "us_stock" };
}

function HeatmapPage() {
  const { lang } = useI18n();
  const [cells, setCells] = useState<Cell[]>([]);
  const [group, setGroup] = useState<"all" | Group>("all");
  const [filter, setFilter] = useState<"all" | "gainers" | "losers" | "strong">("all");
  const [size, setSize] = useState<"compact" | "regular" | "large">("regular");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<PickedAsset | null>(null);
  const [openWatch, setOpenWatch] = useState(false);
  const [openAlert, setOpenAlert] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      // Compose extras from asset-picker for commodities + ETFs/Bonds (subset to limit batch <=40).
      const extras = [
        ...ASSET_PICKER.commodity.slice(0, 7).map((a) => ({ category: "commodity" as const, symbol: a.symbol, name: a.name })),
        ...ASSET_PICKER.etf_bond.slice(0, 12).map((a) => ({ category: "etf_bond" as const, symbol: a.symbol, name: a.name })),
      ];
      const [m, s, batch] = await Promise.all([
        getMarketData(),
        getStocksData(),
        getUniversalQuoteBatch({ data: { items: extras } }).catch(() => [] as any[]),
      ]);
      const arr: Cell[] = [];
      m.assets.forEach((a) => arr.push({
        symbol: a.symbol, name: a.name,
        group: (a.category === "metals" ? "metals" : a.category === "currencies" ? "currencies" : "crypto") as Group,
        price: a.price, changePct: a.changePct,
        weight: Math.max(1, Math.log(a.volume || 1)),
        source: "Live", mode: "live", updatedAt: Date.now(),
      }));
      s.stocks.forEach((a) => arr.push({
        symbol: a.symbol, name: a.name,
        group: (a.region === "saudi" ? "stocks-saudi" : "stocks-us") as Group,
        price: a.price, changePct: a.changePct, weight: 1,
        source: "Yahoo", mode: "live", updatedAt: Date.now(),
      }));
      (batch as Array<{ symbol: string; name: string; category: string; price: number; changePct: number; source: string; mode: "live" | "delayed" | "manual" | "mock"; fetchedAt: number }>).forEach((q) => {
        if (!q.price) return;
        arr.push({
          symbol: q.symbol, name: q.name,
          group: (q.category === "etf_bond" ? "etf_bond" : "commodity") as Group,
          price: q.price, changePct: q.changePct, weight: 1,
          source: q.source, mode: q.mode, updatedAt: q.fetchedAt,
        });
      });
      setCells(arr);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let out = group === "all" ? cells : cells.filter((c) => c.group === group);
    if (filter === "gainers") out = out.filter((c) => c.changePct > 0);
    else if (filter === "losers") out = out.filter((c) => c.changePct < 0);
    else if (filter === "strong") out = out.filter((c) => Math.abs(c.changePct) >= 2);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    return out.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [cells, group, filter, search]);

  const stats = useMemo(() => {
    const up = filtered.filter((c) => c.changePct > 0).length;
    const down = filtered.filter((c) => c.changePct < 0).length;
    const avg = filtered.length ? filtered.reduce((s, c) => s + c.changePct, 0) / filtered.length : 0;
    return { up, down, total: filtered.length, avg };
  }, [filtered]);

  const sizeClass = size === "compact"
    ? "grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12"
    : size === "large"
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      : "grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8";

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Flame className="h-7 w-7 text-primary" /> {lang === "ar" ? "خريطة السوق الحرارية" : "Market Heatmap"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar"
              ? "نظرة بصرية فورية على أداء جميع الأصول مع إمكانية الإضافة للمراقبة وإنشاء التنبيهات."
              : "Live visual snapshot across asset classes — click any tile to add to watchlist, set an alert, or open intelligence."}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40"
          disabled={refreshing}
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "أصول مرتفعة" : "Up"}</div><div className="text-2xl font-bold text-success">{stats.up}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "أصول هابطة" : "Down"}</div><div className="text-2xl font-bold text-danger">{stats.down}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "إجمالي" : "Total"}</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{lang === "ar" ? "متوسط التغير" : "Avg change"}</div><div className={"text-2xl font-bold " + (stats.avg >= 0 ? "text-success" : "text-danger")}>{stats.avg >= 0 ? "+" : ""}{stats.avg.toFixed(2)}%</div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={group} onValueChange={(v) => setGroup(v as any)}>
          <TabsList>
            <TabsTrigger value="all">{lang === "ar" ? "الكل" : "All"}</TabsTrigger>
            {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
              <TabsTrigger key={g} value={g}>{lang === "ar" ? GROUP_LABEL[g].ar : GROUP_LABEL[g].en}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث رمز/اسم..." : "Search symbol/name..."}
              className="h-9 w-44 ps-7 text-xs"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل التغيرات" : "All moves"}</SelectItem>
              <SelectItem value="gainers">{lang === "ar" ? "المرتفعون فقط" : "Gainers only"}</SelectItem>
              <SelectItem value="losers">{lang === "ar" ? "الهابطون فقط" : "Losers only"}</SelectItem>
              <SelectItem value="strong">{lang === "ar" ? "حركة قوية (≥٢٪)" : "Strong moves (≥2%)"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={(v) => setSize(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">{lang === "ar" ? "مضغوط" : "Compact"}</SelectItem>
              <SelectItem value="regular">{lang === "ar" ? "عادي" : "Regular"}</SelectItem>
              <SelectItem value="large">{lang === "ar" ? "كبير" : "Large"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-3">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">{lang === "ar" ? "لا توجد أصول تطابق الفلتر." : "No assets match this filter."}</div>
        ) : (
          <div className={"grid gap-1.5 " + sizeClass}>
            {filtered.map((c) => {
              const pct = c.changePct;
              const abs = Math.abs(pct);
              // conviction tiers: weak <1, mod 1-3, strong 3-6, extreme >6
              const intensity = abs >= 6 ? 1 : abs >= 3 ? 0.8 : abs >= 1 ? 0.55 : 0.3;
              const hue = pct >= 0 ? 150 : 25;
              const bg = `oklch(0.55 ${0.12 + intensity * 0.12} ${hue} / ${0.35 + intensity * 0.55})`;
              const tier = abs >= 6 ? "★★★" : abs >= 3 ? "★★" : abs >= 1 ? "★" : "";
              return (
                <DropdownMenu key={c.symbol + c.group}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg p-2.5 text-white text-start transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
                      style={{ background: bg, minHeight: size === "large" ? 90 : 70 }}
                      title={`${c.name} • ${c.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm truncate">{c.symbol}</div>
                        {tier && <span className="text-[10px] opacity-80">{tier}</span>}
                      </div>
                      <div className="text-xs font-semibold flex items-center gap-1">
                        {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                      </div>
                      <div className="text-[10px] opacity-80 truncate">{c.name}</div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to="/market-intelligence">
                        <BarChart3 className="h-4 w-4 me-2" />
                        {lang === "ar" ? "فتح في ذكاء السوق" : "Open in Market Intelligence"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setPicked(toPicked(c)); setOpenWatch(true); }}>
                      <Plus className="h-4 w-4 me-2" />
                      {lang === "ar" ? "إضافة لقائمة المراقبة" : "Add to watchlist"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setPicked(toPicked(c)); setOpenAlert(true); }}>
                      <Bell className="h-4 w-4 me-2" />
                      {lang === "ar" ? "إنشاء تنبيه" : "Create alert"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>{lang === "ar" ? "الأخضر = صعود، الأحمر = هبوط" : "Green = up, Red = down"}</span>
        <span>★ ≥1% • ★★ ≥3% • ★★★ ≥6%</span>
        <span>{lang === "ar" ? "اضغط أي خلية لقائمة الإجراءات" : "Click any tile for actions"}</span>
      </div>

      <AddToWatchlistDialog open={openWatch} onOpenChange={setOpenWatch} prefilled={picked} />
      <CreateAlertDialog open={openAlert} onOpenChange={setOpenAlert} prefilled={picked} />
    </div>
  );
}
