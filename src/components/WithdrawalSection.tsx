import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { calcTransferFee } from "@/lib/mock-data";
import { logEvent } from "@/lib/tradingJournal";
import { ArrowUpFromLine, AlertTriangle, Clock, CheckCircle2, XCircle, Ban, Copy, Eye, ShieldCheck , Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type WithdrawalStatus = "review" | "completed" | "rejected" | "cancelled";

export type WithdrawalRequest = {
  id: string;            // WDR-YYYY-XXXX
  amount: number;
  fee: number;
  net: number;
  bank: string;
  holder: string;
  iban: string;          // masked
  note?: string;
  status: WithdrawalStatus;
  createdAt: number;
};

const SEED: WithdrawalRequest[] = [
  { id: "WDR-2026-0001", amount: 1500, fee: 10, net: 1490, bank: "Al Rajhi", holder: "Ahmed", iban: "SA••••2284", status: "completed", createdAt: Date.now() - 86400000 * 5 },
  { id: "WDR-2026-0002", amount: 800,  fee: 5,  net: 795,  bank: "SNB",      holder: "Sara",  iban: "SA••••9981", status: "review",    createdAt: Date.now() - 86400000 * 1 },
];

function statusBadge(s: WithdrawalStatus, lang: "ar" | "en") {
  const map: Record<WithdrawalStatus, { cls: string; ar: string; en: string; Icon: any }> = {
    review:    { cls: "bg-warning/15 text-warning border-warning/30",       ar: "قيد المراجعة", en: "Under review", Icon: Clock },
    completed: { cls: "bg-success/15 text-success border-success/30",       ar: "مكتمل",        en: "Completed",    Icon: CheckCircle2 },
    rejected:  { cls: "bg-danger/15 text-danger border-danger/30",          ar: "مرفوض",        en: "Rejected",     Icon: XCircle },
    cancelled: { cls: "bg-muted text-muted-foreground border-muted-foreground/40", ar: "ملغى", en: "Cancelled", Icon: Ban },
  };
  const m = map[s]; const Icon = m?.Icon ?? Activity;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", m.cls)}>
      <Icon className="h-3 w-3" />{lang === "ar" ? m.ar : m.en}
    </span>
  );
}

