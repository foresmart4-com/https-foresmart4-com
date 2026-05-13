import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getMarketData } from "@/lib/market-data";
import { getStocksData } from "@/lib/stocks-data";

export const Route = createFileRoute("/_app/paper-trading")({ component: PaperTradingPage });

const STARTING_CASH = 100000;

interface Trade { id: string; symbol: string; asset_name: string; side: "buy" | "sell"; quantity: number; price: number; status: "open" | "closed"; pnl: number | null; opened_at: string; closed_at: string | null; closed_price: number | null; }

function PaperTradingPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [cash, setCash] = useState<number>(STARTING_CASH);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ symbol: "AAPL", asset_name: "Apple", quantity: "10" });

  const ensureBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from("paper_balances").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) {
      await supabase.from("paper_balances").insert({ user_id: user.id, cash_usd: STARTING_CASH });
      setCash(STARTING_CASH);
    } else {
      setCash(Number(data.cash_usd));
    }
  };

  const loadTrades = async () => {
    if (!user) return;
    const { data } = await supabase.from("paper_trades").select("*").order("opened_at", { ascending: false });
    setTrades((data ?? []) as Trade[]);
  };

  const loadQuotes = async () => {
    try {
      const [m, s] = await Promise.all([getMarketData(), getStocksData()]);
      const q: Record<string, number> = {};
      m.assets.forEach((a) => (q[a.symbol] = a.price));
      s.stocks.forEach((a) => (q[a.symbol] = a.price));
      setQuotes(q);
    } catch { /* ignore */ }
  };

  useEffect(() => { ensureBalance(); loadTrades(); loadQuotes(); }, [user]);

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");

  const portfolioValue = useMemo(() => {
    return openTrades.reduce((sum, t) => sum + (quotes[t.symbol] ?? t.price) * Number(t.quantity), 0);
  }, [openTrades, quotes]);

  const realizedPnl = closedTrades.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  const unrealizedPnl = openTrades.reduce((s, t) => {
    const cur = quotes[t.symbol] ?? t.price;
    return s + (cur - Number(t.price)) * Number(t.quantity) * (t.side === "buy" ? 1 : -1);
  }, 0);
  const totalEquity = cash + portfolioValue;
  const totalReturnPct = ((totalEquity + realizedPnl - STARTING_CASH) / STARTING_CASH) * 100;

  const placeTrade = async (side: "buy" | "sell") => {
    if (!user) return;
    const qty = parseFloat(form.quantity);
    const price = quotes[form.symbol.toUpperCase()];
    if (!qty || !price) { toast.error(lang === "ar" ? "رمز غير معروف" : "Unknown symbol"); return; }
    const cost = qty * price;
    if (side === "buy" && cost > cash) { toast.error(lang === "ar" ? "رصيد غير كافٍ" : "Insufficient balance"); return; }
    const { error } = await supabase.from("paper_trades").insert({
      user_id: user.id, symbol: form.symbol.toUpperCase(), asset_name: form.asset_name,
      side, quantity: qty, price, status: "open",
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("paper_balances").update({ cash_usd: cash - (side === "buy" ? cost : -cost), updated_at: new Date().toISOString() }).eq("user_id", user.id);
    toast.success(lang === "ar" ? "تم تنفيذ الصفقة" : "Trade executed");
    ensureBalance(); loadTrades();
  };

  const closeTrade = async (t: Trade) => {
    if (!user) return;
    const cur = quotes[t.symbol] ?? t.price;
    const pnl = (cur - Number(t.price)) * Number(t.quantity) * (t.side === "buy" ? 1 : -1);
    const proceeds = cur * Number(t.quantity) * (t.side === "buy" ? 1 : -1);
    await supabase.from("paper_trades").update({
      status: "closed", pnl, closed_at: new Date().toISOString(), closed_price: cur,
    }).eq("id", t.id);
    await supabase.from("paper_balances").update({ cash_usd: cash + proceeds, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    ensureBalance(); loadTrades();
  };

  const reset = async () => {
    if (!user) return;
    if (!confirm(lang === "ar" ? "إعادة ضبط المحاكي؟" : "Reset simulator?")) return;
    await supabase.from("paper_trades").delete().eq("user_id", user.id);
    await supabase.from("paper_balances").update({ cash_usd: STARTING_CASH, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    ensureBalance(); loadTrades();
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" /> {lang === "ar" ? "محاكي التداول" : "Paper Trading"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ar" ? "تدرب بأموال افتراضية بدون مخاطر." : "Practice with virtual cash, no risk."}
          </p>
        </div>
        <Button variant="outline" onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> {lang === "ar" ? "إعادة ضبط" : "Reset"}</Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{lang === "ar" ? "النقد" : "Cash"}</div>
          <div className="font-display text-xl font-bold">${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{lang === "ar" ? "قيمة المحفظة" : "Holdings value"}</div>
          <div className="font-display text-xl font-bold">${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{lang === "ar" ? "الأرباح غير المحققة" : "Unrealized P&L"}</div>
          <div className={"font-display text-xl font-bold " + (unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{lang === "ar" ? "إجمالي العائد" : "Total return"}</div>
          <div className={"font-display text-xl font-bold " + (totalReturnPct >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%
          </div>
        </Card>
      </div>

      <Card className="p-4 grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto_auto] items-end">
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الرمز" : "Symbol"}</label>
          <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الاسم" : "Name"}</label>
          <Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الكمية" : "Quantity"}</label>
          <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600 gap-1" onClick={() => placeTrade("buy")}>
          <TrendingUp className="h-4 w-4" /> {lang === "ar" ? "شراء" : "Buy"}
        </Button>
        <Button variant="outline" className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 gap-1" onClick={() => placeTrade("sell")}>
          <TrendingDown className="h-4 w-4" /> {lang === "ar" ? "بيع" : "Sell"}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">{lang === "ar" ? "صفقات مفتوحة" : "Open positions"}</div>
        {openTrades.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">{lang === "ar" ? "لا توجد صفقات مفتوحة" : "No open trades"}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase">
              <tr>
                <th className="p-3 text-start">{lang === "ar" ? "الرمز" : "Symbol"}</th>
                <th className="p-3 text-start">{lang === "ar" ? "النوع" : "Side"}</th>
                <th className="p-3 text-end">Qty</th>
                <th className="p-3 text-end">{lang === "ar" ? "سعر الدخول" : "Entry"}</th>
                <th className="p-3 text-end">{lang === "ar" ? "السعر الحالي" : "Current"}</th>
                <th className="p-3 text-end">P&L</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map((t) => {
                const cur = quotes[t.symbol] ?? Number(t.price);
                const pnl = (cur - Number(t.price)) * Number(t.quantity) * (t.side === "buy" ? 1 : -1);
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{t.symbol}</td>
                    <td className="p-3"><Badge variant={t.side === "buy" ? "default" : "secondary"}>{t.side}</Badge></td>
                    <td className="p-3 text-end">{Number(t.quantity)}</td>
                    <td className="p-3 text-end">${Number(t.price).toFixed(2)}</td>
                    <td className="p-3 text-end">${cur.toFixed(2)}</td>
                    <td className={"p-3 text-end font-medium " + (pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </td>
                    <td className="p-3 text-end">
                      <Button size="sm" variant="outline" onClick={() => closeTrade(t)}>{lang === "ar" ? "إغلاق" : "Close"}</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {closedTrades.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">{lang === "ar" ? "السجل" : "History"}</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase">
              <tr>
                <th className="p-3 text-start">{lang === "ar" ? "الرمز" : "Symbol"}</th>
                <th className="p-3 text-start">Side</th>
                <th className="p-3 text-end">Qty</th>
                <th className="p-3 text-end">Entry → Exit</th>
                <th className="p-3 text-end">P&L</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{t.symbol}</td>
                  <td className="p-3">{t.side}</td>
                  <td className="p-3 text-end">{Number(t.quantity)}</td>
                  <td className="p-3 text-end text-muted-foreground">${Number(t.price).toFixed(2)} → ${Number(t.closed_price ?? 0).toFixed(2)}</td>
                  <td className={"p-3 text-end font-medium " + (Number(t.pnl ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {Number(t.pnl ?? 0) >= 0 ? "+" : ""}${Number(t.pnl ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
