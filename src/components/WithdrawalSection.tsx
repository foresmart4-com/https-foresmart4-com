import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { calcTransferFee } from "@/lib/mock-data";
import { ArrowUpFromLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WithdrawalRequest = {
  id: string;
  amount: number;
  fee: number;
  net: number;
  bank: string;
  iban: string;
  status: "review" | "completed" | "rejected";
  date: string;
};

const seed: WithdrawalRequest[] = [
  { id: "WD-204", amount: 1500, fee: 10, net: 1490, bank: "Al Rajhi", iban: "SA••••2284", status: "completed", date: "2026-05-10" },
  { id: "WD-203", amount: 800,  fee: 5,  net: 795,  bank: "SNB",      iban: "SA••••9981", status: "review",    date: "2026-05-12" },
];

export function WithdrawalSection() {
  const { lang } = useI18n();
  const [amount, setAmount] = useState("500");
  const [bank, setBank] = useState("");
  const [holder, setHolder] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<WithdrawalRequest[]>(seed);

  const amt = Number(amount) || 0;
  const fee = calcTransferFee(amt);
  const net = Math.max(0, amt - fee);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amt <= 0) return toast.error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
    if (!bank || !holder || !iban) return toast.error(lang === "ar" ? "أكمل الحقول المطلوبة" : "Complete required fields");
    const req: WithdrawalRequest = {
      id: `WD-${Math.floor(Math.random() * 900 + 100)}`,
      amount: amt, fee, net, bank, iban: iban.replace(/.(?=.{4})/g, "•"),
      status: "review", date: new Date().toISOString().slice(0, 10),
    };
    setHistory([req, ...history]);
    setBank(""); setHolder(""); setIban(""); setNote("");
    toast.success(lang === "ar" ? "تم استلام طلب السحب — قيد المراجعة" : "Withdrawal request received — under review");
  };

  return (
    <Card className="gradient-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <ArrowUpFromLine className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">{lang === "ar" ? "طلبات السحب" : "Withdrawals"}</h3>
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
          <Label className="text-xs">{lang === "ar" ? "ملاحظة" : "Note"}</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="md:col-span-2 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div><div className="text-muted-foreground">{lang === "ar" ? "المبلغ" : "Amount"}</div><div className="font-semibold">{amt} SAR</div></div>
          <div><div className="text-muted-foreground">{lang === "ar" ? "الرسوم" : "Fee"}</div><div>-{fee} SAR</div></div>
          <div><div className="text-muted-foreground">{lang === "ar" ? "الصافي" : "Net"}</div><div className="font-bold text-success">{net} SAR</div></div>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" className="gap-2"><ArrowUpFromLine className="h-4 w-4" />{lang === "ar" ? "إرسال طلب السحب" : "Submit withdrawal"}</Button>
        </div>
      </form>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{lang === "ar" ? "السجل" : "History"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-start">#</th>
                <th className="py-2 text-start">{lang === "ar" ? "البنك" : "Bank"}</th>
                <th className="py-2 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                <th className="py-2 text-end">{lang === "ar" ? "الصافي" : "Net"}</th>
                <th className="py-2 text-end">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-2 text-end">{lang === "ar" ? "التاريخ" : "Date"}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{r.id}</td>
                  <td className="py-2">{r.bank}<div className="text-[11px] text-muted-foreground">{r.iban}</div></td>
                  <td className="py-2 text-end">{r.amount} SAR</td>
                  <td className="py-2 text-end font-semibold">{r.net} SAR</td>
                  <td className="py-2 text-end">
                    <Badge variant="outline" className={cn("text-[10px]",
                      r.status === "completed" && "border-success/40 text-success",
                      r.status === "review"    && "border-warning/40 text-warning",
                      r.status === "rejected"  && "border-danger/40 text-danger")}>
                      {r.status === "completed" ? (lang === "ar" ? "مكتمل" : "Completed")
                        : r.status === "review" ? (lang === "ar" ? "قيد المراجعة" : "Under review")
                        : (lang === "ar" ? "مرفوض" : "Rejected")}
                    </Badge>
                  </td>
                  <td className="py-2 text-end text-xs text-muted-foreground">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
