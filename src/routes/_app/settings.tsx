import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/lib/use-access";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings as SettingsIcon, Globe2, User as UserIcon, Key, Crown, Wallet,
  Building, Link2, Bell, LogOut, ChevronRight, Globe, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang, dir } = useI18n();
  const { isAdmin } = useAccess();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_currency").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.preferred_currency) setCurrency(data.preferred_currency); });
  }, [user]);

  const saveCurrency = async (v: string) => {
    setCurrency(v);
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, preferred_currency: v, updated_at: new Date().toISOString(),
    });
    if (error) toast.error(error.message); else toast.success(t("saved"));
  };

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  const links = [
    { to: "/profile", icon: UserIcon, label: t("profile"), desc: lang === "ar" ? "الاسم والبريد والمعلومات الشخصية" : "Name, email, personal info" },
    { to: "/profile", icon: Key, label: t("apiKeys"), desc: lang === "ar" ? "مفاتيح Alpha Vantage و Twelve Data وغيرها" : "Alpha Vantage, Twelve Data and others" },
    { to: "/subscription", icon: Crown, label: lang === "ar" ? "الاشتراك والفوترة" : "Subscription & Billing", desc: lang === "ar" ? "إدارة خطة الاشتراك وطرق الدفع" : "Manage your plan and payment methods" },
    { to: "/wallet", icon: Wallet, label: lang === "ar" ? "المحفظة" : "Wallet", desc: lang === "ar" ? "الرصيد والمعاملات" : "Balance and transactions" },
    { to: "/bank-accounts", icon: Building, label: lang === "ar" ? "الحسابات البنكية" : "Bank Accounts", desc: lang === "ar" ? "إدارة حساباتك البنكية" : "Manage your bank accounts" },
    { to: "/external-accounts", icon: Link2, label: lang === "ar" ? "الربط الخارجي" : "External Accounts", desc: lang === "ar" ? "الربط مع الوسطاء والمنصات" : "Connect brokers and platforms" },
    { to: "/alerts", icon: Bell, label: t("alerts"), desc: lang === "ar" ? "إدارة تنبيهات الأسعار" : "Manage price alerts" },
  ];

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <SettingsIcon className="h-7 w-7 text-primary" />
        {lang === "ar" ? "الضبط" : "Settings"}
      </h1>

      <div className="grid gap-6">
        {/* Preferences */}
        <section className="rounded-xl gradient-card border border-border p-5 shadow-card space-y-4">
          <h2 className="font-display text-lg font-semibold">
            {lang === "ar" ? "التفضيلات" : "Preferences"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 flex items-center gap-2">
                <Globe2 className="h-4 w-4" />{t("language")}
              </Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "ar" | "en")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("preferredCurrency")}</Label>
              <Select value={currency} onValueChange={saveCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD","EUR","GBP","JPY","SAR","AED","EGP","KWD","CHF","CAD","AUD","TRY","CNY"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="rounded-xl gradient-card border border-border p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold">
            {lang === "ar" ? "إدارة الحساب" : "Account Management"}
          </h2>
          <ul className="divide-y divide-border">
            {links.map((l, i) => (
              <li key={i}>
                <Link
                  to={l.to}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 rounded-md px-2 -mx-2"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <l.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{l.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.desc}</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`} />
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link to="/members" className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 rounded-md px-2 -mx-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{t("members")}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {lang === "ar" ? "إدارة الأعضاء والصلاحيات" : "Manage members and roles"}
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`} />
                </Link>
              </li>
            )}
          </ul>
        </section>

        {/* Danger zone */}
        <section className="rounded-xl border border-border p-5">
          <Button variant="outline" onClick={handleSignOut} className="w-full md:w-auto">
            <LogOut className="h-4 w-4 me-2" />
            {t("logout")}
          </Button>
        </section>
      </div>
    </div>
  );
}
