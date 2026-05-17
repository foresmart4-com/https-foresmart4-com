import { useQuery } from "@tanstack/react-query";
import { fetchCryptoLive } from "@/lib/marketApi";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Coins, RefreshCw, TrendingUp, TrendingDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

type Props = { query?: string };

export function CryptoLivePanel({ query: externalQuery }: Props = {}) {
  const { lang } = useI18n();
  const [query, setQuery] = useState("");
  const q = (externalQuery ?? query).trim().toLowerCase();

  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["crypto-live"],
    queryFn: fetchCryptoLive,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const isLive = (data?.[0]?.source ?? "mock") === "live";
  const filtered = (data ?? []).filter(
    (c) => !q || c.symbol.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q) || c.name_ar.includes(q),
  );

  const handleRefresh = async () => {
    const res = await refetch();
    const live = res.data?.[0]?.source === "live";
    if (live) toast.success(lang === "ar" ? "تم تحديث أسعار العملات الرقمية" : "Crypto prices updated");
    else toast.warning(lang === "ar" ? "تعذر تحديث البيانات، تم استخدام البيانات التجريبية" : "Update failed, using mock data");
  };

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">
            {lang === "ar" ? "العملات الرقمية — مباشر" : "Live Crypto"}
          </h2>
          <Badge variant={isLive ? "default" : "secondary"} className={cn("text-[10px]", isLive ? "bg-success/20 text-success border-success/30" : "bg-warning/20 text-warning border-warning/30")}>
            {isLive ? "LIVE" : (lang === "ar" ? "بيانات تجريبية" : "MOCK")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {externalQuery === undefined && (
            <div className="relative">
              <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === "ar" ? "بحث..." : "Search..."}
                className="h-8 ps-7 w-32 sm:w-40 text-xs"
              />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isFetching} className="h-8 gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "السعر (USD)" : "Price (USD)"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "24س" : "24h"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "القيمة السوقية" : "Market cap"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "المصدر" : "Source"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const TrendIcon = c.change24h >= 0 ? TrendingUp : TrendingDown;
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{lang === "ar" ? c.name_ar : c.name_en}</div>
                    <div className="text-xs text-muted-foreground">{c.symbol}</div>
                  </td>
                  <td className="px-4 py-3 text-end font-medium">
                    ${c.price.toLocaleString(undefined, { maximumFractionDigits: c.price < 1 ? 4 : 2 })}
                  </td>
                  <td className={cn("px-4 py-3 text-end font-medium", c.change24h >= 0 ? "text-success" : "text-danger")}>
                    <span className="inline-flex items-center gap-1">
                      <TrendIcon className="h-3 w-3" />
                      {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground">
                    {c.marketCap ? `$${(c.marketCap / 1e9).toFixed(1)}B` : "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Badge variant="outline" className={cn("text-[10px]", c.source === "live" ? "border-success/40 text-success" : "border-warning/40 text-warning")}>
                      {c.source === "live" ? "Live" : "Mock"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{lang === "ar" ? "لا نتائج" : "No results"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border bg-muted/20 px-5 py-2 text-[11px] text-muted-foreground">
        {lang === "ar" ? "آخر تحديث:" : "Last updated:"} {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
        {" · "}CoinGecko API
      </footer>
    </Card>
  );
}
