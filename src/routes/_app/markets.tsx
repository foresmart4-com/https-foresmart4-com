import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMarketData, deriveSignal, type AssetQuote } from "@/lib/market-data";
import { getStocksData, REGION_LABELS, type StockQuote, type StockRegion } from "@/lib/stocks-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AssetAnalysisDialog } from "@/components/AssetAnalysisDialog";
import { BuyAssetDialog } from "@/components/BuyAssetDialog";
import { Building2, Coins, DollarSign, Brain, Gem, ShoppingCart, Landmark, ExternalLink } from "lucide-react";
import { BOND_BUY_LINKS, TREASURY_DIRECT_LINKS } from "@/lib/bond-links";
import { FeaturedAssetsTable } from "@/components/FeaturedAssetsTable";
import { CryptoLivePanel } from "@/components/CryptoLivePanel";
import { AIDecisionPanel } from "@/components/AIDecisionPanel";

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
});

const REGION_ORDER: StockRegion[] = ["us", "eu", "uk", "japan", "china", "uae", "saudi"];

function MarketsPage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"stocks" | "crypto" | "metals" | "fx" | "bonds">("stocks");
  const [selected, setSelected] = useState<SelectedAsset | null>(null);
  const [open, setOpen] = useState(false);
  const [buyTarget, setBuyTarget] = useState<SelectedAsset | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const analyze = (a: SelectedAsset) => { setSelected(a); setOpen(true); };
  const buy = (a: SelectedAsset) => { setBuyTarget(a); setBuyOpen(true); };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("markets")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "ar" ? "اضغط على \"تحليل ذكي\" بجانب أي أصل لمعرفة هل الشراء أم البيع الآن." : "Tap \"AI analysis\" next to any asset to see buy/sell verdict."}
        </p>
      </div>

      <CryptoLivePanel />
      <AIDecisionPanel />
      <FeaturedAssetsTable />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full max-w-4xl grid-cols-5">
          <TabsTrigger value="stocks" className="gap-2"><Building2 className="h-4 w-4" />{lang === "ar" ? "الأسواق العالمية" : "Global Markets"}</TabsTrigger>
          <TabsTrigger value="crypto" className="gap-2"><Coins className="h-4 w-4" />{lang === "ar" ? "العملات الرقمية" : "Crypto"}</TabsTrigger>
          <TabsTrigger value="bonds" className="gap-2"><Landmark className="h-4 w-4" />{lang === "ar" ? "السندات" : "Bonds"}</TabsTrigger>
          <TabsTrigger value="metals" className="gap-2"><Gem className="h-4 w-4" />{lang === "ar" ? "المعادن" : "Metals"}</TabsTrigger>
          <TabsTrigger value="fx" className="gap-2"><DollarSign className="h-4 w-4" />{lang === "ar" ? "العملات العالمية" : "Forex"}</TabsTrigger>
        </TabsList>

        <TabsContent value="stocks" className="mt-6 space-y-6"><StocksTab onAnalyze={analyze} onBuy={buy} /></TabsContent>
        <TabsContent value="crypto" className="mt-6 space-y-6"><AssetsTab category="crypto" onAnalyze={analyze} onBuy={buy} /></TabsContent>
        <TabsContent value="bonds" className="mt-6 space-y-6"><BondsExternalLinks /><AssetsTab category="bonds" onAnalyze={analyze} onBuy={buy} /></TabsContent>
        <TabsContent value="metals" className="mt-6 space-y-6"><AssetsTab category="metals" onAnalyze={analyze} onBuy={buy} /></TabsContent>
        <TabsContent value="fx" className="mt-6 space-y-6"><AssetsTab category="currencies" onAnalyze={analyze} onBuy={buy} /></TabsContent>
      </Tabs>

      <AssetAnalysisDialog open={open} onOpenChange={setOpen} asset={selected} />
      <BuyAssetDialog open={buyOpen} onOpenChange={setBuyOpen} asset={buyTarget} />
    </div>
  );
}

function BondsExternalLinks() {
  const { lang } = useI18n();
  return (
    <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold mb-1">
        {lang === "ar" ? "شراء السندات الأمريكية مباشرة" : "Buy US Bonds directly"}
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        {lang === "ar" ? "روابط رسمية لشراء السندات من المُصدر أو وسطاء معتمدين." : "Official links to buy bonds from issuer or licensed brokers."}
      </p>
      <div className="flex flex-wrap gap-2">
        {TREASURY_DIRECT_LINKS.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            <ExternalLink className="h-3.5 w-3.5" /> {l.label}
          </a>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {lang === "ar" ? "بعد الشراء يمكنك إضافة الأصل لقائمة المراقبة لمتابعته داخل البرنامج." : "After purchase, add the asset to your watchlist to track it inside the app."}
      </p>
    </section>
  );
}

function StocksTab({ onAnalyze, onBuy }: { onAnalyze: (a: SelectedAsset) => void; onBuy: (a: SelectedAsset) => void }) {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["stocks"], queryFn: () => getStocksData(), refetchInterval: 120000 });
  const [selectedRegions, setSelectedRegions] = useState<StockRegion[]>([...REGION_ORDER]);
  const stocks = data?.stocks ?? [];
  const toggle = (r: StockRegion) =>
    setSelectedRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  const allOn = selectedRegions.length === REGION_ORDER.length;
  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  return (
    <>
      <div className="rounded-xl gradient-card border border-border p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {lang === "ar" ? "الأسواق العالمية" : "Global Markets"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "اختر سوقاً واحداً أو أكثر لعرضه" : "Pick one or more markets to display"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => setSelectedRegions(allOn ? [] : [...REGION_ORDER])}>
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
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
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
        const items = stocks.filter((s) => s.region === r);
        if (items.length === 0) return null;
        return <RegionSection key={r} region={r} items={items} onAnalyze={onAnalyze} onBuy={onBuy} />;
      })}
    </>
  );
}

