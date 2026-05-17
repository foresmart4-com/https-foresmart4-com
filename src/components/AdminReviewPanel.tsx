import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, X, RefreshCw, Eye, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/tradingJournal";
import { useAutoTrading } from "@/lib/autoTrading";
import { DataStatusBadge } from "@/components/DataStatusBadge";

type Row = { id: string; user: string; type: string; amount?: string; status: "review" | "completed" | "rejected" };

const initialDeposits: Row[] = [
  { id: "DEP-2026-0001", user: "ahmed@example.com",  type: "deposit", amount: "1,500 SAR", status: "completed" },
  { id: "DEP-2026-0002", user: "sara@example.com",   type: "deposit", amount: "2,500 SAR", status: "review" },
];
const initialWithdrawals: Row[] = [
  { id: "WDR-2026-0001", user: "ahmed@example.com",  type: "withdrawal", amount: "800 SAR",  status: "review" },
];
const initialSubs: Row[] = [
  { id: "SUB-77", user: "khalid@example.com", type: "subscription", amount: "Pro / 6mo", status: "review" },
];
const initialInvites: Row[] = [
  { id: "INV-12", user: "fatima@example.com", type: "invite", status: "review" },
];

export function AdminReviewPanel() {
  const { lang } = useI18n();
  const [deposits, setDeposits] = useState(initialDeposits);
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [subs, setSubs] = useState(initialSubs);
  const [invites, setInvites] = useState(initialInvites);
  const { settings, orders, decisionLog, haltedAt } = useAutoTrading();

  const summary = useMemo(() => {
    const all = [...deposits, ...withdrawals, ...subs, ...invites];
    return {
      depositsTotal: deposits.length,
      withdrawalsTotal: withdrawals.length,
      pending: all.filter((r) => r.status === "review").length,
      completed: all.filter((r) => r.status === "completed").length,
      rejected: all.filter((r) => r.status === "rejected").length,
      highRiskDecisions: decisionLog.filter((d) => d.riskLevel === "HIGH").slice(0, 5),
      lastSimOrders: orders.slice(0, 5),
      rejectedDecisions: decisionLog.filter((d) => !d.orderCreated).slice(0, 5),
    };
  }, [deposits, withdrawals, subs, invites, decisionLog, orders]);

  const act = (kind: "deposit" | "withdrawal" | "subscription" | "invite", list: Row[], setList: (v: Row[]) => void, id: string, next: Row["status"]) => {
    setList(list.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const label_ar = next === "completed" ? "تم القبول" : next === "rejected" ? "تم الرفض" : "أُعيد للمراجعة";
    const label_en = next === "completed" ? "Approved" : next === "rejected" ? "Rejected" : "Re-opened";
    logEvent({
      source: "admin",
      eventKind: `${kind}_${next}`,
      status: next === "completed" ? "completed" : next === "rejected" ? "rejected" : "review",
      refId: id,
      notes: `${lang === "ar" ? label_ar : label_en} بواسطة الإدارة`,
    });
    toast.success(`${id} — ${lang === "ar" ? label_ar : label_en}`);
  };

  const Table = ({ title, kind, rows, setRows }: { title: string; kind: "deposit" | "withdrawal" | "subscription" | "invite"; rows: Row[]; setRows: (v: Row[]) => void }) => (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">#</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "المستخدم" : "User"}</th>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "التفاصيل" : "Details"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراء" : "Action"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-3 py-2">{r.user}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.amount ?? "—"}</td>
                <td className="px-3 py-2 text-end">
                  <Badge variant="outline" className={cn("text-[10px]",
                    r.status === "completed" && "border-success/40 text-success",
                    r.status === "review"    && "border-warning/40 text-warning",
                    r.status === "rejected"  && "border-danger/40 text-danger")}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-end">
                  <div className="inline-flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-success" title={lang === "ar" ? "اعتماد" : "Approve"} onClick={() => act(kind, rows, setRows, r.id, "completed")} disabled={r.status === "completed"}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-danger" title={lang === "ar" ? "رفض" : "Reject"} onClick={() => act(kind, rows, setRows, r.id, "rejected")} disabled={r.status === "rejected"}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title={lang === "ar" ? "مراجعة" : "Reopen"} onClick={() => act(kind, rows, setRows, r.id, "review")}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title={lang === "ar" ? "تفاصيل" : "Details"} onClick={() => toast.info(`${r.id} · ${r.user} · ${r.amount ?? "—"}`)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-xs">{lang === "ar" ? "لا طلبات" : "No items"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Stat = ({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" | "danger" }) => (
    <div className="rounded border border-border bg-muted/20 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("text-base font-semibold",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "danger" && "text-danger")}>{value}</div>
    </div>
  );

  return (
    <Card className="gradient-card p-5 shadow-card space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">{lang === "ar" ? "وحدة تشغيل الإدارة" : "Admin Operational Console"}</h3>
        <Badge variant="outline" className="text-[10px]">{lang === "ar" ? "تجريبي" : "Demo"}</Badge>
        {haltedAt && <Badge variant="outline" className="text-[10px] border-danger/40 text-danger gap-1"><AlertTriangle className="h-3 w-3" />E-Stop</Badge>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={lang === "ar" ? "إيداعات" : "Deposits"} value={summary.depositsTotal} />
        <Stat label={lang === "ar" ? "سحوبات" : "Withdrawals"} value={summary.withdrawalsTotal} />
        <Stat label={lang === "ar" ? "معلقة" : "Pending"} value={summary.pending} tone="warning" />
        <Stat label={lang === "ar" ? "مكتملة" : "Completed"} value={summary.completed} tone="success" />
        <Stat label={lang === "ar" ? "مرفوضة" : "Rejected"} value={summary.rejected} tone="danger" />
      </div>

      {/* System statuses */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/20 p-2 text-xs">
        <span className="text-muted-foreground">CoinGecko</span><DataStatusBadge status="live" />
        <span className="text-muted-foreground">{lang === "ar" ? "الأسهم" : "Stocks"}</span><DataStatusBadge status="mock" />
        <span className="text-muted-foreground">AI</span><DataStatusBadge status="mock" />
        <span className="text-muted-foreground">Auto Trading</span><DataStatusBadge status="simulation" />
        <span className="text-muted-foreground">{lang === "ar" ? "الدفع" : "Payments"}</span><DataStatusBadge status="not_connected" />
        <span className="text-muted-foreground">{lang === "ar" ? "السحب البنكي" : "Bank"}</span><DataStatusBadge status="manual_review" />
      </div>

      <Table title={lang === "ar" ? "طلبات الإيداع" : "Deposit requests"} kind="deposit" rows={deposits} setRows={setDeposits} />
      <Table title={lang === "ar" ? "طلبات السحب" : "Withdrawal requests"} kind="withdrawal" rows={withdrawals} setRows={setWithdrawals} />
      <Table title={lang === "ar" ? "الاشتراكات" : "Subscriptions"} kind="subscription" rows={subs} setRows={setSubs} />
      <Table title={lang === "ar" ? "الدعوات" : "Invites"} kind="invite" rows={invites} setRows={setInvites} />

      {/* AI high-risk + sim orders */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-warning" />{lang === "ar" ? "قرارات AI عالية المخاطر" : "High-risk AI decisions"}
          </div>
          {summary.highRiskDecisions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "لا توجد" : "None"}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {summary.highRiskDecisions.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1">
                  <span>{d.asset} · {d.action} · {d.confidence}%</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toast.info(`${d.asset}: ${d.rejectReason ?? "—"}`)}>{lang === "ar" ? "تفاصيل" : "Details"}</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <Activity className="h-3 w-3 text-primary" />{lang === "ar" ? "آخر أوامر المحاكاة" : "Latest sim orders"}
          </div>
          {summary.lastSimOrders.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "لا توجد أوامر بعد" : "No orders yet"}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {summary.lastSimOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1">
                  <span>{o.asset} · {o.action} · {o.status}</span>
                  <span className="text-muted-foreground">{o.confidence}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {lang === "ar"
          ? "هذه الإجراءات تجريبية محلية وتُسجَّل في دفتر التداول الموحد. سيتم ربطها بـ Backend لاحقاً."
          : "Actions are demo-local and logged to the unified journal. Will wire to backend later."}
      </p>
    </Card>
  );
}
