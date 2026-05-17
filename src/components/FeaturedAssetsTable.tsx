import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { featuredAssets } from "@/lib/mock-data";
import { Building2, TrendingUp, TrendingDown, Minus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

const SIG: Record<string, string> = {
  buy:   "bg-success/15 text-success",
  sell:  "bg-danger/15 text-danger",
  watch: "bg-primary/15 text-primary",
  hold:  "bg-warning/15 text-warning",
};
const RISK: Record<string, string> = {
  low:    "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  high:   "bg-danger/10 text-danger",
};

export function FeaturedAssetsTable() {
  const { lang } = useI18n();
  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">
            {lang === "ar" ? "الأصول المميزة" : "Featured Assets"}
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">{lang === "ar" ? "بيانات تجريبية محدّثة" : "Demo data"}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "التغير" : "Change"}</th>
              <th className="px-4 py-3 text-center">{lang === "ar" ? "الاتجاه" : "Trend"}</th>
              <th className="px-4 py-3 text-center">{lang === "ar" ? "إشارة AI" : "AI signal"}</th>
              <th className="px-4 py-3 text-center">{lang === "ar" ? "المخاطر" : "Risk"}</th>
              <th className="px-4 py-3 text-end">{lang === "ar" ? "إجراء" : "Action"}</th>
            </tr>
          </thead>
          <tbody>
            {featuredAssets.map((a) => {
              const TrendIcon = a.trend === "up" ? TrendingUp : a.trend === "down" ? TrendingDown : Minus;
              return (
                <tr key={a.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="font-semibold">{lang === "ar" ? a.name_ar : a.name_en}</div><div className="text-xs text-muted-foreground">{a.symbol}</div></td>
                  <td className="px-4 py-3 text-end font-medium">{a.price.toLocaleString()} <span className="text-xs text-muted-foreground">{a.currency}</span></td>
                  <td className={cn("px-4 py-3 text-end font-medium", a.change >= 0 ? "text-success" : "text-danger")}>{a.change >= 0 ? "+" : ""}{a.change.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-center">
                    <TrendIcon className={cn("inline h-4 w-4", a.trend === "up" ? "text-success" : a.trend === "down" ? "text-danger" : "text-muted-foreground")} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold uppercase", SIG[a.aiSignal])}>{a.aiSignal}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold uppercase", RISK[a.risk])}>{a.risk}</span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button size="sm" className="h-7 px-2 text-xs"><ShoppingCart className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "شراء" : "Buy"}</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
