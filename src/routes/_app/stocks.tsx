import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStocksData, REGION_LABELS, type StockQuote, type StockRegion } from "@/lib/stocks-data";
import { deriveSignal } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/stocks")({
  component: StocksPage,
});

const ORDER: StockRegion[] = ["us", "eu", "uk", "japan", "china", "uae", "saudi"];

function StocksPage() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: () => getStocksData(),
    refetchInterval: 120000,
  });
  const stocks = data?.stocks ?? [];

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "تفاصيل الشركات حسب الأسواق" : "Companies by Market"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "ar"
            ? "نصائح بيع وشراء لكل شركة بناءً على المؤشرات الفنية، مصمّم لأصحاب رؤوس الأموال الصغيرة والمتوسطة لتنمية رأس المال على المدى القصير والمتوسط والطويل."
            : "Buy/sell guidance for each company based on technical indicators — designed for small and mid-capital investors aiming to grow their capital across short, medium and long-term horizons."}
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">{t("loading")}</p>}

      {ORDER.map((region) => {
        const items = stocks.filter((s) => s.region === region);
        if (items.length === 0) return null;
        return <RegionSection key={region} region={region} items={items} />;
      })}
    </div>
  );
}

function RegionSection({ region, items }: { region: StockRegion; items: StockQuote[] }) {
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
          <span className={cn("font-semibold", avg >= 0 ? "text-success" : "text-danger")}>
            {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
          </span>
          <span className="text-success">▲ {gainers}</span>
          <span className="text-danger">▼ {losers}</span>
        </div>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start">{lang === "ar" ? "الشركة" : "Company"}</th>
            <th className="px-4 py-3 text-start">{lang === "ar" ? "القطاع" : "Sector"}</th>
            <th className="px-4 py-3 text-end">{t("price")}</th>
            <th className="px-4 py-3 text-end">{t("change")}</th>
            <th className="px-4 py-3 text-end">{t("highToday")}</th>
            <th className="px-4 py-3 text-end">{t("lowToday")}</th>
            <th className="px-4 py-3 text-end">{lang === "ar" ? "التوصية" : "Recommendation"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const sig = deriveSignal(s.history);
            return (
              <tr key={s.symbol} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.symbol}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.sector}</td>
                <td className="px-4 py-3 text-end font-medium">
                  {s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-muted-foreground">{s.currency}</span>
                </td>
                <td className={cn("px-4 py-3 text-end font-medium", s.changePct >= 0 ? "text-success" : "text-danger")}>
                  {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-end text-muted-foreground">{s.high.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-end text-muted-foreground">{s.low.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-end">
                  <span className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold",
                    sig.signal === "buy" && "bg-success/15 text-success",
                    sig.signal === "sell" && "bg-danger/15 text-danger",
                    sig.signal === "hold" && "bg-warning/15 text-warning",
                  )}>{t(sig.signal)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
