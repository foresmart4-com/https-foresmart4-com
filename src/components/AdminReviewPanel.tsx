import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Row = { id: string; user: string; type: string; amount?: string; status: "review" | "completed" | "rejected" };

const initialDeposits: Row[] = [
  { id: "DP-1042", user: "ahmed@example.com",  type: "deposit", amount: "1,500 SAR", status: "completed" },
  { id: "DP-1043", user: "sara@example.com",   type: "deposit", amount: "2,500 SAR", status: "review" },
];
const initialWithdrawals: Row[] = [
  { id: "WD-203", user: "ahmed@example.com",  type: "withdrawal", amount: "800 SAR",  status: "review" },
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

  const act = (list: Row[], setList: (v: Row[]) => void, id: string, next: Row["status"]) => {
    setList(list.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const label = next === "completed" ? (lang === "ar" ? "تم القبول" : "Approved")
      : next === "rejected" ? (lang === "ar" ? "تم الرفض" : "Rejected")
      : (lang === "ar" ? "تم التعليم كمكتمل" : "Marked completed");
    toast.success(`${id} — ${label}`);
  };

  const Table = ({ title, rows, setRows }: { title: string; rows: Row[]; setRows: (v: Row[]) => void }) => (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
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
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-success" onClick={() => act(rows, setRows, r.id, "completed")} disabled={r.status === "completed"}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-danger" onClick={() => act(rows, setRows, r.id, "rejected")} disabled={r.status === "rejected"}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => act(rows, setRows, r.id, "review")}>
                      <RefreshCw className="h-3.5 w-3.5" />
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

  return (
    <Card className="gradient-card p-5 shadow-card space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">{lang === "ar" ? "لوحة مراجعة المسؤول" : "Admin Review Panel"}</h3>
        <Badge variant="outline" className="ms-2 text-[10px]">{lang === "ar" ? "تجريبي" : "Demo"}</Badge>
      </div>
      <Table title={lang === "ar" ? "طلبات الإيداع" : "Deposit requests"} rows={deposits} setRows={setDeposits} />
      <Table title={lang === "ar" ? "طلبات السحب" : "Withdrawal requests"} rows={withdrawals} setRows={setWithdrawals} />
      <Table title={lang === "ar" ? "الاشتراكات" : "Subscriptions"} rows={subs} setRows={setSubs} />
      <Table title={lang === "ar" ? "الدعوات" : "Invites"} rows={invites} setRows={setInvites} />
      <p className="text-[11px] text-muted-foreground">
        {lang === "ar"
          ? "هذه الإجراءات تجريبية ولا تُحدّث قاعدة البيانات حالياً. سيتم ربطها بـ Backend لاحقاً."
          : "Actions are demo-only and do not persist yet. Will be wired to the backend later."}
      </p>
    </Card>
  );
}
