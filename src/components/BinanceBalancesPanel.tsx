import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBinanceBalances } from "@/lib/binance.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertTriangle, Coins } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BinanceBalancesPanel() {
  const { lang } = useI18n();
  const fn = useServerFn(getBinanceBalances);
  const q = useQuery({
    queryKey: ["binance-balances"],
    queryFn: () => fn(),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const data = q.data;
  const connected = data?.status === "connected";
  const ar = lang === "ar";

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">
            {ar ? "أرصدة Binance الحقيقية" : "Binance Live Balances"}
          </h3>
          {data && (
            <Badge variant={connected ? "default" : "destructive"} className="gap-1">
              {connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {connected ? "Binance Connected" : ar ? "خطأ في Binance" : "Binance Error"}
            </Badge>
          )}
          {data && (
            <Badge variant="outline" className="uppercase">{data.mode}</Badge>
          )}
          {data && !data.liveTradingEnabled && (
            <Badge variant="secondary">LIVE_TRADING_ENABLED=false</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          {ar ? "مزامنة Binance" : "Sync Binance"}
        </Button>
      </div>

      {data?.error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {data.error}
        </div>
      )}

      <div className="mt-4">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">{ar ? "جارٍ المزامنة..." : "Syncing..."}</p>
        ) : connected && data!.balances.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            {ar ? "الاتصال ناجح لكن لا توجد أرصدة حالية." : "Connection successful, but there are no current balances."}
          </p>
        ) : connected ? (
          <div className="overflow-hidden rounded-md border border-border">
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
                {data!.balances.map((b) => (
                  <tr key={b.asset} className="border-t border-border">
                    <td className="px-4 py-2 font-mono font-semibold">{b.asset}</td>
                    <td className="px-4 py-2 text-end font-mono">{b.free.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                    <td className="px-4 py-2 text-end font-mono text-muted-foreground">
                      {b.locked.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="px-4 py-2 text-end font-mono font-semibold">
                      {b.total.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {data && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {ar ? "آخر مزامنة:" : "Last sync:"} {new Date(data.syncedAt).toLocaleString()}
        </p>
      )}
    </Card>
  );
}
