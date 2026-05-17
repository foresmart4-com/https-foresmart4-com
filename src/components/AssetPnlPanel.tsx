import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { assetPnlMock, MONTHLY_WALLET_FEE_PCT } from "@/lib/mock-data";
import { TrendingUp, TrendingDown, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

export function AssetPnlPanel() {
  const { lang } = useI18n();
  const rows = assetPnlMock.map((a) => {
    const marketValue = a.quantity * a.lastPrice;
    const cost = a.quantity * a.avgCost;
    const pnl = marketValue - cost;
    const pct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { ...a, marketValue, pnl, pct };
  });
  return (
    <Card className="gradient-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">{lang === "ar" ? "الربح والخسارة لكل أصل" : "Per-asset P&L"}</h3>
        <span className="text-[11px] text-muted-foreground">{lang === "ar" ? "بيانات تجريبية" : "Demo data"}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
              <th className="py-2 text-end">{lang === "ar" ? "الكمية" : "Qty"}</th>
              <th className="py-2 text-end">{lang === "ar" ? "متوسط الشراء" : "Avg cost"}</th>
              <th className="py-2 text-end">{lang === "ar" ? "السعر الحالي" : "Last"}</th>
              <th className="py-2 text-end">{lang === "ar" ? "ربح/خسارة" : "P&L"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="border-t border-border">
                <td className="py-2">
                  <div className="font-medium">{lang === "ar" ? r.name_ar : r.name_en}</div>
                  <div className="text-[11px] text-muted-foreground">{r.symbol}</div>
                </td>
                <td className="py-2 text-end">{r.quantity}</td>
                <td className="py-2 text-end">{r.avgCost.toLocaleString()}</td>
                <td className="py-2 text-end">{r.lastPrice.toLocaleString()} <span className="text-[10px] text-muted-foreground">{r.currency}</span></td>
                <td className={cn("py-2 text-end font-semibold", r.pnl >= 0 ? "text-success" : "text-danger")}>
                  <span className="inline-flex items-center gap-1">
                    {r.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(0)} ({r.pct.toFixed(1)}%)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
        <Percent className="h-3.5 w-3.5" />
        {lang === "ar"
          ? `رسوم المحفظة الشهرية ${(MONTHLY_WALLET_FEE_PCT * 100).toFixed(1)}% من متوسط الرصيد.`
          : `Monthly wallet fee ${(MONTHLY_WALLET_FEE_PCT * 100).toFixed(1)}% of avg balance.`}
      </div>
    </Card>
  );
}
