import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listExternalAccounts, addExternalAccount, removeExternalAccount } from "@/lib/external-accounts.functions";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Bitcoin, Building2, Briefcase, Trash2, Plus, Link2, Shield } from "lucide-react";

export const Route = createFileRoute("/_app/external-accounts")({
  component: ExternalAccountsPage,
});

type Provider = "crypto_wallet" | "lean" | "snaptrade";

const PROVIDER_META: Record<Provider, { ar: string; en: string; icon: any; desc: { ar: string; en: string } }> = {
  crypto_wallet: {
    ar: "محافظ العملات الرقمية", en: "Crypto Wallets", icon: Bitcoin,
    desc: { ar: "اربط MetaMask / Trust / Phantom لمتابعة أرصدتك (قراءة فقط).", en: "Link MetaMask / Trust / Phantom to track balances (read-only)." },
  },
  lean: {
    ar: "بنوك الخليج (Lean)", en: "Gulf Banks (Lean)", icon: Building2,
    desc: { ar: "Open Banking للسعودية والإمارات. يحتاج مفاتيح Lean Technologies.", en: "Open Banking for KSA & UAE. Requires Lean Technologies API keys." },
  },
  snaptrade: {
    ar: "حسابات الوساطة (SnapTrade)", en: "Brokerage (SnapTrade)", icon: Briefcase,
    desc: { ar: "اقرأ مراكزك من Interactive Brokers, Robinhood, Questrade وغيرها.", en: "Read positions from IBKR, Robinhood, Questrade, and more." },
  },
};

