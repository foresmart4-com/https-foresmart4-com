import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useWatchlist, removeFromWatchlist, pushAlert, addToWatchlist } from "@/lib/watchlistStore";
import { generateTradingDecision, type AssetContext, type TradingDecision } from "@/lib/marketIntelligence";
import { addJournalEntry } from "@/lib/tradingJournal";
import { DataStatusBadge } from "@/components/DataStatusBadge";
import { Bookmark, Trash2, Plus, Bell, ShieldAlert, TrendingUp, TrendingDown, Activity, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function WatchlistPanel() {
  const { lang } = useI18n();
  const { items, alerts } = useWatchlist();
  const seen = useRef<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { d: TradingDecision; at: number }>>({});

  const decisions = useMemo(() => items.map((a) => {
    const ctx: AssetContext = { symbol: a.symbol, name_ar: a.name, category: a.category as any, price: a.price, change24h: a.change24h, currency: a.currency };
    const fresh = overrides[a.symbol];
    return { a, d: fresh?.d ?? generateTradingDecision(ctx), updatedAt: fresh?.at ?? a.addedAt };
  }), [items, overrides]);

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
      }
    }
  }, [decisions, lang]);

  const analyzeNow = (symbol: string) => {
    const a = items.find((x) => x.symbol === symbol);
    if (!a) return;
    const ctx: AssetContext = { symbol: a.symbol, name_ar: a.name, category: a.category as any, price: a.price, change24h: a.change24h, currency: a.currency };
    const d = generateTradingDecision(ctx);
    setOverrides((o) => ({ ...o, [symbol]: { d, at: Date.now() } }));
    addJournalEntry({
      asset: symbol, type: "ai_decision", side: d.action === "SELL" || d.action === "STOP_LOSS" ? "sell" : "buy",
      entry: a.price, reasonIn: `${d.action} ${d.confidence}% · ${d.riskLevel}`,
    });
    toast.success(lang === "ar" ? `تم تحديث تحليل ${symbol}` : `Updated analysis for ${symbol}`);
  };

  const addToPortfolio = (symbol: string) => {
    toast.info(lang === "ar"
      ? `لإضافة ${symbol} للمحفظة استخدم نموذج العمليات اليدوية`
      : `Use the manual operation form to add ${symbol}`);
  };

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
        {items.length === 0 && (
          <div className="p-8 text-center">
            <Bookmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <div className="font-semibold">{lang === "ar" ? "لا توجد أصول للمتابعة" : "No watched assets"}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar" ? "أضف أصلاً لبدء تحليل AI مباشر." : "Add an asset to start live AI analysis."}
            </p>
            <Button size="sm" className="mt-3 gap-1" onClick={() => {
              const ok = addToWatchlist({ symbol: "BTC", name: "Bitcoin", category: "crypto", price: 64800, change24h: -0.74, currency: "USD" });
              toast[ok ? "success" : "info"](ok ? "BTC" : "Exists");
            }}><Plus className="h-3 w-3" />{lang === "ar" ? "ابدأ بـ BTC" : "Start with BTC"}</Button>
          </div>
        )}
        {decisions.map(({ a, d, updatedAt }) => (
          <div key={a.symbol} className="space-y-2 px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold">{a.symbol}
                  <DataStatusBadge status={a.category === "crypto" ? "live" : "mock"} />
                </div>
                <div className="text-[10px] text-muted-foreground">{a.name} · {a.currency}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="font-medium">{a.price.toLocaleString()}</div>
                <div className={cn("inline-flex items-center gap-0.5", a.change24h >= 0 ? "text-success" : "text-danger")}>
                  {a.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {a.change24h.toFixed(2)}%
                </div>
                <Badge variant="outline" className={cn("text-[10px]",
                  d.action === "BUY" && "border-success/40 text-success",
                  (d.action === "SELL" || d.action === "STOP_LOSS") && "border-danger/40 text-danger",
                  d.action === "HOLD" && "border-warning/40 text-warning")}>{d.action} · {d.confidence}%</Badge>
                <Badge variant="outline" className={cn("text-[10px]",
                  d.riskLevel === "HIGH" && "border-danger/40 text-danger",
                  d.riskLevel === "MEDIUM" && "border-warning/40 text-warning",
                  d.riskLevel === "LOW" && "border-success/40 text-success")}>{d.riskLevel}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground sm:grid-cols-4">
              <div>Score: <span className="font-semibold text-foreground">{d.decisionScore ?? "—"}</span></div>
              <div>SL: <span className="font-semibold text-danger">{d.suggestedStopLoss?.toFixed(2) ?? "—"}</span></div>
              <div>TP: <span className="font-semibold text-success">{d.suggestedTakeProfit?.toFixed(2) ?? "—"}</span></div>
              <div>{lang === "ar" ? "آخر تحديث" : "Updated"}: <span className="text-foreground">{new Date(updatedAt).toLocaleTimeString()}</span></div>
            </div>
            {(d.action === "STOP_LOSS" || d.riskLevel === "HIGH") && (
              <div className="flex items-center gap-1 rounded border border-danger/30 bg-danger/5 px-2 py-1 text-[11px] text-danger">
                <ShieldAlert className="h-3 w-3" />
                {lang === "ar" ? "تنبيه: مخاطر عالية أو وقف خسارة مفعّل" : "Alert: high risk or stop-loss triggered"}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => analyzeNow(a.symbol)}>
                <Activity className="h-3 w-3" />{lang === "ar" ? "تحليل الآن" : "Analyze now"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => addToPortfolio(a.symbol)}>
                <Wallet className="h-3 w-3" />{lang === "ar" ? "إضافة للمحفظة" : "Add to portfolio"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px] text-muted-foreground" onClick={() => { removeFromWatchlist(a.symbol); toast.success(lang === "ar" ? "أُزيل" : "Removed"); }}>
                <Trash2 className="h-3 w-3" />{lang === "ar" ? "إزالة" : "Remove"}
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
