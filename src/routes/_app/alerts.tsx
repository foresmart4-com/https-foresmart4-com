import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/alerts")({
  component: AlertsPage,
});

interface Alert {
  id: string; symbol: string; asset_name: string;
  condition: string; target_price: number; active: boolean;
  triggered_at: string | null; created_at: string;
}

function AlertsPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [form, setForm] = useState({ symbol: "BTC", asset_name: "Bitcoin", condition: "above", target_price: "" });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    if (data) setAlerts(data as Alert[]);
  };
  useEffect(() => { load(); }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const price = parseFloat(form.target_price);
    if (!price) return;
    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      symbol: form.symbol,
      asset_name: form.asset_name,
      condition: form.condition,
      target_price: price,
    });
    if (error) toast.error(error.message);
    else { toast.success(t("saved")); setForm({ ...form, target_price: "" }); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    load();
  };

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <h1 className="mb-6 font-display text-3xl font-bold flex items-center gap-2">
        <Bell className="h-7 w-7 text-primary" /> {t("alerts")}
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={create} className="rounded-xl gradient-card border border-border p-5 shadow-card space-y-4">
          <h2 className="font-display text-lg font-semibold">{t("createAlert")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("symbol")}</Label>
              <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} required />
            </div>
            <div>
              <Label>{t("asset")}</Label>
              <Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("condition")}</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">{t("above")}</SelectItem>
                  <SelectItem value="below">{t("below")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("targetPrice")}</Label>
              <Input type="number" step="any" value={form.target_price} onChange={(e) => setForm({ ...form, target_price: e.target.value })} required />
            </div>
          </div>
          <Button type="submit" className="w-full gradient-primary text-primary-foreground">{t("save")}</Button>
        </form>

        <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold">{t("yourAlerts")}</h2>
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noAlerts")}</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <div>
                    <div className="font-semibold">{a.symbol} <span className="text-xs text-muted-foreground">— {a.asset_name}</span></div>
                    <div className="text-xs text-muted-foreground">
                      {t(a.condition === "above" ? "above" : "below")} {a.target_price.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded px-2 py-0.5 text-xs", a.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {a.active ? (lang === "ar" ? "نشط" : "active") : (lang === "ar" ? "خامل" : "inactive")}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