function ExternalAccountsPage() {
  const { lang } = useI18n();
  const qc = useQueryClient();

  const { data: accounts = [] } = useQuery({ queryKey: ["external_accounts"], queryFn: () => listExternalAccounts() });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeExternalAccount({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["external_accounts"] }); toast.success(lang === "ar" ? "تم الحذف" : "Removed"); },
  });

  const grouped = (p: Provider) => accounts.filter((a: any) => a.provider === p);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "المحافظ والحسابات الخارجية" : "External Wallets & Accounts"}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "اربط محافظك وحساباتك الخارجية لرؤية أصولك في مكان واحد."
            : "Link your external wallets and accounts to see all your assets in one place."}
        </p>
      </header>

      <Card className="border-primary/20 bg-primary/5 p-4">
        <div className="flex gap-3 text-sm">
          <Shield className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            {lang === "ar"
              ? "نخزّن العناوين العامة فقط ولا نطلب أبداً مفاتيحك الخاصة (Private Keys / Seed). الربط للقراءة فقط."
              : "We only store public addresses — never your private keys or seed phrases. Read-only access."}
          </p>
        </div>
      </Card>

      <Tabs defaultValue="crypto_wallet" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          {(Object.keys(PROVIDER_META) as Provider[]).map((p) => {
            const M = PROVIDER_META[p];
            return (
              <TabsTrigger key={p} value={p} className="gap-2">
                <M.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{lang === "ar" ? M.ar : M.en}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(PROVIDER_META) as Provider[]).map((p) => (
          <TabsContent key={p} value={p} className="space-y-4">
            <ProviderPanel
              provider={p}
              accounts={grouped(p)}
              onAdd={async (payload) => {
                await addExternalAccount({ data: { provider: p, ...payload } });
                qc.invalidateQueries({ queryKey: ["external_accounts"] });
                toast.success(lang === "ar" ? "تمت الإضافة" : "Added");
              }}
              onRemove={(id) => removeMut.mutate(id)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ProviderPanel({
  provider, accounts, onAdd, onRemove,
}: {
  provider: Provider;
  accounts: any[];
  onAdd: (p: any) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const { lang } = useI18n();
  const M = PROVIDER_META[provider];
  const Icon = M.icon;

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
      <Card className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">{lang === "ar" ? M.ar : M.en}</h2>
            <p className="text-xs text-muted-foreground">{lang === "ar" ? M.desc.ar : M.desc.en}</p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد حسابات مربوطة بعد." : "No linked accounts yet."}
          </div>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.label || a.address || a.external_id || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.network && <span className="me-2">{a.network}</span>}
                    {a.address && <code className="text-[11px]">{a.address.slice(0, 10)}…{a.address.slice(-6)}</code>}
                    {a.currency && <span className="ms-2">{a.currency}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(a.id)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4" /> {lang === "ar" ? "ربط جديد" : "Add new"}
        </h3>
        {provider === "crypto_wallet" ? <CryptoForm onAdd={onAdd} /> : <ManualForm provider={provider} onAdd={onAdd} />}
      </Card>
    </div>
  );
}

function CryptoForm({ onAdd }: { onAdd: (p: any) => Promise<void> }) {
  const { lang } = useI18n();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [busy, setBusy] = useState(false);

  const connectMetaMask = async () => {
    const eth = (window as any).ethereum;
    if (!eth) { toast.error(lang === "ar" ? "MetaMask غير مثبت" : "MetaMask not installed"); return; }
    try {
      const accs: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (accs?.[0]) { setAddress(accs[0]); setNetwork("ethereum"); toast.success(lang === "ar" ? "تم الاتصال" : "Connected"); }
    } catch (e: any) { toast.error(e.message); }
  };

  const submit = async () => {
    if (!address) { toast.error(lang === "ar" ? "أدخل العنوان" : "Address required"); return; }
    setBusy(true);
    try {
      await onAdd({ label: label || `${network} wallet`, address, network });
      setLabel(""); setAddress("");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" className="w-full gap-2" onClick={connectMetaMask}>
        <Link2 className="h-4 w-4" /> {lang === "ar" ? "اتصال عبر MetaMask" : "Connect via MetaMask"}
      </Button>
      <div className="text-center text-xs text-muted-foreground">— {lang === "ar" ? "أو يدوياً" : "or manually"} —</div>
      <div>
        <Label className="text-xs">{lang === "ar" ? "الشبكة" : "Network"}</Label>
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ethereum">Ethereum</SelectItem>
            <SelectItem value="bsc">BNB Chain</SelectItem>
            <SelectItem value="polygon">Polygon</SelectItem>
            <SelectItem value="solana">Solana</SelectItem>
            <SelectItem value="bitcoin">Bitcoin</SelectItem>
            <SelectItem value="tron">Tron</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">{lang === "ar" ? "العنوان العام" : "Public address"}</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x... / bc1... / ..." />
      </div>
      <div>
        <Label className="text-xs">{lang === "ar" ? "اسم مستعار (اختياري)" : "Label (optional)"}</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={lang === "ar" ? "محفظتي الرئيسية" : "My main wallet"} />
      </div>
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "..." : (lang === "ar" ? "حفظ" : "Save")}
      </Button>
    </div>
  );
}

function ManualForm({ provider, onAdd }: { provider: Provider; onAdd: (p: any) => Promise<void> }) {
  const { lang } = useI18n();
  const [label, setLabel] = useState("");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);

  const isLean = provider === "lean";
  const placeholder = isLean
    ? (lang === "ar" ? "البنك الأهلي / الراجحي / ENBD..." : "SNB / Al Rajhi / ENBD...")
    : (lang === "ar" ? "Interactive Brokers / Robinhood..." : "Interactive Brokers / Robinhood...");

  const submit = async () => {
    if (!label) { toast.error(lang === "ar" ? "أدخل الاسم" : "Name required"); return; }
    setBusy(true);
    try {
      await onAdd({ label, external_id: externalId || undefined });
      setLabel(""); setExternalId("");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        {isLean
          ? (lang === "ar"
              ? "لتفعيل الربط الفعلي عبر Lean Open Banking نحتاج LEAN_APP_TOKEN و LEAN_APP_ID. أخبرنا عند جاهزيتك."
              : "Real Lean Open Banking linking needs LEAN_APP_TOKEN and LEAN_APP_ID. Let us know when ready.")
          : (lang === "ar"
              ? "لتفعيل ربط الوسطاء فعلياً نحتاج SNAPTRADE_CLIENT_ID و SNAPTRADE_CONSUMER_KEY."
              : "Real broker linking via SnapTrade needs SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.")}
        <br />
        {lang === "ar" ? "حالياً يمكنك تسجيله يدوياً للمتابعة." : "For now you can log it manually to track it."}
      </div>
      <div>
        <Label className="text-xs">{isLean ? (lang === "ar" ? "اسم البنك" : "Bank name") : (lang === "ar" ? "اسم الوسيط" : "Broker name")}</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder} />
      </div>
      <div>
        <Label className="text-xs">{lang === "ar" ? "رقم الحساب (اختياري)" : "Account number (optional)"}</Label>
        <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="•••• 1234" />
      </div>
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "..." : (lang === "ar" ? "حفظ" : "Save")}
      </Button>
    </div>
  );
}
