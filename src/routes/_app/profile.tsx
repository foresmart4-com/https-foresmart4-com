import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  listUserApiKeys,
  removeUserApiKey,
  saveUserApiKey,
  testUserApiKey,
  getApiKeyAudit,
  type UserApiKeyMeta,
  type ApiKeyAuditEntry,
} from "@/lib/apiKeys.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User as UserIcon, Key, Trash2, ShieldCheck, History, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><ProfilePage /></ErrorBoundary>,
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

function ProfilePage() {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [p, setP] = useState<Profile>({ display_name: "", language: "ar", preferred_currency: "USD" });
  const [keys, setKeys] = useState<UserApiKeyMeta[]>([]);
  const [audit, setAudit] = useState<ApiKeyAuditEntry[]>([]);
  const [newKey, setNewKey] = useState({ provider: "alphavantage", api_key: "" });
  const [testing, setTesting] = useState<string | null>(null);
  const listKeysFn = useServerFn(listUserApiKeys);
  const saveKeyFn = useServerFn(saveUserApiKey);
  const removeKeyFn = useServerFn(removeUserApiKey);
  const testKeyFn = useServerFn(testUserApiKey);
  const auditFn = useServerFn(getApiKeyAudit);

  const load = async () => {
    if (!user) return;
    const { data: pr } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (pr) {
      setP({ display_name: pr.display_name, language: pr.language, preferred_currency: pr.preferred_currency });
      // Auto-apply saved language preference on login
      if (pr.language === "ar" || pr.language === "en") setLang(pr.language);
      if (pr.preferred_currency) {
        try { localStorage.setItem("preferred_currency", pr.preferred_currency); } catch {}
      }
    }
    try {
      const [{ keys: keyMeta }, { entries }] = await Promise.all([listKeysFn(), auditFn()]);
      setKeys(keyMeta);
      setAudit(entries);
    } catch (e) {
      // Generic message — server functions already sanitize errors
      console.warn("profile load partial failure", e);
    }
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
    else {
      toast.success(t("saved"));
      setLang(p.language as "ar" | "en");
      try { localStorage.setItem("preferred_currency", p.preferred_currency); } catch {}
    }
  };

  const addKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newKey.api_key) return;
    try {
      await saveKeyFn({ data: { provider: newKey.provider, apiKey: newKey.api_key } });
      toast.success(t("saved"));
      setNewKey({ ...newKey, api_key: "" });
      load();
    } catch {
      toast.error(lang === "ar" ? "تعذّر حفظ المفتاح" : "Unable to save API key");
    }
  };

  const removeKey = async (id: string) => {
    try {
      await removeKeyFn({ data: { id } });
      load();
    } catch {
      toast.error(lang === "ar" ? "تعذّر الحذف" : "Unable to delete");
    }
  };

  const testKey = async (id: string) => {
    setTesting(id);
    try {
      const res = await testKeyFn({ data: { id } });
      toast[res.ok ? "success" : "error"](
        res.ok
          ? (lang === "ar" ? "المفتاح صالح" : "Key valid")
          : (lang === "ar" ? "فشل اختبار المفتاح" : "Key test failed")
      );
      load();
    } catch {
      toast.error(lang === "ar" ? "تعذّر الاختبار" : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString(lang === "ar" ? "ar" : "en") : "—";

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
              ? "المفاتيح مشفّرة AES-256-GCM ولا تُعرض مطلقًا. يتم تسجيل عمليات الإضافة/الحذف/الاختبار في سجل تدقيق خاص بك."
              : "Keys are AES-256-GCM encrypted and never displayed. Add/remove/test actions are recorded in your private audit log."}
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
            <Input placeholder={t("apiKey")} type="password" autoComplete="off" value={newKey.api_key} onChange={(e) => setNewKey({ ...newKey, api_key: e.target.value })} />
            <Button type="submit" className="gradient-primary text-primary-foreground">{t("addKey")}</Button>
          </form>
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                <div className="min-w-0">
                  <div className="font-semibold">{k.provider}</div>
                  <div className="text-xs text-muted-foreground font-mono">{k.key_hint}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {lang === "ar" ? "آخر استخدام:" : "Last used:"} {fmt(k.last_used_at)}
                    {" · "}
                    {lang === "ar" ? "آخر اختبار:" : "Last test:"} {fmt(k.last_test_at)}
                    {k.last_test_result && (
                      <span className={`ms-1 inline-flex items-center gap-1 ${k.last_test_result === "ok" ? "text-success" : "text-danger"}`}>
                        {k.last_test_result === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {k.last_test_result}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={testing === k.id} onClick={() => testKey(k.id)}>
                    <ShieldCheck className="h-4 w-4 me-1" />
                    {lang === "ar" ? "اختبار" : "Test"}
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={lang === "ar" ? "حذف المفتاح" : "Delete API key"} onClick={() => removeKey(k.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </li>
            ))}
            {keys.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">—</li>}
          </ul>
        </div>

        <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <History className="h-5 w-5 text-primary" />
            {lang === "ar" ? "سجل تدقيق المفاتيح" : "API Key Audit Log"}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {lang === "ar"
              ? "آخر 50 عملية. لا يتم حفظ أي محتوى للمفتاح — فقط المزود والوقت والنتيجة."
              : "Last 50 events. No key content is ever stored — only provider, time, and result."}
          </p>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 text-start">{lang === "ar" ? "الوقت" : "Time"}</th>
                  <th className="text-start">{lang === "ar" ? "المزود" : "Provider"}</th>
                  <th className="text-start">{lang === "ar" ? "العملية" : "Action"}</th>
                  <th className="text-start">{lang === "ar" ? "النتيجة" : "Result"}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-b border-border/30">
                    <td className="py-1.5 text-xs">{fmt(a.created_at)}</td>
                    <td className="text-xs font-medium">{a.provider}</td>
                    <td className="text-xs">{a.action}</td>
                    <td className="text-xs">{a.result ?? "—"}</td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-sm text-muted-foreground">—</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
