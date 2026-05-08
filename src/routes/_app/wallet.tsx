import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getWallet, getBankAccounts } from "@/lib/wallet.functions";
import { createDepositSession } from "@/lib/checkout.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Building, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
  validateSearch: (s: Record<string, unknown>) => ({ deposit: s.deposit as string | undefined }),
});

function WalletPage() {
  const { t, lang } = useI18n();
  const search = useSearch({ from: "/_app/wallet" });
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);

  const { data, refetch } = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet() });
  const { data: banks } = useQuery({ queryKey: ["banks"], queryFn: () => getBankAccounts() });
  const deposit = useServerFn(createDepositSession);

  const handleDeposit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 5) { toast.error(lang === "ar" ? "أقل مبلغ 5$" : "Min $5"); return; }
    setLoading(true);
    try {
      const { url } = await deposit({ data: { amount: amt } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Error");
      setLoading(false);
    }
  };

  if (search.deposit === "success" && data) {
    setTimeout(() => refetch(), 1500);
  }

  const wallet = data?.wallet;
  const tx = data?.transactions ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "المحفظة الرقمية" : "Digital Wallet"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "أضف رصيداً، اربط حسابك البنكي، ونفّذ أوامر البيع والشراء." : "Top up, link your bank, and execute trades."}
          </p>
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
                ${Number(wallet?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{wallet?.currency ?? "USD"}</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{lang === "ar" ? "مبلغ الإيداع (USD)" : "Deposit amount (USD)"}</label>
              <Input type="number" min={5} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
            </div>
            <Button onClick={handleDeposit} disabled={loading} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              {loading ? "..." : (lang === "ar" ? "شحن الرصيد" : "Top up")}
            </Button>
            <Button variant="outline" disabled className="gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              {lang === "ar" ? "سحب إلى البنك" : "Withdraw to bank"}
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {lang === "ar" ? "الدفع آمن عبر بوابة Lovable. قد تظهر رسوم تجريبية في وضع الاختبار." : "Secure payment via Lovable's gateway. Test mode charges are simulated."}
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
                  {["deposit","sell"].includes(t.type) ? "+" : "-"}${Number(t.amount).toFixed(2)}
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
