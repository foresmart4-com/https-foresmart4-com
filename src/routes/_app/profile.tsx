import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User as UserIcon, Key, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Profile & Settings — ForeSmart" },
      { name: "description", content: "Manage your ForeSmart profile, language, preferred currency and personal API keys." },
      { property: "og:title", content: "Profile — ForeSmart" },
      { property: "og:description", content: "Manage your ForeSmart account preferences and API keys." },
      { property: "og:url", content: "https://foresmart4.store/profile" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/profile" }],
  }),
});

interface Profile { display_name: string | null; language: string; preferred_currency: string }
interface ApiKey { id: string; provider: string; api_key: string }

function ProfilePage() {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [p, setP] = useState<Profile>({ display_name: "", language: "ar", preferred_currency: "USD" });
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState({ provider: "alphavantage", api_key: "" });

  const load = async () => {
    if (!user) return;
    const { data: pr } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (pr) setP({ display_name: pr.display_name, language: pr.language, preferred_currency: pr.preferred_currency });
    const { data: ks } = await supabase.from("user_api_keys").select("id, provider, api_key").eq("user_id", user.id);
    if (ks) setKeys(ks as ApiKey[]);
  };
  useEffect(() => { load(); }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: p.display_name,
      language: p.language,
      preferred_currency: p.preferred_currency,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error(error.message);
    else { toast.success(t("saved")); setLang(p.language as "ar" | "en"); }
  };

  const addKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newKey.api_key) return;
    const { error } = await supabase.from("user_api_keys").upsert(
      { user_id: user.id, provider: newKey.provider, api_key: newKey.api_key },
      { onConflict: "user_id,provider" },
    );
    if (error) toast.error(error.message);
    else { toast.success(t("saved")); setNewKey({ ...newKey, api_key: "" }); load(); }
  };

  const removeKey = async (id: string) => {
    await supabase.from("user_api_keys").delete().eq("id", id);
    load();
  };

  const mask = (k: string) => (k.length <= 6 ? "••••" : `${k.slice(0, 3)}••••${k.slice(-3)}`);

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <UserIcon className="h-7 w-7 text-primary" /> {t("profile")}
      </h1>

      <div className="grid gap-6">
        <form onSubmit={saveProfile} className="rounded-xl gradient-card border border-border p-5 shadow-card space-y-4">
          <h2 className="font-display text-lg font-semibold">{t("profile")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t("displayName")}</Label>
              <Input value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("email")}</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div>
              <Label>{t("language")}</Label>
              <Select value={p.language} onValueChange={(v) => setP({ ...p, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("preferredCurrency")}</Label>
              <Select value={p.preferred_currency} onValueChange={(v) => setP({ ...p, preferred_currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD","EUR","GBP","JPY","SAR","AED","EGP","KWD","CHF","CAD","AUD","TRY","CNY"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="gradient-primary text-primary-foreground">{t("save")}</Button>
        </form>

        <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Key className="h-5 w-5 text-primary" /> {t("apiKeys")}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {lang === "ar"
              ? "أضف مفاتيح من خدمات مثل Alpha Vantage أو Twelve Data أو CoinMarketCap لزيادة دقة البيانات."
              : "Add keys from services like Alpha Vantage, Twelve Data, or CoinMarketCap for richer data."}
          </p>
          <form onSubmit={addKey} className="mb-4 grid gap-3 md:grid-cols-[200px_1fr_auto]">
            <Select value={newKey.provider} onValueChange={(v) => setNewKey({ ...newKey, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alphavantage">Alpha Vantage</SelectItem>
                <SelectItem value="twelvedata">Twelve Data</SelectItem>
                <SelectItem value="coinmarketcap">CoinMarketCap</SelectItem>
                <SelectItem value="finnhub">Finnhub</SelectItem>
                <SelectItem value="newsapi">NewsAPI</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={t("apiKey")} value={newKey.api_key} onChange={(e) => setNewKey({ ...newKey, api_key: e.target.value })} />
            <Button type="submit" className="gradient-primary text-primary-foreground">{t("addKey")}</Button>
          </form>
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div>
                  <div className="font-semibold">{k.provider}</div>
                  <div className="text-xs text-muted-foreground font-mono">{mask(k.api_key)}</div>
                </div>
                <Button size="icon" variant="ghost" aria-label={lang === "ar" ? "حذف المفتاح" : "Delete API key"} onClick={() => removeKey(k.id)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </li>
            ))}
            {keys.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
