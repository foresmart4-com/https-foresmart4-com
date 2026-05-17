import { memo, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Shield, ShieldCheck, ShieldAlert, KeyRound, Lock, CreditCard, Activity, LogOut, Power, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchSubscriptionStatus, openBillingPortal, type SubscriptionStatusView,
} from "@/services/payments/stripeIntegration";
import { readSessionSecurity, rotateSession, type SessionSecurityState } from "@/services/security/authSecurity";
import { getVaultReport } from "@/services/security/keyVault";
import { snapshotAbuse } from "@/services/security/rateLimiter";
import { evaluateSecurity, recentAlerts, type SecurityReport } from "@/services/security/securityMonitor";
import {
  freezeTrading, shutdownAI, revokeBroker, emergencyLogout, fullAccountLockdown,
  releaseLockdown, subscribeLockdown, getLockdownState, type LockdownState,
} from "@/services/security/emergencyControls";

interface Props { data: any; ar: boolean }

function Pill({ tone, children }: { tone: "ok" | "warn" | "crit" | "info"; children: React.ReactNode }) {
  const cls =
    tone === "ok" ? "bg-success/15 text-success border-success/30"
    : tone === "warn" ? "bg-warning/15 text-warning border-warning/30"
    : tone === "crit" ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-primary/15 text-primary border-primary/30";
  return <Badge variant="outline" className={cn("border", cls)}>{children}</Badge>;
}

function SectionCard({ icon: Icon, title, children, accent }: {
  icon: any; title: string; children: React.ReactNode; accent?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", accent ?? "bg-primary/15 text-primary")}>
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      {children}
    </Card>
  );
}

