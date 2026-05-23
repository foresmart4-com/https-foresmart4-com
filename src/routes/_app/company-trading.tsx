import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Shield, Lock, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCompanyTradingConfig,
  updateCompanyTradingConfig,
  listCompanyTradingAudit,
} from "@/lib/company-trading.functions";

export const Route = createFileRoute("/_app/company-trading")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/dashboard" });
  },
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><CompanyTradingPage /></ErrorBoundary>,
});

function CompanyTradingPage() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getCompanyTradingConfig);
  const updCfg = useServerFn(updateCompanyTradingConfig);
  const getAudit = useServerFn(listCompanyTradingAudit);

  const { data: config } = useQuery({ queryKey: ["company-trading-config"], queryFn: () => getCfg() });
  const { data: audit } = useQuery({ queryKey: ["company-trading-audit"], queryFn: () => getAudit() });

  type ConfigPatch = {
    enabled?: boolean;
    live_trading_enabled?: boolean;
    broker_name?: string | null;
    max_trade_size_usdt?: number;
    daily_loss_limit_usdt?: number;
    allowed_assets?: string[];
    approval_required?: boolean;
  };
  const mut = useMutation({
    mutationFn: (patch: ConfigPatch) => updCfg({ data: patch }),
    onSuccess: () => {
      toast.success("Company trading settings updated");
      qc.invalidateQueries({ queryKey: ["company-trading-config"] });
      qc.invalidateQueries({ queryKey: ["company-trading-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    max_trade_size_usdt: 1000,
    daily_loss_limit_usdt: 500,
    allowed_assets: "BTCUSDT,ETHUSDT",
    approval_required: true,
    enabled: false,
  });

  useEffect(() => {
    if (config) {
      setForm({
        max_trade_size_usdt: Number(config.max_trade_size_usdt),
        daily_loss_limit_usdt: Number(config.daily_loss_limit_usdt),
        allowed_assets: (config.allowed_assets ?? []).join(","),
        approval_required: config.approval_required,
        enabled: config.enabled,
      });
    }
  }, [config]);

  const brokerConnected = !!config?.broker_connected;
  const liveEnabled = !!config?.live_trading_enabled;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Company Trading Mode
          </h1>
          <p className="text-muted-foreground mt-1">
            Internal admin-only operating mode. User wallets remain in Simulation only.
          </p>
        </div>
        <Badge variant={config?.enabled ? "default" : "secondary"}>
          {config?.enabled ? "Active" : "Inactive"}
        </Badge>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Restricted to company accounts</AlertTitle>
        <AlertDescription>
          Real-money trading is exclusively for the company's internal broker accounts.
          End-user wallets, subscriptions and the public app must remain in simulation mode.
          Subscriptions (Stripe / PayPal) are <strong>never</strong> used to fund a trading wallet.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Live Execution
          </CardTitle>
          <CardDescription>
            Live trading remains locked until a broker API key is connected and verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Broker connection</p>
              <p className="text-sm text-muted-foreground">
                {brokerConnected ? `Connected: ${config?.broker_name ?? "broker"}` : "No broker linked"}
              </p>
            </div>
            <Badge variant={brokerConnected ? "default" : "outline"}>
              {brokerConnected ? "Linked" : "Not linked"}
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Enable Live Trading</p>
              <p className="text-sm text-muted-foreground">
                Requires a verified broker connection. Disabled by default.
              </p>
            </div>
            <Button
              disabled={!brokerConnected || mut.isPending}
              variant={liveEnabled ? "destructive" : "default"}
              onClick={() => mut.mutate({ live_trading_enabled: !liveEnabled })}
            >
              {liveEnabled ? "Disable Live Trading" : "Enable Live Trading"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Limits</CardTitle>
          <CardDescription>Enforced before any company order is submitted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max trade size (USDT)</Label>
              <Input
                type="number"
                value={form.max_trade_size_usdt}
                onChange={(e) => setForm((f) => ({ ...f, max_trade_size_usdt: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Daily loss limit (USDT)</Label>
              <Input
                type="number"
                value={form.daily_loss_limit_usdt}
                onChange={(e) => setForm((f) => ({ ...f, daily_loss_limit_usdt: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Allowed assets (comma-separated)</Label>
              <Input
                value={form.allowed_assets}
                onChange={(e) => setForm((f) => ({ ...f, allowed_assets: e.target.value }))}
                placeholder="BTCUSDT,ETHUSDT,SOLUSDT"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Approval required</Label>
              <p className="text-sm text-muted-foreground">Every order needs manual admin approval.</p>
            </div>
            <Switch
              checked={form.approval_required}
              onCheckedChange={(v) => setForm((f) => ({ ...f, approval_required: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Company Mode active</Label>
              <p className="text-sm text-muted-foreground">Allow the internal engine to evaluate company trades.</p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>

          <Button
            disabled={mut.isPending}
            onClick={() =>
              mut.mutate({
                max_trade_size_usdt: form.max_trade_size_usdt,
                daily_loss_limit_usdt: form.daily_loss_limit_usdt,
                allowed_assets: form.allowed_assets
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
                approval_required: form.approval_required,
                enabled: form.enabled,
              })
            }
          >
            Save risk limits
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Audit Log
          </CardTitle>
          <CardDescription>Every decision and execution attempt is recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {(audit ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No audit events yet.</p>
            )}
            {(audit ?? []).map((row) => (
              <div key={row.id} className="text-sm rounded-md border p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {row.action}
                    {row.symbol ? ` · ${row.symbol}` : ""}
                    {row.side ? ` · ${row.side}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                    {row.decision ? ` · ${row.decision}` : ""}
                  </div>
                </div>
                <Badge variant="outline">{row.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
