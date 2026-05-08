import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMarketData, deriveSignal } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/markets")({
  component: MarketsPage,
});

function MarketsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["market"],
    queryFn: () => getMarketData(),
    refetchInterval: 60000,
  });
  const assets = data?.assets ?? [];

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-6 font-display text-3xl font-bold">{t("markets")}</h1>
      <div className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
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
            {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("loading")}</td></tr>}
            {assets.map((a) => {
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
      </div>
    </div>
  );
}