function RegionSection({ region, items, onAnalyze, onBuy }: { region: StockRegion; items: StockQuote[]; onAnalyze: (a: SelectedAsset) => void; onBuy: (a: SelectedAsset) => void }) {
  const { t, lang } = useI18n();
  const meta = REGION_LABELS[region];
  const avg = items.reduce((s, a) => s + a.changePct, 0) / items.length;
  const gainers = items.filter((a) => a.changePct > 0).length;
  const losers = items.filter((a) => a.changePct < 0).length;
  return (
    <section className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.flag}</span>
          <div>
            <h2 className="font-display text-xl font-semibold">{meta[lang]}</h2>
            <p className="text-xs text-muted-foreground">{items.length} {lang === "ar" ? "شركة" : "companies"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className={cn("font-semibold", avg >= 0 ? "text-success" : "text-danger")}>{avg >= 0 ? "+" : ""}{avg.toFixed(2)}%</span>
          <span className="text-success">▲ {gainers}</span>
          <span className="text-danger">▼ {losers}</span>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{lang === "ar" ? "الشركة" : "Company"}</th>
              <th className="px-4 py-3 text-start">{lang === "ar" ? "القطاع" : "Sector"}</th>
              <th className="px-4 py-3 text-end">{t("price")}</th>
              <th className="px-4 py-3 text-end">{t("change")}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "التوصية" : "Signal"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "تحليل ذكي" : "AI"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "تداول" : "Trade"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const sig = deriveSignal(s.history);
              return (
                <tr key={s.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">{s.symbol}</div></td>
                  <td className="px-4 py-3 text-muted-foreground">{s.sector}</td>
                  <td className="px-4 py-3 text-end font-medium">{s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-muted-foreground">{s.currency}</span></td>
                  <td className={cn("px-4 py-3 text-end font-medium", s.changePct >= 0 ? "text-success" : "text-danger")}>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-end">
                    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold",
                      sig.signal === "buy" && "bg-success/15 text-success",
                      sig.signal === "sell" && "bg-danger/15 text-danger",
                      sig.signal === "hold" && "bg-warning/15 text-warning")}>{t(sig.signal)}</span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAnalyze({
                      symbol: s.symbol, name: s.name, category: `stock-${s.sector ?? ""}`,
                      price: s.price, changePct: s.changePct,
                    })}>
                      <Brain className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "تحليل" : "Analyze"}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onBuy({
                      symbol: s.symbol, name: s.name, category: "stock",
                      price: s.price, changePct: s.changePct, market: s.region, currency: s.currency,
                    })}>
                      <ShoppingCart className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "شراء" : "Buy"}
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

function AssetsTab({ category, onAnalyze, onBuy }: { category: "crypto" | "currencies" | "metals" | "bonds"; onAnalyze: (a: SelectedAsset) => void; onBuy: (a: SelectedAsset) => void }) {
  const { t } = useI18n();
  const marketFn = useServerFn(getMarketData);
  const { data, isLoading } = useQuery({ queryKey: ["market"], queryFn: () => marketFn(), refetchInterval: 60000 });
  const items = (data?.assets ?? []).filter((a) => a.category === category);
  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  return <AssetTable items={items} onAnalyze={onAnalyze} onBuy={onBuy} />;
}

function AssetTable({ items, onAnalyze, onBuy }: { items: AssetQuote[]; onAnalyze: (a: SelectedAsset) => void; onBuy: (a: SelectedAsset) => void }) {
  const { t, lang } = useI18n();
  const avg = items.length ? items.reduce((s, a) => s + a.changePct, 0) / items.length : 0;
  return (
    <section className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
      <header className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
        <h2 className="font-display text-lg font-semibold">{items.length} {t("asset")}</h2>
        <span className={cn("text-xs font-semibold", avg >= 0 ? "text-success" : "text-danger")}>{avg >= 0 ? "+" : ""}{avg.toFixed(2)}%</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("asset")}</th>
              <th className="px-4 py-3 text-end">{t("price")}</th>
              <th className="px-4 py-3 text-end">{t("change")}</th>
              <th className="px-4 py-3 text-end">{t("highToday")}</th>
              <th className="px-4 py-3 text-end">{t("lowToday")}</th>
              <th className="px-4 py-3 text-end">{t("signal")}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "تحليل ذكي" : "AI"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "تداول" : "Trade"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const s = deriveSignal(a.history.map((p) => p.p));
              return (
                <tr key={a.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="font-semibold">{a.symbol}</div><div className="text-xs text-muted-foreground">{a.name}</div></td>
                  <td className="px-4 py-3 text-end font-medium">{a.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className={cn("px-4 py-3 text-end font-medium", a.changePct >= 0 ? "text-success" : "text-danger")}>{a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-end text-muted-foreground">{a.high24h?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                  <td className="px-4 py-3 text-end text-muted-foreground">{a.low24h?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                  <td className="px-4 py-3 text-end">
                    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold",
                      s.signal === "buy" && "bg-success/15 text-success",
                      s.signal === "sell" && "bg-danger/15 text-danger",
                      s.signal === "hold" && "bg-warning/15 text-warning")}>{t(s.signal)}</span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAnalyze({
                      symbol: a.symbol, name: a.name, category: a.category,
                      price: a.price, changePct: a.changePct, high24h: a.high24h, low24h: a.low24h,
                    })}>
                      <Brain className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "تحليل" : "Analyze"}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onBuy({
                      symbol: a.symbol, name: a.name, category: a.category,
                      price: a.price, changePct: a.changePct, market: a.category, currency: "USD",
                    })}>
                      <ShoppingCart className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "شراء" : "Buy"}
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
