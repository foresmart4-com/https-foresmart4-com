import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getMarketData, deriveSignal, type AssetQuote } from "@/lib/market-data";
import { getStocksData, REGION_LABELS, type StockQuote, type StockRegion } from "@/lib/stocks-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AssetAnalysisDialog } from "@/components/AssetAnalysisDialog";
import { BuyAssetDialog } from "@/components/BuyAssetDialog";
import {
  Building2, Coins, DollarSign, Brain, Gem, ShoppingCart,
  Landmark, ExternalLink, TrendingUp, TrendingDown,
} from "lucide-react";
import { TREASURY_DIRECT_LINKS } from "@/lib/bond-links";
import { FeaturedAssetsTable } from "@/components/FeaturedAssetsTable";
import { CryptoLivePanel } from "@/components/CryptoLivePanel";
import { AIDecisionPanel } from "@/components/AIDecisionPanel";
import { featuredAssets } from "@/lib/mock-data";

interface SelectedAsset {
  symbol: string;
  name?: string;
  category: string;
  price: number;
  changePct: number;
  high24h?: number;
  low24h?: number;
  market?: string;
  currency?: string;
}

export const Route = createFileRoute("/_app/markets")({
  component: MarketsPage,
  head: () => ({
    meta: [
      { title: "Markets — ForeSmart" },
      { name: "description", content: "Live global markets: stocks, crypto, FX, commodities and macro signals." },
    ],
  }),
});

const REGION_ORDER: StockRegion[] = ["us", "eu", "uk", "japan", "china", "uae", "saudi", "qatar"];

const SIGNAL_CLS: Record<string, string> = {
  buy:  "bg-success/15 text-success",
  sell: "bg-danger/15 text-danger",
  hold: "bg-warning/15 text-warning",
};

function MarketsPage() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<"stocks" | "crypto" | "metals" | "fx" | "bonds">("stocks");
  const [selected, setSelected] = useState<SelectedAsset | null>(null);
  const [open, setOpen] = useState(false);
  const [buyTarget, setBuyTarget] = useState<SelectedAsset | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const analyze = (a: SelectedAsset) => { setSelected(a); setOpen(true); };
  const buy = (a: SelectedAsset) => { setBuyTarget(a); setBuyOpen(true); };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">

      {/* Page hero */}
      <MarketHubHero lang={lang} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stocks" className="gap-1.5">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{lang === "ar" ? "الأسواق" : "Stocks"}</span>
          </TabsTrigger>
          <TabsTrigger value="crypto" className="gap-1.5">
            <Coins className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{lang === "ar" ? "كريبتو" : "Crypto"}</span>
          </TabsTrigger>
          <TabsTrigger value="bonds" className="gap-1.5">
            <Landmark className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{lang === "ar" ? "السندات" : "Bonds"}</span>
          </TabsTrigger>
          <TabsTrigger value="metals" className="gap-1.5">
            <Gem className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{lang === "ar" ? "معادن" : "Metals"}</span>
          </TabsTrigger>
          <TabsTrigger value="fx" className="gap-1.5">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{lang === "ar" ? "عملات" : "Forex"}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stocks" className="mt-6 space-y-6">
          <FeaturedAssetsTable />
          <AIDecisionPanel />
          <StocksTab onAnalyze={analyze} onBuy={buy} />
        </TabsContent>

        <TabsContent value="crypto" className="mt-6 space-y-6">
          <CryptoLivePanel />
          <AssetsTab category="crypto" onAnalyze={analyze} onBuy={buy} />
        </TabsContent>

        <TabsContent value="bonds" className="mt-6 space-y-6">
          <BondsExternalLinks />
          <AssetsTab category="bonds" onAnalyze={analyze} onBuy={buy} />
        </TabsContent>

        <TabsContent value="metals" className="mt-6 space-y-6">
          <AssetsTab category="metals" onAnalyze={analyze} onBuy={buy} />
        </TabsContent>

        <TabsContent value="fx" className="mt-6 space-y-6">
          <AssetsTab category="currencies" onAnalyze={analyze} onBuy={buy} />
        </TabsContent>
      </Tabs>

      <AssetAnalysisDialog open={open} onOpenChange={setOpen} asset={selected} />
      <BuyAssetDialog open={buyOpen} onOpenChange={setBuyOpen} asset={buyTarget} />
    </div>
  );
}

