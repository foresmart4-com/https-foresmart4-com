import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, TrendingUp } from "lucide-react";
import { getMarketData } from "@/lib/market-data";
import { getStocksData, REGION_LABELS, type StockRegion } from "@/lib/stocks-data";
import { useI18n } from "@/lib/i18n";
import { BuyAssetDialog } from "@/components/BuyAssetDialog";

type AssetKind = "stocks" | "crypto" | "metals" | "bonds" | "currencies";

interface Option {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  market?: string;
}

export function QuickBuyPanel() {
  const { lang } = useI18n();
  const marketFn = useServerFn(getMarketData);
  const stocksFn = useServerFn(getStocksData);
  const market = useQuery({ queryKey: ["market"], queryFn: () => marketFn(), refetchInterval: 60000 });
  const stocks = useQuery({ queryKey: ["stocks"], queryFn: () => stocksFn(), refetchInterval: 120000 });

  const [kind, setKind] = useState<AssetKind>("stocks");
  const [region, setRegion] = useState<StockRegion>("us");
  const [symbol, setSymbol] = useState<string>("");
  const [open, setOpen] = useState(false);

  const options: Option[] = useMemo(() => {
    if (kind === "stocks") {
      return (stocks.data?.stocks ?? [])
        .filter((s) => s.region === region)
        .map((s) => ({ symbol: s.symbol, name: s.name, price: s.price, currency: s.currency, market: s.region }));
    }
    const cat = kind === "currencies" ? "currencies" : kind;
    return (market.data?.assets ?? [])
      .filter((a) => a.category === cat)
      .map((a) => ({ symbol: a.symbol, name: a.name, price: a.price, currency: "USD", market: a.category }));
  }, [kind, region, stocks.data, market.data]);

  const selected = options.find((o) => o.symbol === symbol) ?? options[0];

  return (
    <Card className="gradient-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-display text-lg font-bold">{lang === "ar" ? "شراء سريع من المحفظة" : "Quick buy from wallet"}</h3>
          <p className="text-xs text-muted-foreground">
            {lang === "ar" ? "اختر النوع ثم الأصل لخصم القيمة من رصيد المحفظة فوراً." : "Pick a category and asset — debited from wallet instantly."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "النوع" : "Type"}</label>
          <Select value={kind} onValueChange={(v) => { setKind(v as AssetKind); setSymbol(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stocks">{lang === "ar" ? "أسهم وشركات" : "Companies / Stocks"}</SelectItem>
              <SelectItem value="crypto">{lang === "ar" ? "عملات رقمية" : "Crypto"}</SelectItem>
              <SelectItem value="metals">{lang === "ar" ? "معادن" : "Metals"}</SelectItem>
              <SelectItem value="bonds">{lang === "ar" ? "سندات" : "Bonds"}</SelectItem>
              <SelectItem value="currencies">{lang === "ar" ? "عملات عالمية" : "Currencies (FX)"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "stocks" && (
          <div>
            <label className="text-xs text-muted-foreground">{lang === "ar" ? "السوق" : "Market"}</label>
            <Select value={region} onValueChange={(v) => { setRegion(v as StockRegion); setSymbol(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REGION_LABELS) as StockRegion[]).map((r) => (
                  <SelectItem key={r} value={r}>{REGION_LABELS[r].flag} {REGION_LABELS[r][lang as "ar" | "en"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={kind === "stocks" ? "" : "sm:col-span-2"}>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الأصل" : "Asset"}</label>
          <Select value={selected?.symbol ?? ""} onValueChange={setSymbol}>
            <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر..." : "Choose..."} /></SelectTrigger>
            <SelectContent className="max-h-72">
              {options.map((o) => (
                <SelectItem key={o.symbol} value={o.symbol}>
                  {o.symbol} — {o.name} ({o.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} {o.currency})
                </SelectItem>
              ))}
              {options.length === 0 && <div className="p-2 text-xs text-muted-foreground">—</div>}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button className="w-full gap-2" onClick={() => selected && setOpen(true)} disabled={!selected}>
            <TrendingUp className="h-4 w-4" />
            {lang === "ar" ? "شراء" : "Buy"}
          </Button>
        </div>
      </div>

      <BuyAssetDialog
        open={open}
        onOpenChange={setOpen}
        asset={selected ? { symbol: selected.symbol, name: selected.name, price: selected.price, currency: selected.currency, market: selected.market } : null}
      />
    </Card>
  );
}
