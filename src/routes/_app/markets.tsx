import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMarketData, deriveSignal, type AssetQuote } from "@/lib/market-data";
import { getStocksData, REGION_LABELS, type StockQuote, type StockRegion } from "@/lib/stocks-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AssetAnalysisDialog } from "@/components/AssetAnalysisDialog";
import { BuyAssetDialog } from "@/components/BuyAssetDialog";
import { Building2, Coins, DollarSign, Brain, Gem, ShoppingCart } from "lucide-react";

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
  const [tab, setTab] = useState<"stocks" | "crypto" | "metals" | "fx">("stocks");
  const [selected, setSelected] = useState<SelectedAsset | null>(null);
  const [open, setOpen] = useState(false);
  const analyze = (a: SelectedAsset) => { setSelected(a); setOpen(true); };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("markets")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "ar" ? "اضغط على \"تحليل ذكي\" بجانب أي أصل لمعرفة هل الشراء أم البيع الآن." : "Tap \"AI analysis\" next to any asset to see buy/sell verdict."}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="stocks" className="gap-2"><Building2 className="h-4 w-4" />{lang === "ar" ? "الأسهم" : "Stocks"}</TabsTrigger>
          <TabsTrigger value="crypto" className="gap-2"><Coins className="h-4 w-4" />{lang === "ar" ? "العملات الرقمية" : "Crypto"}</TabsTrigger>
          <TabsTrigger value="metals" className="gap-2"><Gem className="h-4 w-4" />{lang === "ar" ? "المعادن" : "Metals"}</TabsTrigger>
          <TabsTrigger value="fx" className="gap-2"><DollarSign className="h-4 w-4" />{lang === "ar" ? "العملات العالمية" : "Forex"}</TabsTrigger>
        </TabsList>

        <TabsContent value="stocks" className="mt-6 space-y-6"><StocksTab onAnalyze={analyze} /></TabsContent>
        <TabsContent value="crypto" className="mt-6 space-y-6"><AssetsTab category="crypto" onAnalyze={analyze} /></TabsContent>
        <TabsContent value="metals" className="mt-6 space-y-6"><AssetsTab category="metals" onAnalyze={analyze} /></TabsContent>
        <TabsContent value="fx" className="mt-6 space-y-6"><AssetsTab category="currencies" onAnalyze={analyze} /></TabsContent>
      </Tabs>

      <AssetAnalysisDialog open={open} onOpenChange={setOpen} asset={selected} />
    </div>
  );
}

function StocksTab({ onAnalyze }: { onAnalyze: (a: SelectedAsset) => void }) {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["stocks"], queryFn: () => getStocksData(), refetchInterval: 120000 });
  const stocks = data?.stocks ?? [];
  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  return (
    <>
      {REGION_ORDER.map((r) => {
        const items = stocks.filter((s) => s.region === r);
        if (items.length === 0) return null;
        return <RegionSection key={r} region={r} items={items} onAnalyze={onAnalyze} />;
      })}
    </>
  );
}

function RegionSection({ region, items, onAnalyze }: { region: StockRegion; items: StockQuote[]; onAnalyze: (a: SelectedAsset) => void }) {
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssetsTab({ category, onAnalyze }: { category: "crypto" | "currencies" | "metals"; onAnalyze: (a: SelectedAsset) => void }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["market"], queryFn: () => getMarketData(), refetchInterval: 60000 });
  const items = (data?.assets ?? []).filter((a) => a.category === category);
  if (isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  return <AssetTable items={items} onAnalyze={onAnalyze} />;
}

function AssetTable({ items, onAnalyze }: { items: AssetQuote[]; onAnalyze: (a: SelectedAsset) => void }) {
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
