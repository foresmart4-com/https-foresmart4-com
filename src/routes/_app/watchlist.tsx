import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, Plus, Trash2, Bell, TrendingUp, TrendingDown,
  Brain, Zap, Activity, Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { getMarketData } from "@/lib/market-data";
import { getStocksData } from "@/lib/stocks-data";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { SmartAlertsPanel } from "@/components/ForeSmartPanels";
import { useWatchlist } from "@/lib/watchlistStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/watchlist")({
  component: WatchlistPage,
  head: () => ({
    meta: [
      { title: "Watchlist — ForeSmart" },
      { name: "description", content: "Follow your favorite assets in real time and create one-click price alerts on ForeSmart." },
      { property: "og:title", content: "Watchlist — ForeSmart" },
      { property: "og:description", content: "Track favorite assets live and create alerts in one click." },
      { property: "og:url", content: "https://foresmart4.store/watchlist" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/watchlist" }],
  }),
});

interface Item { id: string; symbol: string; asset_name: string; category: string | null; notes: string | null; }

const CATEGORY_OPTIONS = [
  { value: "stocks",      en: "Stocks",      ar: "أسهم" },
  { value: "crypto",      en: "Crypto",      ar: "كريبتو" },
  { value: "commodities", en: "Commodities", ar: "سلع" },
  { value: "fx",          en: "Forex",       ar: "فوركس" },
  { value: "bonds",       en: "Bonds",       ar: "سندات" },
  { value: "other",       en: "Other",       ar: "أخرى" },
];

function WatchlistPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { items: localItems } = useWatchlist();
  const [items, setItems] = useState<Item[]>([]);
  const [quotes, setQuotes] = useState<Record<string, { price: number; change: number }>>({});
  const [form, setForm] = useState({ symbol: "", asset_name: "", category: "stocks" });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("watchlist_items").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
  };

  const loadQuotes = async () => {
    try {
      const [m, s] = await Promise.all([getMarketData(), getStocksData()]);
      const q: Record<string, { price: number; change: number }> = {};
      m.assets.forEach((a) => (q[a.symbol] = { price: a.price, change: a.changePct }));
      s.stocks.forEach((a) => (q[a.symbol] = { price: a.price, change: a.changePct }));
      setQuotes(q);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); loadQuotes(); }, [user]);

  const add = async () => {
    if (!user || !form.symbol || !form.asset_name) return;
    const { error } = await supabase.from("watchlist_items").insert({
      user_id: user.id, symbol: form.symbol.toUpperCase(), asset_name: form.asset_name, category: form.category,
    });
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم الإضافة" : "Added"); setForm({ symbol: "", asset_name: "", category: form.category }); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from("watchlist_items").delete().eq("id", id);
    load();
  };

  const totalCount = items.length + localItems.length;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
        <div className="gradient-hero absolute inset-0 pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  {ar ? "مراقبة ذكية بالذكاء الاصطناعي" : "AI-Powered Smart Monitoring"}
                </div>
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                  <span className="text-gradient">{ar ? "قائمة المراقبة" : "Watchlist"}</span>
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {ar
                    ? "تابع الأصول المفضلة لحظياً — يرصد AI الحركات ويُنبّهك فور ظهور الفرص."
                    : "Track your assets in real time — AI monitors movements and alerts you the moment opportunities emerge."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm">
                <Bookmark className="h-4 w-4 text-primary" />
                <span className="font-display text-lg font-bold">{totalCount}</span>
                <span className="text-xs text-muted-foreground">{ar ? "أصل" : "assets"}</span>
              </div>
              <Button asChild size="sm" className="gap-2 gradient-primary text-primary-foreground shadow-glow">
                <Link to="/signals"><Zap className="h-3.5 w-3.5" />{ar ? "عرض الإشارات" : "View Signals"}</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{ar ? "تلميح:" : "Tip:"}</span>{" "}
            {ar
              ? "أنشئ تنبيهاً بنقرة واحدة على أي أصل، أو اذهب لصفحة الإشارات لتحليل AI كامل."
              : "Create an alert in one tap on any asset, or visit Signals for a full AI analysis."}
          </p>
        </div>
      </div>

      {/* ─── Add form ─────────────────────────────────────────────────── */}
      <Card className="gradient-card border border-border p-4 shadow-card">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {ar ? "إضافة أصل" : "Add Asset"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{ar ? "الرمز" : "Symbol"}</label>
            <Input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              placeholder="BTC"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{ar ? "الاسم" : "Name"}</label>
            <Input
              value={form.asset_name}
              onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
              placeholder="Bitcoin"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{ar ? "الفئة" : "Category"}</label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{ar ? o.ar : o.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={add} className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" /> {ar ? "إضافة" : "Add"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ─── Items grid ───────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <Eye className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-display text-lg">{ar ? "قائمتك فارغة" : "Your watchlist is empty"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar ? "أضف أصولاً بالنموذج أعلاه لتبدأ المراقبة الذكية." : "Add assets above to start AI-powered monitoring."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const q = quotes[it.symbol];
            const up = q && q.change >= 0;
            const c = q?.change ?? 0;
            const signal = c >= 2 ? "BUY" : c <= -2 ? "SELL" : "HOLD";
            const signalCls =
              signal === "BUY"  ? "bg-success/15 text-success border-success/30" :
              signal === "SELL" ? "bg-danger/15 text-danger border-danger/30"     :
                                  "bg-muted text-muted-foreground border-border";
            const signalLabel = ar
              ? (signal === "BUY" ? "إشارة شراء" : signal === "SELL" ? "إشارة بيع" : "محايد")
              : signal;
            const alertHref = q
              ? `/alerts?symbol=${it.symbol}&price=${q.price}`
              : `/alerts?symbol=${it.symbol}`;

            return (
              <Card key={it.id} className="hover-lift gradient-card border border-border p-4 shadow-card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{it.symbol}</div>
                    <div className="text-xs text-muted-foreground">{it.asset_name}</div>
                    {it.category && (
                      <Badge variant="outline" className="mt-1 text-[10px] capitalize">{it.category}</Badge>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" aria-label={ar ? "حذف" : "Delete"} onClick={() => remove(it.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {q ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <div className="text-xl font-bold">{q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className={cn("text-sm font-medium flex items-center gap-0.5", up ? "text-success" : "text-danger")}>
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {q.change.toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold", signalCls)}>
                        <Bell className="h-3 w-3" />
                        {signalLabel}
                        <span className="text-[10px] opacity-70 ms-1">({c.toFixed(2)}%)</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
                        {ar ? "تحليل محلي" : "Heuristic"}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">{ar ? "لا يوجد سعر مباشر" : "No live quote"}</div>
                )}

                <Button asChild size="sm" variant="outline" className="w-full gap-2">
                  <Link to={alertHref as any}>
                    <Bell className="h-3 w-3" /> {ar ? "إنشاء تنبيه" : "Create alert"}
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Smart panels ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WatchlistPanel />
        <SmartAlertsPanel />
      </div>
    </div>
  );
}
