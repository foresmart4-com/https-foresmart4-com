import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Eye, Plus, Trash2, Bell, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { getMarketData } from "@/lib/market-data";
import { getStocksData } from "@/lib/stocks-data";

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

function WatchlistPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
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
    else { toast.success(lang === "ar" ? "تم الإضافة" : "Added"); setForm({ symbol: "", asset_name: "", category: form.category }); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from("watchlist_items").delete().eq("id", id);
    load();
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Eye className="h-7 w-7 text-primary" /> {lang === "ar" ? "قائمة المتابعة" : "Watchlist"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar" ? "تابع الأصول المفضلة لحظياً وأنشئ تنبيهات بنقرة." : "Track your favorite assets live and create alerts in one click."}
        </p>
      </header>

      <Card className="p-4 grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto] items-end">
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الرمز" : "Symbol"}</label>
          <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder="BTC" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الاسم" : "Name"}</label>
          <Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} placeholder="Bitcoin" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{lang === "ar" ? "الفئة" : "Category"}</label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> {lang === "ar" ? "إضافة" : "Add"}</Button>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const q = quotes[it.symbol];
          const up = q && q.change >= 0;
          return (
            <Card key={it.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{it.symbol}</div>
                  <div className="text-xs text-muted-foreground">{it.asset_name}</div>
                </div>
                <Button size="icon" variant="ghost" aria-label={lang === "ar" ? "حذف" : "Delete"} onClick={() => remove(it.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {q ? (
                <div className="flex items-baseline gap-2">
                  <div className="text-xl font-bold">{q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <div className={"text-sm font-medium flex items-center " + (up ? "text-emerald-500" : "text-rose-500")}>
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {q.change.toFixed(2)}%
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">{lang === "ar" ? "لا يوجد سعر مباشر" : "No live quote"}</div>
              )}
              <Button asChild size="sm" variant="outline" className="w-full gap-2">
                <Link to="/alerts"><Bell className="h-3 w-3" /> {lang === "ar" ? "إنشاء تنبيه" : "Create alert"}</Link>
              </Button>
            </Card>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            {lang === "ar" ? "ابدأ بإضافة أصول لمتابعتها." : "Start by adding assets to track."}
          </div>
        )}
      </div>
    </div>
  );
}
