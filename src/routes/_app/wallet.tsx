import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getWallet, getBankAccounts } from "@/lib/wallet.functions";
import { initiateTopup, previewTopupFees } from "@/lib/payments.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Building, Plus, AlertCircle, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickBuyPanel } from "@/components/QuickBuyPanel";
import { AllocationPanel } from "@/components/AllocationPanel";
import { ManualOperationForm } from "@/components/ManualOperationForm";
import { AssetPnlPanel } from "@/components/AssetPnlPanel";
import { WithdrawalSection } from "@/components/WithdrawalSection";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
  validateSearch: (s: Record<string, unknown>) => ({ deposit: s.deposit as string | undefined }),
});

const MIN_TOPUP = 150;

function WalletPage() {
  const { lang, dir } = useI18n();
  const search = useSearch({ from: "/_app/wallet" });
  const [amount, setAmount] = useState("150");
  const [activeTopup, setActiveTopup] = useState<{ topupId: string; amountSar: number; pk: string | null } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const walletFn = useServerFn(getWallet);
  const banksFn = useServerFn(getBankAccounts);
  const previewFn = useServerFn(previewTopupFees);
  const initiateFn = useServerFn(initiateTopup);

  const { data, refetch } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });
  const { data: banks } = useQuery({ queryKey: ["banks"], queryFn: () => banksFn() });
  const amt = Number(amount) || 0;
  const { data: feesPreview } = useQuery({
    queryKey: ["fees", amt],
    queryFn: () => previewFn({ data: { amountSar: amt } }),
    enabled: amt >= 1,
  });

  const initiate = useMutation({
    mutationFn: () => initiateFn({ data: { amountSar: amt } }),
    onSuccess: (res) => {
      setActiveTopup({ topupId: res.topupId, amountSar: res.amountSar, pk: res.publishableKey });
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!activeTopup?.pk) return;
    if (!document.getElementById("moyasar-css")) {
      const link = document.createElement("link");
      link.id = "moyasar-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.moyasar.com/mpf/1.15.1/moyasar.css";
      document.head.appendChild(link);
    }
    const ensure = () => {
      const M = (window as any).Moyasar;
      if (!M) return false;
      M.init({
        element: ".mysr-form",
        amount: Math.round(activeTopup.amountSar * 100),
        currency: "SAR",
        description: lang === "ar" ? `شحن المحفظة ${activeTopup.amountSar} ريال` : `Top-up ${activeTopup.amountSar} SAR`,
        publishable_api_key: activeTopup.pk,
        callback_url: `${window.location.origin}/wallet?deposit=success`,
        methods: ["creditcard", "applepay", "stcpay"],
        metadata: {
          purpose: "wallet_topup",
          topup_id: activeTopup.topupId,
        },
      });
      return true;
    };
    if (!ensure()) {
      const s = document.createElement("script");
      s.src = "https://cdn.moyasar.com/mpf/1.15.1/moyasar.js";
      s.async = true;
      s.onload = ensure;
      document.body.appendChild(s);
    }
  }, [activeTopup, lang]);

  const handleDeposit = () => {
    if (amt < MIN_TOPUP) { toast.error(lang === "ar" ? `الحد الأدنى ${MIN_TOPUP} ريال` : `Min ${MIN_TOPUP} SAR`); return; }
    initiate.mutate();
  };

  if (search.deposit === "success" && data) setTimeout(() => refetch(), 1500);

  const wallet = data?.wallet;
  const tx = data?.transactions ?? [];
  const fees = feesPreview?.fees;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "المحفظة الرقمية" : "Digital Wallet"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "اشحن المحفظة بالريال السعودي عبر mada / Visa / Apple Pay / STC Pay." : "Top up via mada / Visa / Apple Pay / STC Pay."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/deposit"><Button className="gap-2"><ArrowDownToLine className="h-4 w-4" />{lang === "ar" ? "صفحة الإيداع" : "Deposit page"}</Button></Link>
          <Link to="/subscription"><Button variant="outline" className="gap-2"><Crown className="h-4 w-4" />{lang === "ar" ? "خطط الاشتراك" : "Plans"}</Button></Link>
        </div>
      </div>

      {search.deposit === "success" && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success">
          {lang === "ar" ? "تم الدفع بنجاح. سيظهر الرصيد خلال لحظات." : "Payment successful. Balance will update shortly."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gradient-card p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WalletIcon className="h-4 w-4" />
                {lang === "ar" ? "الرصيد المتاح" : "Available balance"}
              </div>
              <div className="mt-2 font-display text-4xl font-bold">
                {Number(wallet?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{wallet?.currency ?? "SAR"}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">
                {lang === "ar" ? `مبلغ الشحن (ريال) — الحد الأدنى ${MIN_TOPUP}` : `Top-up (SAR) — min ${MIN_TOPUP}`}
              </label>
              <Input type="number" min={MIN_TOPUP} step={10} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
            </div>
            <Button onClick={handleDeposit} disabled={initiate.isPending || amt < MIN_TOPUP} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              {initiate.isPending ? "..." : (lang === "ar" ? "شحن المحفظة" : "Top up")}
            </Button>
            <Button variant="outline" disabled className="gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              {lang === "ar" ? "سحب (قريباً)" : "Withdraw (soon)"}
            </Button>
          </div>

          {fees && amt >= MIN_TOPUP && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                <div><div className="text-muted-foreground">{lang === "ar" ? "الإجمالي" : "Total"}</div><div className="font-semibold">{amt} ريال</div></div>
                <div><div className="text-muted-foreground">{lang === "ar" ? "رسوم Moyasar" : "Moyasar fee"}</div><div>-{fees.moyasarFee}</div></div>
                <div><div className="text-muted-foreground">{lang === "ar" ? "رسوم الموقع 0.15%" : "Site fee 0.15%"}</div><div>-{fees.serviceFee}</div></div>
                <div><div className="text-muted-foreground">{lang === "ar" ? "صافي الإضافة" : "Net credit"}</div><div className="font-bold text-success">{fees.netCredit}</div></div>
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            {lang === "ar"
              ? "الدفع آمن عبر Moyasar (PCI-DSS Level 1). يقبل mada وVisa وMastercard وApple Pay وSTC Pay."
              : "Secured by Moyasar (PCI-DSS Level 1). Accepts mada, Visa, Mastercard, Apple Pay, STC Pay."}
          </p>
        </Card>

        <Card className="gradient-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building className="h-4 w-4" />
              {lang === "ar" ? "حساباتك البنكية" : "Bank accounts"}
            </div>
            <Link to="/bank-accounts" className="text-xs text-primary hover:underline">
              {lang === "ar" ? "إدارة" : "Manage"}
            </Link>
          </div>
          {banks && banks.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {banks.map((b) => (
                <li key={b.id} className="rounded-md border border-border p-2">
                  <div className="font-medium">{b.institution_name}</div>
                  <div className="text-xs text-muted-foreground">{b.account_name} •••• {b.account_mask}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 text-xs text-muted-foreground">
              {lang === "ar" ? "لا توجد حسابات مربوطة." : "No linked accounts."}
              <Link to="/bank-accounts" className="ms-1 inline-flex items-center gap-1 text-primary hover:underline">
                <Plus className="h-3 w-3" /> {lang === "ar" ? "إضافة" : "Add"}
              </Link>
            </div>
          )}
        </Card>
      </div>

      {activeTopup && !activeTopup.pk && (
        <Card className="border-warning/40 bg-warning/5 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold">{lang === "ar" ? "بوابة الدفع غير مفعّلة بعد" : "Payment gateway not configured"}</p>
              <p className="mt-1 text-muted-foreground">
                {lang === "ar"
                  ? "أنشئ حساباً في moyasar.com، احصل على المفاتيح من Settings → API Keys، ثم أبلغ المساعد لربطها."
                  : "Create a Moyasar account, get the keys from Settings → API Keys, then ask the assistant to wire them in."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {activeTopup?.pk && (
        <Card ref={formRef as any} className="p-6">
          <h3 className="mb-4 font-display text-lg font-bold">{lang === "ar" ? "إتمام الدفع" : "Complete payment"}</h3>
          <div className="mysr-form" />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AllocationPanel />
        <ManualOperationForm />
      </div>

      <AssetPnlPanel />

      <WithdrawalSection />

      <QuickBuyPanel />

      <Card className="overflow-hidden">
        <header className="border-b border-border bg-muted/30 px-5 py-3 font-semibold">
          {lang === "ar" ? "آخر المعاملات" : "Recent transactions"}
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="px-4 py-2 text-start">{lang === "ar" ? "المرجع" : "Reference"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {tx.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">{lang === "ar" ? "لا معاملات بعد" : "No transactions yet"}</td></tr>
            )}
            {tx.map((t: any) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-2 capitalize">{t.type}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.reference ?? "—"}</td>
                <td className={cn("px-4 py-2 text-end font-medium", ["deposit","sell"].includes(t.type) ? "text-success" : "text-danger")}>
                  {["deposit","sell"].includes(t.type) ? "+" : "-"}{Number(t.amount).toFixed(2)} {t.currency}
                </td>
                <td className="px-4 py-2 text-end text-xs">{t.status}</td>
                <td className="px-4 py-2 text-end text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
