import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getBankAccounts } from "@/lib/wallet.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getBinanceBalances, getWalletBrokerProvider } from "@/lib/binance.functions";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Building, Plus, Crown, RefreshCw, CheckCircle2, AlertTriangle, Coins } from "lucide-react";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { lang, dir } = useI18n();
  const [amount, setAmount] = useState("150");

  const banksFn = useServerFn(getBankAccounts);
  const brokerProviderFn = useServerFn(getWalletBrokerProvider);

  const { data: banks } = useQuery({ queryKey: ["banks"], queryFn: () => banksFn() });
  const { data: brokerProvider } = useQuery({ queryKey: ["wallet-broker-provider"], queryFn: () => brokerProviderFn() });
  const isBinance = brokerProvider?.isBinance ?? true;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {isBinance ? (lang === "ar" ? "محفظة Binance الحقيقية" : "Real Binance Wallet") : (lang === "ar" ? "المحفظة" : "Wallet")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "يتم جلب الأرصدة مباشرة من Binance عبر server functions فقط، بدون كشف مفاتيح السر للواجهة."
              : "Balances are fetched directly from Binance through server functions only, without exposing secret keys to the UI."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/subscription"><Button variant="outline" className="gap-2"><Crown className="h-4 w-4" />{lang === "ar" ? "خطط الاشتراك" : "Plans"}</Button></Link>
        </div>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        {lang === "ar"
          ? "تنبيه: هذه الصفحة تعرض أرصدة Binance الحقيقية للقراءة فقط. الإيداع والسحب والتداول المباشر معطّلة، و LIVE_TRADING_ENABLED=false."
          : "Notice: this page displays real Binance balances as read-only. Deposits, withdrawals, and live trading are disabled, and LIVE_TRADING_ENABLED=false."}
      </div>

      {isBinance && <WalletBinanceBalancesPanel />}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gradient-card p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WalletIcon className="h-4 w-4" />
                {lang === "ar" ? "عمليات المحفظة" : "Wallet operations"}
              </div>
              <div className="mt-2 font-display text-2xl font-bold">
                {lang === "ar" ? "الإيداع والسحب معطّلان" : "Deposits and withdrawals disabled"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{lang === "ar" ? "الدفع مخصص للاشتراكات فقط." : "Payments are for subscriptions only."}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">
                {lang === "ar" ? "شحن (معطّل — وضع تحليلي)" : "Top up (disabled — analytics mode)"}
              </label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled className="w-40" />
            </div>
            <Button disabled className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              {lang === "ar" ? "الإيداع غير متاح" : "Deposits unavailable"}
            </Button>
            <Button variant="outline" disabled className="gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              {lang === "ar" ? "السحب غير متاح" : "Withdrawals unavailable"}
            </Button>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            {lang === "ar"
              ? "لا يتم تنفيذ أوامر شراء أو بيع من هذه الصفحة. عرض الأرصدة فقط طالما التداول المباشر غير مفعّل."
              : "No buy or sell orders are executed from this page. Balances are display-only while live trading is disabled."}
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
    </div>
  );
}