export function WithdrawalSection() {
  const { lang } = useI18n();
  const [amount, setAmount] = useState("500");
  const [bank, setBank] = useState("");
  const [holder, setHolder] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<WithdrawalRequest[]>(SEED);

  const amt = Number(amount) || 0;
  const fee = calcTransferFee(amt);
  const net = Math.max(0, amt - fee);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amt <= 0) return toast.error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
    if (!bank || !holder || !iban) return toast.error(lang === "ar" ? "أكمل الحقول المطلوبة" : "Complete required fields");
    const year = new Date().getFullYear();
    const seq = String(history.filter((r) => r.id.startsWith(`WDR-${year}-`)).length + 1).padStart(4, "0");
    const refId = `WDR-${year}-${seq}`;
    const req: WithdrawalRequest = {
      id: refId,
      amount: amt, fee, net, bank, holder,
      iban: iban.replace(/.(?=.{4})/g, "•"),
      note: note || undefined,
      status: "review",
      createdAt: Date.now(),
    };
    setHistory([req, ...history]);
    setBank(""); setHolder(""); setIban(""); setNote("");
    logEvent({
      source: "withdrawal", eventKind: "created", refId, amount: amt, status: "manual_review",
      actor: "user", severity: "info",
      notes: `${bank} — صافي ${net} SAR`,
      afterState: { status: "review", amount: amt, fee, net },
    });
    toast.success(lang === "ar" ? `تم إنشاء طلب السحب ${refId} وهو قيد المراجعة` : `Withdrawal ${refId} submitted — under review`);
  };

  const copyRef = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(id);
    toast.success(lang === "ar" ? `تم نسخ ${id}` : `Copied ${id}`);
  };

  const cancelRequest = (id: string) => {
    setHistory((h) => h.map((r) => {
      if (r.id !== id || r.status !== "review") return r;
      logEvent({
        source: "withdrawal", eventKind: "cancelled", refId: id, status: "cancelled",
        actor: "user", severity: "warning",
        notes: "إلغاء من قبل المستخدم",
        beforeState: { status: "review" }, afterState: { status: "cancelled" },
      });
      return { ...r, status: "cancelled" };
    }));
    toast.success(lang === "ar" ? `تم إلغاء الطلب ${id}` : `Cancelled ${id}`);
  };

  const showDetails = (r: WithdrawalRequest) => {
    const lines = [
      `${r.id}`,
      `${r.bank} · ${r.holder}`,
      `${r.iban}`,
      `${lang === "ar" ? "المبلغ" : "Amount"}: ${r.amount} SAR`,
      `${lang === "ar" ? "الرسوم" : "Fee"}: ${r.fee} SAR`,
      `${lang === "ar" ? "الصافي" : "Net"}: ${r.net} SAR`,
      r.note ? `📝 ${r.note}` : "",
    ].filter(Boolean).join("\n");
    toast.message(`${r.id} — ${r.status}`, { description: lines });
  };

  return (
    <Card className="gradient-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <ArrowUpFromLine className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">{lang === "ar" ? "طلبات السحب" : "Withdrawals"}</h3>
        <Badge variant="outline" className="text-[10px]">Manual Review</Badge>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{lang === "ar"
          ? "السحب يتم بالمراجعة اليدوية حالياً ولا يوجد تحويل بنكي آلي."
          : "Withdrawals are reviewed manually — no automated bank transfer yet."}
        </span>
      </div>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">{lang === "ar" ? "المبلغ (ريال)" : "Amount (SAR)"}</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "اسم البنك" : "Bank name"}</Label>
          <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Al Rajhi / SNB / ..." />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "اسم صاحب الحساب" : "Account holder"}</Label>
          <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">IBAN</Label>
          <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">{lang === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />{lang === "ar" ? "ملخّص الرسوم" : "Fee summary"}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-muted-foreground">{lang === "ar" ? "المبلغ" : "Amount"}</div><div className="font-semibold">{amt} SAR</div></div>
            <div><div className="text-muted-foreground">{lang === "ar" ? "الرسوم" : "Fee"}</div><div className="text-danger">-{fee} SAR</div></div>
            <div><div className="text-muted-foreground">{lang === "ar" ? "الصافي" : "Net"}</div><div className="font-bold text-success">{net} SAR</div></div>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {lang === "ar" ? "الرسوم: 5 ريال أقل من 1000، و10 ريال 1000 فأكثر." : "Fee: 5 SAR under 1,000; 10 SAR for 1,000+."}
          </p>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" className="gap-2"><ArrowUpFromLine className="h-4 w-4" />{lang === "ar" ? "إرسال طلب السحب" : "Submit withdrawal"}</Button>
        </div>
      </form>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{lang === "ar" ? "السجل" : "History"}</div>
        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
            {lang === "ar" ? "لا توجد طلبات سحب بعد. أنشئ أول طلب من النموذج أعلاه." : "No withdrawals yet. Submit your first request above."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-start">{lang === "ar" ? "الرقم" : "Ref"}</th>
                  <th className="py-2 text-start">{lang === "ar" ? "البنك" : "Bank"}</th>
                  <th className="py-2 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                  <th className="py-2 text-end">{lang === "ar" ? "الرسوم" : "Fee"}</th>
                  <th className="py-2 text-end">{lang === "ar" ? "الصافي" : "Net"}</th>
                  <th className="py-2 text-start">{lang === "ar" ? "المسار" : "Timeline"}</th>
                  <th className="py-2 text-end">{lang === "ar" ? "الحالة" : "Status"}</th>
                  <th className="py-2 text-end">{lang === "ar" ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => {
                  const steps: { ar: string; en: string; on: boolean }[] = [
                    { ar: "تم الإنشاء", en: "Created", on: true },
                    { ar: "قيد المراجعة", en: "Under review", on: r.status === "review" || r.status === "completed" || r.status === "rejected" },
                    { ar: r.status === "rejected" ? "مرفوض" : r.status === "cancelled" ? "ملغى" : "اعتُمد",
                      en: r.status === "rejected" ? "Rejected" : r.status === "cancelled" ? "Cancelled" : "Approved",
                      on: r.status === "completed" || r.status === "rejected" || r.status === "cancelled" },
                    { ar: "مكتمل", en: "Completed", on: r.status === "completed" },
                  ];
                  const failed = r.status === "rejected" || r.status === "cancelled";
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2 font-mono text-xs">{r.id}<div className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div></td>
                      <td className="py-2">{r.bank}<div className="text-[11px] text-muted-foreground">{r.iban}</div></td>
                      <td className="py-2 text-end">{r.amount} SAR</td>
                      <td className="py-2 text-end text-danger">-{r.fee}</td>
                      <td className="py-2 text-end font-semibold text-success">{r.net}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          {steps.map((s, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className={cn("h-2 w-2 rounded-full", s.on ? (failed && i >= 2 ? "bg-danger" : "bg-success") : "bg-muted")} title={lang === "ar" ? s.ar : s.en} />
                              {i < steps.length - 1 && <span className={cn("h-px w-3", s.on ? (failed && i >= 2 ? "bg-danger/50" : "bg-success/60") : "bg-muted")} />}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-end">{statusBadge(r.status, lang as "ar" | "en")}</td>
                      <td className="py-2 text-end">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title={lang === "ar" ? "نسخ الرقم" : "Copy ref"} onClick={() => copyRef(r.id)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title={lang === "ar" ? "تفاصيل" : "Details"} onClick={() => showDetails(r)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {r.status === "review" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-danger" title={lang === "ar" ? "إلغاء الطلب" : "Cancel"} onClick={() => cancelRequest(r.id)}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