function SecurityPanelBase({ data, ar }: Props) {
  const [sub, setSub] = useState<SubscriptionStatusView | null>(null);
  const [session, setSession] = useState<SessionSecurityState | null>(null);
  const [lockdown, setLockdown] = useState<LockdownState>(getLockdownState());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [s, sess] = await Promise.all([fetchSubscriptionStatus(), readSessionSecurity()]);
        if (!alive) return;
        setSub(s); setSession(sess);
      } catch { /* ignore */ }
    };
    refresh();
    const i = setInterval(() => { refresh(); setTick(t => t + 1); }, 15000);
    const unsub = subscribeLockdown(setLockdown);
    return () => { alive = false; clearInterval(i); unsub(); };
  }, []);

  const brokerConfigured = !!data?.broker?.connected || !!data?.broker?.account;
  const vault = useMemo(() => getVaultReport(brokerConfigured), [brokerConfigured, tick]);
  const abuse = useMemo(() => snapshotAbuse(), [tick]);

  const report: SecurityReport = useMemo(() => evaluateSecurity({
    authRiskScore: session?.riskScore ?? 0,
    failedLoginsLastHour: 0,
    apiErrorRate: data?.systemHealth?.apiErrorRate ?? 0,
    abnormalTrades: data?.monitoring?.riskIncidents?.length ?? 0,
    executionAnomalyScore: data?.execution?.anomalyScore ?? 0,
  }), [session, data, tick]);

  const recent = recentAlerts(6);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Shield className="h-4 w-4" />
          </span>
          <h3 className="font-display text-lg font-bold">
            {ar ? "الأمان والمدفوعات المؤسسية" : "Institutional Security & Payments"}
          </h3>
        </div>
        <Pill tone={report.level === "critical" ? "crit" : report.level === "elevated" ? "warn" : report.level === "watch" ? "info" : "ok"}>
          {ar ? "حالة الأمان" : "Posture"}: {report.level.toUpperCase()}
        </Pill>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subscription & Billing */}
        <SectionCard icon={CreditCard} title={ar ? "الاشتراك والفوترة" : "Subscription & Billing"} accent="bg-primary/15 text-primary">
          {sub ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ar ? "الخطة" : "Plan"}</span>
                <span className="font-semibold">{sub.planName ?? "—"} · {sub.tier.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ar ? "الحالة" : "Status"}</span>
                <Pill tone={sub.active ? "ok" : "warn"}>{sub.status}</Pill>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ar ? "ينتهي في" : "Renews"}</span>
                <span className="font-mono text-xs">
                  {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}
                </span>
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={async () => {
                try { const url = await openBillingPortal(window.location.href); window.open(url, "_blank"); } catch {}
              }}>
                {ar ? "إدارة الفوترة" : "Manage Billing"}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{ar ? "لا يوجد اشتراك نشط." : "No active subscription."}</p>
          )}
        </SectionCard>

        {/* Broker API Vault */}
        <SectionCard icon={KeyRound} title={ar ? "خزنة مفاتيح الوسيط" : "Broker API Vault"} accent="bg-success/15 text-success">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{ar ? "الحالة العامة" : "Overall"}</span>
            <Pill tone={vault.overall === "secure" ? "ok" : vault.overall === "partial" ? "warn" : "info"}>
              {vault.overall}
            </Pill>
          </div>
          <div className="space-y-2">
            {vault.entries.map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-md border border-border/40 bg-background/40 p-2 text-xs">
                <div>
                  <div className="font-semibold">{e.label}</div>
                  <div className="font-mono text-muted-foreground">{e.maskedHint}</div>
                </div>
                <Pill tone={e.status === "sealed" ? "ok" : "warn"}>{e.status}</Pill>
              </div>
            ))}
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
            {vault.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </SectionCard>

        {/* Security Threat Monitor */}
        <SectionCard icon={ShieldAlert} title={ar ? "مراقب التهديدات" : "Threat Monitor"} accent="bg-warning/15 text-warning">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{ar ? "درجة التهديد" : "Threat Score"}</span>
            <span className="font-mono font-bold">{report.threatScore}/100</span>
          </div>
          <Progress value={report.threatScore} className="h-2" />
          <p className="text-xs text-muted-foreground">{report.summary}</p>
          <Separator />
          <div className="space-y-1 max-h-32 overflow-auto">
            {recent.length === 0 && <p className="text-[11px] text-muted-foreground">{ar ? "لا توجد تنبيهات حديثة." : "No recent alerts."}</p>}
            {recent.map(a => (
              <div key={a.id} className="flex items-center justify-between text-[11px]">
                <span className="truncate">{a.message}</span>
                <Pill tone={a.severity === "critical" ? "crit" : a.severity === "warning" ? "warn" : "info"}>{a.severity}</Pill>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{ar ? "إساءة الاستخدام" : "Abuse buckets"}: {abuse.totalKeys}</span>
            <span>{ar ? "مغلق" : "Locked"}: {abuse.lockedKeys}</span>
          </div>
        </SectionCard>

        {/* Session Security */}
        <SectionCard icon={Lock} title={ar ? "أمان الجلسة" : "Session Security"} accent="bg-primary/15 text-primary">
          {session?.authenticated ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ar ? "البريد" : "User"}</span>
                <span className="font-mono text-xs truncate max-w-[60%]">{session.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ar ? "ينتهي خلال" : "Expires in"}</span>
                <span className="font-mono">{Math.floor(session.expiresInSec / 60)}m</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ar ? "المخاطر" : "Risk"}</span>
                <Pill tone={session.riskScore >= 60 ? "crit" : session.riskScore >= 30 ? "warn" : "ok"}>
                  {session.riskScore}/100
                </Pill>
              </div>
              {session.flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {session.flags.map(f => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" onClick={() => rotateSession().then(() => readSessionSecurity().then(setSession))}>
                  {ar ? "تجديد" : "Rotate"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => emergencyLogout()}>
                  <LogOut className="h-3 w-3 mr-1" />{ar ? "خروج" : "Logout"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{ar ? "غير مسجل." : "Not authenticated."}</p>
          )}
        </SectionCard>
      </div>

      {/* Emergency Controls */}
      <Card className="border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <Power className="h-4 w-4" />
            </span>
            <h4 className="font-semibold text-sm">{ar ? "تحكم الطوارئ الأمني" : "Emergency Security Controls"}</h4>
          </div>
          {(lockdown.trading || lockdown.ai || lockdown.broker || lockdown.account) && (
            <Pill tone="crit">{ar ? "إغلاق نشط" : "LOCKDOWN ACTIVE"}</Pill>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Button size="sm" variant={lockdown.trading ? "destructive" : "outline"} onClick={() => freezeTrading("manual")}>
            <Ban className="h-3 w-3 mr-1" />{ar ? "تجميد التداول" : "Freeze Trading"}
          </Button>
          <Button size="sm" variant={lockdown.ai ? "destructive" : "outline"} onClick={() => shutdownAI("manual")}>
            <ShieldCheck className="h-3 w-3 mr-1" />{ar ? "إيقاف AI" : "AI Shutdown"}
          </Button>
          <Button size="sm" variant={lockdown.broker ? "destructive" : "outline"} onClick={() => revokeBroker("manual")}>
            <KeyRound className="h-3 w-3 mr-1" />{ar ? "إلغاء الوسيط" : "Revoke Broker"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => fullAccountLockdown("manual")}>
            <Lock className="h-3 w-3 mr-1" />{ar ? "إغلاق الحساب" : "Lockdown Account"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => releaseLockdown()}>
            <Activity className="h-3 w-3 mr-1" />{ar ? "إلغاء الإغلاق" : "Release"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {ar
            ? "تعطيل التنفيذ التلقائي وحماية رأس المال أولاً. جميع الإجراءات تُسجل في سجل التدقيق."
            : "Disables autonomous execution and protects capital first. All actions are written to the audit log."}
        </p>
      </Card>
    </section>
  );
}

export const SecurityCommandCenter = memo(SecurityPanelBase);
