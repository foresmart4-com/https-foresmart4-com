import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Briefcase, Plus, Sprout, Brain, Activity, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { DataStatusBadge } from "@/components/DataStatusBadge";

export const Route = createFileRoute("/_app/portfolios")({
  component: PortfoliosPage,
});

const GROWTH_HOLDINGS = [
  { symbol: "BTC", asset_name: "Bitcoin", market: "crypto", quantity: 0.05, avg_price: 62000 },
  { symbol: "ETH", asset_name: "Ethereum", market: "crypto", quantity: 0.8, avg_price: 2400 },
  { symbol: "NDX", asset_name: "Nasdaq 100", market: "index", quantity: 2, avg_price: 18500 },
  { symbol: "XAU", asset_name: "Gold", market: "metal", quantity: 1.5, avg_price: 2350 },
  { symbol: "SPX", asset_name: "S&P 500", market: "index", quantity: 3, avg_price: 5300 },
];

function PortfoliosPage() {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const ar = lang === "ar";
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*, portfolio_holdings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPortfolios(data ?? []);
    } catch (err: any) {
      console.error("[portfolios] load failed", err);
      setLoadError(err?.message ?? "load_failed");
      toast.error(t("portfolio.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user]);

  const create = async () => {
    if (!user || !name) return;
    setBusy(true);
    const { error } = await supabase.from("portfolios").insert({
      user_id: user.id, name, strategy: strategy || null,
    });
    setBusy(false);
    if (error) {
      console.error("[portfolios] create failed", error);
      toast.error(error.message);
      return;
    }
    toast.success(t("portfolio.created"));
    setOpen(false); setName(""); setStrategy("");
    void load();
  };

  const addGrowth = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: pf, error } = await supabase.from("portfolios").insert({
        user_id: user.id,
        name: t("portfolio.growth.title"),
        strategy: t("portfolio.growth.strategy"),
      }).select("id").single();
      if (error || !pf) throw error ?? new Error("insert_failed");
      const rows = GROWTH_HOLDINGS.map((h) => ({ ...h, user_id: user.id, portfolio_id: pf.id, currency: "USD" }));
      const { error: hErr } = await supabase.from("portfolio_holdings").insert(rows);
      if (hErr) console.warn("[portfolios] growth holdings insert failed", hErr);
      toast.success(t("portfolio.growth.added"));
      await load();
    } catch (err: any) {
      console.error("[portfolios] growth add failed", err);
      toast.error(t("portfolio.loadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
        <div className="gradient-hero absolute inset-0 pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  {ar ? "إدارة المحافظ بالذكاء الاصطناعي" : "AI-Powered Portfolio Management"}
                </div>
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                  <span className="text-gradient">{ar ? "المحافظ الاستثمارية" : "Portfolios"}</span>
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {ar
                    ? "تتبع محافظك وحللها. القيم تعتمد على متوسط سعر الشراء وليست أسعاراً لحظية."
                    : "Track and analyze your holdings. Values based on average entry price, not live market prices."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="font-display text-lg font-bold">{portfolios.length}</span>
                <span className="text-xs text-muted-foreground">{ar ? "محفظة" : "portfolios"}</span>
              </div>
              <Button asChild size="sm" className="gap-2 gradient-primary text-primary-foreground shadow-glow">
                <Link to="/portfolio-ai"><Brain className="h-3.5 w-3.5" />{ar ? "تحليل AI" : "AI Analysis"}</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{ar ? "تلميح:" : "Tip:"}</span>
            {ar ? "استخدم 'إضافة محفظة نمو' لبدء سريع بأصول نموذجية." : "Use 'Add Growth Portfolio' for a quick start with sample holdings."}
            <DataStatusBadge status="mock" className="ms-auto" />
          </div>
        </div>
      </div>

      {/* ─── Action bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" className="gap-2" disabled={busy || !user} onClick={addGrowth}>
          <Sprout className="h-4 w-4 text-emerald-500" /> {t("portfolio.addGrowth")}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> {t("portfolio.new")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("portfolio.create")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("portfolio.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("portfolio.namePlaceholder")} />
              </div>
              <div>
                <Label className="text-xs">{t("portfolio.strategy")}</Label>
                <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder={t("portfolio.strategyPlaceholder")} />
              </div>
              <Button className="w-full" disabled={!name || busy} onClick={create}>
                {busy ? "..." : t("common.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── Content ──────────────────────────────────────────────────── */}
      {loading ? (
        <Card className="gradient-card border border-border p-12 text-center text-sm text-muted-foreground shadow-card">
          {t("common.loading")}
        </Card>
      ) : loadError ? (
        <Card className="gradient-card border border-border p-8 text-center shadow-card">
          <p className="text-sm text-destructive">{t("portfolio.loadFailed")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>{t("common.retry")}</Button>
        </Card>
      ) : portfolios.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-display text-lg">{ar ? "لا توجد محافظ بعد" : "No portfolios yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("portfolio.empty")}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={addGrowth} disabled={busy}>
            <Sprout className="h-4 w-4 text-emerald-500" /> {t("portfolio.addGrowth")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {portfolios.map((p: any) => {
            const holdings = p.portfolio_holdings ?? [];
            const totalValue = holdings.reduce((s: number, h: any) => s + Number(h.quantity) * Number(h.avg_price), 0);
            const positions = holdings.length;
            const weights = holdings.map((h: any) => totalValue > 0 ? (Number(h.quantity) * Number(h.avg_price)) / totalValue : 0);
            const hhi = weights.reduce((a: number, w: number) => a + w * w, 0);
            const diversification = totalValue > 0 ? Math.round((1 - hhi) * 100) : 0;
            const riskScore = positions === 0 ? 0 : Math.min(100, Math.round(100 / Math.max(1, positions) * 2));
            return (
              <Card key={p.id} className="hover-lift gradient-card overflow-hidden border border-border shadow-card">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      {p.strategy && <p className="text-xs text-muted-foreground">{p.strategy}</p>}
                    </div>
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground">{t("portfolio.cost")}</div>
                    <div className="font-display text-2xl font-bold">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-background/40 p-2">
                      <div className="text-muted-foreground">{t("portfolio.assets")}</div>
                      <div className="font-bold text-base">{positions}</div>
                    </div>
                    <div className="rounded-lg bg-background/40 p-2">
                      <div className="text-muted-foreground">{t("portfolio.diversification")}</div>
                      <div className="font-bold text-base text-success">{diversification}%</div>
                    </div>
                    <div className="rounded-lg bg-background/40 p-2">
                      <div className="text-muted-foreground">{t("portfolio.risk")}</div>
                      <div className="font-bold text-base text-warning">{riskScore}</div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border">
                  {holdings.length === 0 ? (
                    <div className="p-5 text-center text-xs text-muted-foreground">{t("portfolio.noHoldings")}</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-start">{t("symbol")}</th>
                          <th className="px-4 py-2 text-end">{t("portfolio.qty")}</th>
                          <th className="px-4 py-2 text-end">{t("portfolio.avg")}</th>
                          <th className="px-4 py-2 text-end">{t("portfolio.weight")}</th>
                          <th className="px-4 py-2 text-end">{t("portfolio.value")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h: any) => {
                          const v = Number(h.quantity) * Number(h.avg_price);
                          const w = totalValue > 0 ? (v / totalValue) * 100 : 0;
                          return (
                            <tr key={h.id} className="border-t border-border">
                              <td className="px-4 py-2 font-medium">{h.symbol}<div className="text-[10px] text-muted-foreground">{h.market}</div></td>
                              <td className="px-4 py-2 text-end">{Number(h.quantity).toLocaleString()}</td>
                              <td className="px-4 py-2 text-end">${Number(h.avg_price).toFixed(2)}</td>
                              <td className="px-4 py-2 text-end">{w.toFixed(1)}%</td>
                              <td className="px-4 py-2 text-end font-medium">${v.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
