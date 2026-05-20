import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLiveBinanceBalances, getLiveBrokerRuntime } from "@/lib/liveTrading.functions";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Crown, RefreshCw, CheckCircle2, AlertTriangle, Coins, Lock } from "lucide-react";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { lang, dir } = useI18n();

  const brokerRuntimeFn = useServerFn(getLiveBrokerRuntime);

  const { data: brokerRuntime } = useQuery({ queryKey: ["wallet-live-broker-runtime"], queryFn: () => brokerRuntimeFn() });
  const isBinance = brokerRuntime?.isBinance ?? true;

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

      {isBinance && <WalletBinanceBalancesPanel mode={brokerRuntime?.mode ?? "live"} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gradient-card p-6">
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

          <div className="mt-6 flex flex-wrap gap-3">
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
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="h-4 w-4" />
            {lang === "ar" ? "التداول المباشر مقفل" : "Live trading locked"}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {lang === "ar"
              ? "يتم استخدام اتصال Binance الحي للقراءة فقط. تنفيذ أوامر التداول غير متاح لأن LIVE_TRADING_ENABLED=false."
              : "The live Binance connection is read-only. Trade execution is unavailable because LIVE_TRADING_ENABLED=false."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{brokerRuntime?.provider ?? "binance"}</Badge>
            <Badge variant="secondary">{brokerRuntime?.mode ?? "live"}</Badge>
            <Badge variant="secondary">LIVE_TRADING_ENABLED=false</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function WalletBinanceBalancesPanel({ mode }: { mode: "testnet" | "live" }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const getBalancesFn = useServerFn(getLiveBinanceBalances);
  const balancesQuery = useQuery({
    queryKey: ["wallet-live-binance-balances", mode],
    queryFn: () => getBalancesFn({ data: { mode } }),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const data = balancesQuery.data;
  const connected = data?.status === "connected";

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">{ar ? "أرصدة Binance الحقيقية" : "Real Binance Balances"}</h2>
          {data && (
            <Badge variant={connected ? "default" : "destructive"} className="gap-1">
              {connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {connected ? "Binance Connected" : ar ? "خطأ في Binance" : "Binance Error"}
            </Badge>
          )}
          {data && <Badge variant="outline" className="uppercase">{data.mode}</Badge>}
          {data && !data.liveTradingEnabled && <Badge variant="secondary">LIVE_TRADING_ENABLED=false</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => balancesQuery.refetch()} disabled={balancesQuery.isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${balancesQuery.isFetching ? "animate-spin" : ""}`} />
          {ar ? "مزامنة Binance" : "Sync Binance"}
        </Button>
      </div>

      {data?.error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {data.error}
        </div>
      )}

      <div className="mt-4">
        {balancesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{ar ? "جارٍ مزامنة Binance..." : "Syncing Binance..."}</p>
        ) : connected && data!.balances.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            {ar ? "الاتصال ناجح لكن لا توجد أرصدة حالية في Binance." : "Connection successful, but there are no current balances in Binance."}
          </p>
        ) : connected ? (
          <div className="table-scroll rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start">{ar ? "الأصل" : "Asset"}</th>
                  <th className="px-4 py-2 text-end">{ar ? "متاح" : "Free"}</th>
                  <th className="px-4 py-2 text-end">{ar ? "محجوز" : "Locked"}</th>
                  <th className="px-4 py-2 text-end">{ar ? "الإجمالي" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {data!.balances.map((balance) => (
                  <tr key={balance.asset} className="border-t border-border">
                    <td className="px-4 py-2 font-mono font-semibold">{balance.asset}</td>
                    <td className="px-4 py-2 text-end font-mono">{balance.free.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                    <td className="px-4 py-2 text-end font-mono text-muted-foreground">{balance.locked.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                    <td className="px-4 py-2 text-end font-mono font-semibold">{balance.total.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
