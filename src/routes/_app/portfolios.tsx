import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/portfolios")({
  component: PortfoliosPage,
});

function PortfoliosPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("portfolios")
      .select("*, portfolio_holdings(*)")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setPortfolios(data ?? []);
  };

  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !name) return;
    setBusy(true);
    const { error } = await supabase.from("portfolios").insert({
      user_id: user.id, name, strategy: strategy || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "ar" ? "تم إنشاء المحفظة" : "Portfolio created");
    setOpen(false); setName(""); setStrategy("");
    load();
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "المحافظ الاستثمارية" : "Investment Portfolios"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "أنشئ محافظ متعددة بحسب استراتيجيتك (نمو، دخل، مضاربة...)." : "Create multiple portfolios per strategy."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> {lang === "ar" ? "محفظة جديدة" : "New portfolio"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "إنشاء محفظة" : "Create portfolio"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم" : "Name"}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "ar" ? "محفظة النمو" : "Growth portfolio"} />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاستراتيجية" : "Strategy"}</Label>
                <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder={lang === "ar" ? "أسهم تكنولوجيا طويلة الأمد" : "Long-term US tech"} />
              </div>
              <Button className="w-full" disabled={!name || busy} onClick={create}>
                {busy ? "..." : (lang === "ar" ? "إنشاء" : "Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {portfolios.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {lang === "ar" ? "لا توجد محافظ بعد. أنشئ أول محفظة لتبدأ." : "No portfolios yet. Create your first one."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {portfolios.map((p: any) => {
            const holdings = p.portfolio_holdings ?? [];
            const totalValue = holdings.reduce((s: number, h: any) => s + Number(h.quantity) * Number(h.avg_price), 0);
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="gradient-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      {p.strategy && <p className="text-xs text-muted-foreground">{p.strategy}</p>}
                    </div>
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground">{lang === "ar" ? "إجمالي التكلفة" : "Total cost basis"}</div>
                    <div className="font-display text-2xl font-bold">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div className="border-t border-border">
                  {holdings.length === 0 ? (
                    <div className="p-5 text-center text-xs text-muted-foreground">
                      {lang === "ar" ? "لا أصول بعد." : "No holdings yet."}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-start">{lang === "ar" ? "الرمز" : "Symbol"}</th>
                          <th className="px-4 py-2 text-end">{lang === "ar" ? "الكمية" : "Qty"}</th>
                          <th className="px-4 py-2 text-end">{lang === "ar" ? "متوسط" : "Avg"}</th>
                          <th className="px-4 py-2 text-end">{lang === "ar" ? "القيمة" : "Value"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h: any) => (
                          <tr key={h.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{h.symbol}<div className="text-[10px] text-muted-foreground">{h.market}</div></td>
                            <td className="px-4 py-2 text-end">{Number(h.quantity).toLocaleString()}</td>
                            <td className="px-4 py-2 text-end">${Number(h.avg_price).toFixed(2)}</td>
                            <td className="px-4 py-2 text-end font-medium">${(Number(h.quantity) * Number(h.avg_price)).toFixed(2)}</td>
                          </tr>
                        ))}
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
