import { useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useWatchlist, removeFromWatchlist, pushAlert, addToWatchlist, type WatchlistAsset } from "@/lib/watchlistStore";
import { generateTradingDecision, type AssetContext } from "@/lib/marketIntelligence";
import { Bookmark, Trash2, Plus, Bell, ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function WatchlistPanel() {
  const { lang } = useI18n();
  const { items, alerts } = useWatchlist();
  const seen = useRef<Set<string>>(new Set());

  const decisions = useMemo(() => items.map((a) => {
    const ctx: AssetContext = { symbol: a.symbol, name_ar: a.name, category: a.category as any, price: a.price, change24h: a.change24h, currency: a.currency };
    return { a, d: generateTradingDecision(ctx) };
  }), [items]);

  useEffect(() => {
    for (const { a, d } of decisions) {
      const checks: { id: string; kind: any; msg: string }[] = [];
      if (d.action === "BUY" && d.confidence >= 75) checks.push({ id: `${a.symbol}_buy`, kind: "buy_high_conf", msg: lang === "ar" ? `فرصة شراء على ${a.symbol} ثقة ${d.confidence}%` : `Buy on ${a.symbol} ${d.confidence}%` });
      if (d.action === "STOP_LOSS") checks.push({ id: `${a.symbol}_sl`, kind: "stop_loss", msg: lang === "ar" ? `وقف خسارة على ${a.symbol}` : `Stop-loss on ${a.symbol}` });
      if (Math.abs(a.change24h) > 5) checks.push({ id: `${a.symbol}_move`, kind: "big_move", msg: lang === "ar" ? `حركة قوية ${a.change24h.toFixed(1)}% على ${a.symbol}` : `${a.change24h.toFixed(1)}% move on ${a.symbol}` });
      if (d.riskLevel === "HIGH") checks.push({ id: `${a.symbol}_risk`, kind: "high_risk", msg: lang === "ar" ? `مخاطر مرتفعة على ${a.symbol}` : `High risk on ${a.symbol}` });
      for (const c of checks) {
        if (seen.current.has(c.id)) continue;
        seen.current.add(c.id);
        pushAlert({ symbol: a.symbol, kind: c.kind, message: c.msg });
        toast.warning(c.msg);
      }
    }
  }, [decisions, lang]);

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">{lang === "ar" ? "قائمة المراقبة الذكية" : "Smart Watchlist"}</h2>
          <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => {
          const ok = addToWatchlist({ symbol: "ETH", name: "Ethereum", category: "crypto", price: 3120, change24h: -0.42, currency: "USD" });
          toast[ok ? "success" : "info"](lang === "ar" ? (ok ? "تمت الإضافة" : "موجود بالفعل") : (ok ? "Added" : "Exists"));
        }}><Plus className="h-3 w-3" />ETH</Button>
      </header>
      <div className="divide-y divide-border">
        {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{lang === "ar" ? "لا توجد أصول" : "Empty"}</div>}
        {decisions.map(({ a, d }) => (
          <div key={a.symbol} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-semibold">{a.symbol}</div>
              <div className="text-[10px] text-muted-foreground">{a.name} · {a.currency}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div>{a.price.toLocaleString()}</div>
              <div className={cn("inline-flex items-center gap-0.5", a.change24h >= 0 ? "text-success" : "text-danger")}>
                {a.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {a.change24h.toFixed(2)}%
              </div>
              <Badge variant="outline" className={cn("text-[10px]",
                d.action === "BUY" && "border-success/40 text-success",
                d.action === "SELL" && "border-danger/40 text-danger",
                d.action === "STOP_LOSS" && "border-danger/40 text-danger",
                d.action === "HOLD" && "border-warning/40 text-warning")}>{d.action} · {d.confidence}%</Badge>
              <Badge variant="outline" className={cn("text-[10px]",
                d.riskLevel === "HIGH" && "border-danger/40 text-danger",
                d.riskLevel === "MEDIUM" && "border-warning/40 text-warning",
                d.riskLevel === "LOW" && "border-success/40 text-success")}>{d.riskLevel}</Badge>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => removeFromWatchlist(a.symbol)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {alerts.length > 0 && (
        <div className="border-t border-border bg-muted/10 px-5 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold"><Bell className="h-3 w-3" />{lang === "ar" ? "آخر تنبيهات المراقبة" : "Recent watchlist alerts"}</div>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {alerts.slice(0, 5).map((al) => (
              <li key={al.id} className="flex items-center gap-1.5"><ShieldAlert className="h-3 w-3 text-warning" />{al.message}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
