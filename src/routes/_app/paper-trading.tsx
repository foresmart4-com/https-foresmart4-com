import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getMarketData } from "@/lib/market-data";
import { getStocksData, REGION_LABELS, type StockRegion } from "@/lib/stocks-data";

type Kind = "stocks" | "crypto" | "metals" | "bonds" | "currencies";


export const Route = createFileRoute("/_app/paper-trading")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><PaperTradingPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Paper Trading — ForeSmart" },
      { name: "description", content: "Practice trading risk-free with $100,000 in virtual cash. Track open positions, P&L and history on ForeSmart." },
      { property: "og:title", content: "Paper Trading — ForeSmart" },
      { property: "og:description", content: "Risk-free trading simulator with virtual cash." },
      { property: "og:url", content: "https://foresmart4.store/paper-trading" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/paper-trading" }],
  }),
});

const STARTING_CASH = 100000;

interface Trade { id: string; symbol: string; asset_name: string; side: "buy" | "sell"; quantity: number; price: number; status: "open" | "closed"; pnl: number | null; opened_at: string; closed_at: string | null; closed_price: number | null; }

function PaperTradingPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [cash, setCash] = useState<number>(STARTING_CASH);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [quotes, setQuotes] = useState<Record<string, { price: number; name: string }>>({});
  const [kind, setKind] = useState<Kind>("stocks");
  const [region, setRegion] = useState<StockRegion>("us");
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [qty, setQty] = useState("10");
  const [marketAssets, setMarketAssets] = useState<{ symbol: string; name: string; price: number; category: string }[]>([]);
  const [stockAssets, setStockAssets] = useState<{ symbol: string; name: string; price: number; region: StockRegion }[]>([]);


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
      const q: Record<string, { price: number; name: string }> = {};
      m.assets.forEach((a) => (q[a.symbol] = { price: a.price, name: a.name }));
      s.stocks.forEach((a) => (q[a.symbol] = { price: a.price, name: a.name }));
      setQuotes(q);
      setMarketAssets(m.assets.map((a) => ({ symbol: a.symbol, name: a.name, price: a.price, category: a.category })));
      setStockAssets(s.stocks.map((a) => ({ symbol: a.symbol, name: a.name, price: a.price, region: a.region })));
    } catch { /* ignore */ }
  };

  useEffect(() => { ensureBalance(); loadTrades(); loadQuotes(); }, [user]);

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");

  const priceOf = (sym: string, fallback: number) => quotes[sym]?.price ?? fallback;

  const portfolioValue = useMemo(() => {
    return openTrades.reduce((sum, t) => sum + priceOf(t.symbol, Number(t.price)) * Number(t.quantity), 0);
  }, [openTrades, quotes]);

  const realizedPnl = closedTrades.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  const unrealizedPnl = openTrades.reduce((s, t) => {
    const cur = priceOf(t.symbol, Number(t.price));
    return s + (cur - Number(t.price)) * Number(t.quantity) * (t.side === "buy" ? 1 : -1);
  }, 0);
  const totalEquity = cash + portfolioValue;
  const totalReturnPct = ((totalEquity + realizedPnl - STARTING_CASH) / STARTING_CASH) * 100;

  const currentOptions = useMemo(() => {
    if (kind === "stocks") return stockAssets.filter((a) => a.region === region).map((a) => ({ symbol: a.symbol, name: a.name, price: a.price }));
    const cat = kind === "currencies" ? "currencies" : kind;
    return marketAssets.filter((a) => a.category === cat).map((a) => ({ symbol: a.symbol, name: a.name, price: a.price }));
  }, [kind, region, stockAssets, marketAssets]);

  const selectedAsset = currentOptions.find((o) => o.symbol === symbol) ?? currentOptions[0];

  const placeTrade = async (side: "buy" | "sell") => {
    if (!user) return;
    const qtyNum = parseFloat(qty);
    if (!selectedAsset || !qtyNum) { toast.error(lang === "ar" ? "اختر أصلاً وكمية" : "Pick an asset and quantity"); return; }
    const price = selectedAsset.price;
    const cost = qtyNum * price;
    if (side === "buy" && cost > cash) { toast.error(lang === "ar" ? "رصيد غير كافٍ" : "Insufficient balance"); return; }
    const { error } = await supabase.from("paper_trades").insert({
      user_id: user.id, symbol: selectedAsset.symbol, asset_name: selectedAsset.name,
      side, quantity: qtyNum, price, status: "open",
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("paper_balances").update({ cash_usd: cash - (side === "buy" ? cost : -cost), updated_at: new Date().toISOString() }).eq("user_id", user.id);
    toast.success(lang === "ar" ? "تم تنفيذ الصفقة" : "Trade executed");
    ensureBalance(); loadTrades();
  };

  const closeTrade = async (t: Trade) => {
    if (!user) return;
    const cur = priceOf(t.symbol, Number(t.price));
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

      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">{lang === "ar" ? "النوع" : "Type"}</label>
            <Select value={kind} onValueChange={(v) => { setKind(v as Kind); setSymbol(""); }}>
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
          <div className={kind === "stocks" ? "md:col-span-1" : "md:col-span-2"}>
            <label className="text-xs text-muted-foreground">{lang === "ar" ? "الأصل" : "Asset"}</label>
            <Select value={selectedAsset?.symbol ?? ""} onValueChange={setSymbol}>
              <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر..." : "Choose..."} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {currentOptions.map((o) => (
                  <SelectItem key={o.symbol} value={o.symbol}>
                    {o.symbol} — {o.name} (${o.price.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{lang === "ar" ? "الكمية" : "Quantity"}</label>
            <Input type="number" min="0" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-emerald-500 hover:bg-emerald-600 gap-1" onClick={() => placeTrade("buy")}>
            <TrendingUp className="h-4 w-4" /> {lang === "ar" ? "شراء" : "Buy"}
          </Button>
          <Button variant="outline" className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 gap-1" onClick={() => placeTrade("sell")}>
            <TrendingDown className="h-4 w-4" /> {lang === "ar" ? "بيع" : "Sell"}
          </Button>
          {selectedAsset && (
            <span className="ms-auto self-center text-xs text-muted-foreground">
              {lang === "ar" ? "الإجمالي" : "Total"}: <span className="font-semibold text-foreground">${((parseFloat(qty) || 0) * selectedAsset.price).toFixed(2)}</span>
            </span>
          )}
        </div>
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
                const cur = priceOf(t.symbol, Number(t.price));
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
