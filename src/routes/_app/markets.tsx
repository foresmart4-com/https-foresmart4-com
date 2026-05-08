import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMarketData, deriveSignal, type AssetQuote, type AssetCategory } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/markets")({
  component: MarketsPage,
});

const CATEGORY_ORDER: AssetCategory[] = ["crypto", "currencies", "metals", "oil", "stocks"];

function MarketsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["market"],
    queryFn: () => getMarketData(),
    refetchInterval: 60000,
  });
  const assets = data?.assets ?? [];

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: assets.filter((a) => a.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6">
      <h1 className="font-display text-3xl font-bold">{t("markets")}</h1>

      {isLoading && <p className="text-muted-foreground">{t("loading")}</p>}

      {grouped.map(({ cat, items }) => (
        <MarketSection key={cat} title={t(cat)} items={items} />
      ))}
    </div>
  );
}

function MarketSection({ title, items }: { title: string; items: AssetQuote[] }) {
  const { t } = useI18n();
  const avgChange = items.reduce((s, a) => s + a.changePct, 0) / items.length;
  const gainers = items.filter((a) => a.changePct > 0).length;
  const losers = items.filter((a) => a.changePct < 0).length;

  return (
    <section className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{items.length} {t("asset")}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className={cn("font-semibold", avgChange >= 0 ? "text-success" : "text-danger")}>
            {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
          </span>
          <span className="text-success">▲ {gainers}</span>
          <span className="text-danger">▼ {losers}</span>
        </div>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start">{t("asset")}</th>
            <th className="px-4 py-3 text-end">{t("price")}</th>
            <th className="px-4 py-3 text-end">{t("change")}</th>
            <th className="px-4 py-3 text-end">{t("highToday")}</th>
            <th className="px-4 py-3 text-end">{t("lowToday")}</th>
            <th className="px-4 py-3 text-end">{t("signal")}</th>
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
                <td className="px-4 py-3 text-end font-medium">{a.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className={cn("px-4 py-3 text-end font-medium", a.changePct >= 0 ? "text-success" : "text-danger")}>
                  {a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-end text-muted-foreground">{a.high24h?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                <td className="px-4 py-3 text-end text-muted-foreground">{a.low24h?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                <td className="px-4 py-3 text-end">
                  <span className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold",
                    s.signal === "buy" && "bg-success/15 text-success",
                    s.signal === "sell" && "bg-danger/15 text-danger",
                    s.signal === "hold" && "bg-warning/15 text-warning",
                  )}>{t(s.signal)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