/* ─── Market Hub Hero ───────────────────────────────────────────────────────── */

function MarketHubHero({ lang }: { lang: string }) {
  const ar = lang === "ar";
  return (
    <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
      <div className="gradient-hero absolute inset-0 pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                <span className="text-gradient">{ar ? "مركز الأسواق" : "Market Hub"}</span>
              </h1>
              <Badge className="border-success/30 bg-success/20 text-[10px] font-bold text-success">
                <span className="me-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                {ar ? "مباشر" : "Live"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {ar
                ? "أسواق عالمية · تحليل AI · إشارات مباشرة"
                : "Global markets · AI analysis · Live signals"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {featuredAssets.slice(0, 6).map((a) => (
            <div
              key={a.symbol}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm"
            >
              <div>
                <div className="text-xs font-bold leading-tight">{a.symbol}</div>
                <div className="tabular-nums text-[10px] text-muted-foreground">
                  {a.price.toLocaleString()} {a.currency}
                </div>
              </div>
              <div className={cn(
                "flex items-center gap-0.5 text-xs font-semibold",
                a.change >= 0 ? "text-success" : "text-danger",
              )}>
                {a.change >= 0
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />}
                {a.change >= 0 ? "+" : ""}{a.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">{ar ? "تلميح:" : "Tip:"}</span>{" "}
          {ar
            ? "انقر على «تحليل ذكي» بجانب أي أصل للحصول على توصية AI مباشرة."
            : "Tap \"Analyze\" next to any asset for an instant AI buy/sell verdict."}
        </p>
      </div>
    </div>
  );
}

/* ─── Bonds external links ──────────────────────────────────────────────────── */

function BondsExternalLinks() {
  const { lang } = useI18n();
  return (
    <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
      <h2 className="mb-1 font-display text-lg font-semibold">
        {lang === "ar" ? "شراء السندات الأمريكية مباشرة" : "Buy US Bonds directly"}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {lang === "ar"
          ? "روابط رسمية لشراء السندات من المُصدر أو وسطاء معتمدين."
          : "Official links to buy bonds from issuer or licensed brokers."}
      </p>
      <div className="flex flex-wrap gap-2">
        {TREASURY_DIRECT_LINKS.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {l.label}
          </a>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {lang === "ar"
          ? "بعد الشراء يمكنك إضافة الأصل لقائمة المراقبة لمتابعته داخل البرنامج."
          : "After purchase, add the asset to your watchlist to track it inside the app."}
      </p>
    </section>
  );
}

/* ─── Stocks tab ────────────────────────────────────────────────────────────── */

function StocksTab({
  onAnalyze,
  onBuy,
}: {
  onAnalyze: (a: SelectedAsset) => void;
  onBuy: (a: SelectedAsset) => void;
}) {
  const { lang } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: () => getStocksData(),
    refetchInterval: 120000,
  });
  const [selectedRegions, setSelectedRegions] = useState<StockRegion[]>([...REGION_ORDER]);
  const [query, setQuery] = useState("");
  const stocks = data?.stocks ?? [];
  const toggle = (r: StockRegion) =>
    setSelectedRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  const allOn = selectedRegions.length === REGION_ORDER.length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-2 h-3 w-16 rounded bg-muted/40" />
            <div className="h-5 w-24 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const total = stocks.length;

  return (
    <>
      <div className="rounded-xl gradient-card border border-border p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {lang === "ar" ? "الأسواق العالمية" : "Global Markets"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {lang === "ar"
                ? `${total.toLocaleString()} شركة من أكبر البورصات العالمية`
                : `${total.toLocaleString()} listed companies across major exchanges`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "ar" ? "بحث برمز أو اسم..." : "Search ticker or name..."}
              className="h-8 w-40 text-xs sm:w-56"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setSelectedRegions(allOn ? [] : [...REGION_ORDER])}
            >
              {allOn
                ? (lang === "ar" ? "إلغاء الكل" : "Clear all")
                : (lang === "ar" ? "تحديد الكل" : "Select all")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {REGION_ORDER.map((r) => {
            const meta = REGION_LABELS[r];
            const on = selectedRegions.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggle(r)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  on
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                <span>{meta.flag}</span>
                <span>{meta[lang]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedRegions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {lang === "ar" ? "اختر سوقاً واحداً على الأقل لعرض الأسهم" : "Select at least one market"}
        </p>
      )}

      {REGION_ORDER.filter((r) => selectedRegions.includes(r)).map((r) => {
        const items = stocks.filter((s) => {
          if (s.region !== r) return false;
          if (!q) return true;
          return (
            s.symbol.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.sector.toLowerCase().includes(q)
          );
        });
        if (items.length === 0) return null;
        return <RegionSection key={r} region={r} items={items} onAnalyze={onAnalyze} onBuy={onBuy} />;
      })}
    </>
  );
}

/* ─── Region section ────────────────────────────────────────────────────────── */

function RegionSection({
  region,
  items,
  onAnalyze,
  onBuy,
}: {
  region: StockRegion;
  items: StockQuote[];
  onAnalyze: (a: SelectedAsset) => void;
  onBuy: (a: SelectedAsset) => void;
}) {
  const { t, lang } = useI18n();
  const meta = REGION_LABELS[region];
  const [visible, setVisible] = useState(30);
  const shown = items.slice(0, visible);

  const { avg, gainers, losers, buys, sells, holds } = useMemo(() => {
    const sigs = items.map((s) => deriveSignal(s.history).signal);
    return {
      avg: items.reduce((s, a) => s + a.changePct, 0) / items.length,
      gainers: items.filter((a) => a.changePct > 0).length,
      losers: items.filter((a) => a.changePct < 0).length,
      buys: sigs.filter((s) => s === "buy").length,
      sells: sigs.filter((s) => s === "sell").length,
      holds: sigs.filter((s) => s === "hold").length,
    };
  }, [items]);

  const ar = lang === "ar";

  return (
    <section className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.flag}</span>
          <div>
            <h2 className="font-display text-base font-semibold sm:text-xl">{meta[lang]}</h2>
            <p className="text-xs text-muted-foreground">
              {items.length} {ar ? "شركة" : "companies"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("font-semibold", avg >= 0 ? "text-success" : "text-danger")}>
            {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
          </span>
          <span className="text-success">▲ {gainers}</span>
          <span className="text-danger">▼ {losers}</span>
          <div className="ms-1 flex items-center gap-1">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-success/15 text-success">
              {buys} {ar ? "شراء" : "Buy"}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-warning/15 text-warning">
              {holds} {ar ? "انتظار" : "Hold"}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-danger/15 text-danger">
              {sells} {ar ? "بيع" : "Sell"}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile: card list */}
      <div className="divide-y divide-border/50 sm:hidden">
        {shown.map((s) => {
          const sig = deriveSignal(s.history);
          return (
            <div key={s.symbol} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.symbol}</div>
              </div>
              <div className="shrink-0 text-end">
                <div className="text-sm font-medium">
                  {s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className={cn("text-xs font-semibold", s.changePct >= 0 ? "text-success" : "text-danger")}>
                  {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                </div>
              </div>
              <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold", SIGNAL_CLS[sig.signal])}>
                {t(sig.signal)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => onAnalyze({
                  symbol: s.symbol, name: s.name,
                  category: `stock-${s.sector ?? ""}`,
                  price: s.price, changePct: s.changePct,
                })}
              >
                <Brain className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{ar ? "الشركة" : "Company"}</th>
              <th className="px-4 py-3 text-start">{ar ? "القطاع" : "Sector"}</th>
              <th className="px-4 py-3 text-end">{t("price")}</th>
              <th className="px-4 py-3 text-end">{t("change")}</th>
              <th className="px-4 py-3 text-end">{ar ? "التوصية" : "Signal"}</th>
              <th className="px-4 py-3 text-end">{ar ? "تحليل ذكي" : "AI"}</th>
              <th className="px-4 py-3 text-end">{ar ? "محاكاة" : "Simulate"}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const sig = deriveSignal(s.history);
              return (
                <tr key={s.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.symbol}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.sector}</td>
                  <td className="px-4 py-3 text-end font-medium">
                    {s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    <span className="text-xs text-muted-foreground">{s.currency}</span>
                  </td>
                  <td className={cn("px-4 py-3 text-end font-medium", s.changePct >= 0 ? "text-success" : "text-danger")}>
                    {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-end">
                    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", SIGNAL_CLS[sig.signal])}>
                      {t(sig.signal)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onAnalyze({
                        symbol: s.symbol, name: s.name,
                        category: `stock-${s.sector ?? ""}`,
                        price: s.price, changePct: s.changePct,
                      })}
                    >
                      <Brain className="me-1 h-3.5 w-3.5" />{ar ? "تحليل" : "Analyze"}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onBuy({
                        symbol: s.symbol, name: s.name, category: "stock",
                        price: s.price, changePct: s.changePct,
                        market: s.region, currency: s.currency,
                      })}
                    >
                      <ShoppingCart className="me-1 h-3.5 w-3.5" />{ar ? "شراء" : "Buy"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible < items.length && (
        <div className="flex items-center justify-center border-t border-border bg-muted/20 px-4 py-3">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setVisible((v) => v + 30)}>
            {ar
              ? `عرض المزيد (${items.length - visible} متبقّي)`
              : `Show more (${items.length - visible} remaining)`}
          </Button>
        </div>
      )}
    </section>
  );
}

/* ─── Assets tab (crypto / metals / fx / bonds) ─────────────────────────────── */

type SignalFilter = "all" | "buy" | "hold" | "sell";

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  crypto:     { en: "Cryptocurrencies", ar: "العملات الرقمية" },
  currencies: { en: "Forex",            ar: "الفوركس" },
  metals:     { en: "Metals & Commodities", ar: "المعادن والسلع" },
  bonds:      { en: "Bonds",            ar: "السندات" },
};

function AssetsTab({
  category,
  onAnalyze,
  onBuy,
}: {
  category: "crypto" | "currencies" | "metals" | "bonds";
  onAnalyze: (a: SelectedAsset) => void;
  onBuy: (a: SelectedAsset) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const marketFn = useServerFn(getMarketData);
  const { data, isLoading } = useQuery({
    queryKey: ["market"],
    queryFn: () => marketFn(),
    refetchInterval: 60000,
  });

  const [query, setQuery] = useState("");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");

  const allItems = useMemo(
    () => (data?.assets ?? []).filter((a) => a.category === category),
    [data, category],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((a) => {
      if (q && !a.symbol.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
      if (signalFilter !== "all") {
        const sig = deriveSignal(a.history.map((p) => p.p)).signal;
        if (sig !== signalFilter) return false;
      }
      return true;
    });
  }, [allItems, query, signalFilter]);

  const catLabel = CATEGORY_LABELS[category] ?? { en: category, ar: category };

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-card/40 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse h-12 rounded-lg bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="rounded-xl gradient-card border border-border p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold sm:text-lg">
              {ar ? catLabel.ar : catLabel.en}
            </h2>
            <p className="text-xs text-muted-foreground">
              {ar
                ? `${filtered.length} من ${allItems.length} أصل`
                : `${filtered.length} of ${allItems.length} assets`}
            </p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? "بحث برمز أو اسم..." : "Search symbol or name..."}
            className="h-8 w-40 text-xs sm:w-56"
          />
        </div>

        {/* Signal filter pills */}
        <div className="flex flex-wrap gap-2">
          {(["all", "buy", "hold", "sell"] as const).map((f) => {
            const labels: Record<SignalFilter, { en: string; ar: string }> = {
              all:  { en: "All signals", ar: "كل الإشارات" },
              buy:  { en: "Buy",         ar: "شراء" },
              hold: { en: "Hold",        ar: "انتظار" },
              sell: { en: "Sell",        ar: "بيع" },
            };
            const activeCls =
              f === "buy"  ? "border-success bg-success/15 text-success" :
              f === "hold" ? "border-warning bg-warning/15 text-warning" :
              f === "sell" ? "border-danger  bg-danger/15  text-danger"  :
                             "border-primary bg-primary/15 text-primary";
            return (
              <button
                key={f}
                onClick={() => setSignalFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  signalFilter === f
                    ? activeCls
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {ar ? labels[f].ar : labels[f].en}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && allItems.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          {ar ? "لا نتائج تطابق الفلتر الحالي" : "No assets match the current filter"}
        </p>
      )}

      {filtered.length > 0 && (
        <AssetTable items={filtered} onAnalyze={onAnalyze} onBuy={onBuy} />
      )}
    </>
  );
}

/* ─── Asset table ────────────────────────────────────────────────────────────── */

function AssetTable({
  items,
  onAnalyze,
  onBuy,
}: {
  items: AssetQuote[];
  onAnalyze: (a: SelectedAsset) => void;
  onBuy: (a: SelectedAsset) => void;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";

  const { avg, buys, sells, holds } = useMemo(() => {
    if (!items.length) return { avg: 0, buys: 0, sells: 0, holds: 0 };
    const sigs = items.map((a) => deriveSignal(a.history.map((p) => p.p)).signal);
    return {
      avg: items.reduce((s, a) => s + a.changePct, 0) / items.length,
      buys: sigs.filter((s) => s === "buy").length,
      sells: sigs.filter((s) => s === "sell").length,
      holds: sigs.filter((s) => s === "hold").length,
    };
  }, [items]);

  const fmtPrice = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : n < 100 ? 4 : 2 });

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/40 py-12 text-muted-foreground">
        <p className="text-sm">{ar ? "لا توجد بيانات حالياً" : "No data available"}</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <h2 className="font-display text-base font-semibold sm:text-lg">
            {items.length} {t("asset")}
          </h2>
          <p className="text-xs text-muted-foreground">
            <span className="text-success">{buys} {ar ? "شراء" : "buy"}</span>
            {" · "}
            <span className="text-warning">{holds} {ar ? "انتظار" : "hold"}</span>
            {" · "}
            <span className="text-danger">{sells} {ar ? "بيع" : "sell"}</span>
          </p>
        </div>
        <span className={cn("text-sm font-semibold", avg >= 0 ? "text-success" : "text-danger")}>
          {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
        </span>
      </header>

      {/* Mobile: card list */}
      <div className="divide-y divide-border/50 sm:hidden">
        {items.map((a) => {
          const s = deriveSignal(a.history.map((p) => p.p));
          return (
            <div key={a.symbol} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight">{a.symbol}</div>
                <div className="truncate text-xs text-muted-foreground">{a.name}</div>
              </div>
              <div className="shrink-0 text-end">
                <div className="text-sm font-medium">{fmtPrice(a.price)}</div>
                <div className={cn("text-xs font-semibold", a.changePct >= 0 ? "text-success" : "text-danger")}>
                  {a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(2)}%
                </div>
              </div>
              <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold", SIGNAL_CLS[s.signal])}>
                {t(s.signal)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => onAnalyze({
                  symbol: a.symbol, name: a.name, category: a.category,
                  price: a.price, changePct: a.changePct,
                  high24h: a.high24h, low24h: a.low24h,
                })}
              >
                <Brain className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("asset")}</th>
              <th className="px-4 py-3 text-end">{t("price")}</th>
              <th className="px-4 py-3 text-end">{t("change")}</th>
              <th className="px-4 py-3 text-end">{t("highToday")}</th>
              <th className="px-4 py-3 text-end">{t("lowToday")}</th>
              <th className="px-4 py-3 text-end">{t("signal")}</th>
              <th className="px-4 py-3 text-end">{ar ? "تحليل ذكي" : "AI"}</th>
              <th className="px-4 py-3 text-end">{ar ? "محاكاة" : "Simulate"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const s = deriveSignal(a.history.map((p) => p.p));
              return (
                <tr key={a.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{a.symbol}</div>
                    <div className="text-xs text-muted-foreground">{a.name}</div>
                  </td>
                  <td className="px-4 py-3 text-end font-medium">{fmtPrice(a.price)}</td>
                  <td className={cn("px-4 py-3 text-end font-medium", a.changePct >= 0 ? "text-success" : "text-danger")}>
                    {a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground">
                    {a.high24h?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground">
                    {a.low24h?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", SIGNAL_CLS[s.signal])}>
                      {t(s.signal)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => onAnalyze({
                        symbol: a.symbol, name: a.name, category: a.category,
                        price: a.price, changePct: a.changePct,
                        high24h: a.high24h, low24h: a.low24h,
                      })}
                    >
                      <Brain className="me-1 h-3.5 w-3.5" />{ar ? "تحليل" : "Analyze"}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onBuy({
                        symbol: a.symbol, name: a.name, category: a.category,
                        price: a.price, changePct: a.changePct,
                        market: a.category, currency: "USD",
                      })}
                    >
                      <ShoppingCart className="me-1 h-3.5 w-3.5" />{ar ? "شراء" : "Buy"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
