import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, ReceiptText, Info } from "lucide-react";
import { calcTransferFee, MONTHLY_WALLET_FEE_PCT } from "@/lib/mock-data";
import { submitManualTopupRequest } from "@/lib/payments.functions";

type TxKind = "buy" | "sell" | "deposit" | "withdraw";
type PayMethod = "payment_link" | "bank_transfer" | "card_mada" | "moyasar" | "paytabs" | "tap";

export function ManualOperationForm() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [kind, setKind] = useState<TxKind>("deposit");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("payment_link");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submitTopup = useServerFn(submitManualTopupRequest);

  const amt = Number(amount) || 0;
  const fee = (kind === "deposit" || kind === "withdraw") ? calcTransferFee(amt) : 0;
  const monthlyFee = amt > 0 ? +(amt * MONTHLY_WALLET_FEE_PCT).toFixed(2) : 0;
  const net = Math.max(0, amt - fee);

  const submit = async () => {
    if (!user) { toast.error(lang === "ar" ? "يجب تسجيل الدخول" : "Login required"); return; }
    if (amt <= 0) { toast.error(lang === "ar" ? "أدخل مبلغاً صالحاً" : "Enter a valid amount"); return; }
    setBusy(true);
    if (kind === "deposit") {
      try {
        await submitTopup({ data: { amountSar: amt, paymentMethod: method, note: note || undefined } });
        toast.success(lang === "ar" ? "تم إنشاء طلب الإيداع — قيد المراجعة" : "Deposit submitted — under review");
      } catch (e: any) {
        toast.error(e?.message ?? (lang === "ar" ? "تعذّر إرسال الطلب" : "Could not submit request"));
        setBusy(false);
        return;
      }
    } else {
      toast.success(lang === "ar"
        ? `تم تسجيل عملية ${kind} — قيد المراجعة (تجريبي)`
        : `${kind} recorded — under review (demo)`);
    }
    setAmount(""); setNote(""); setBusy(false);
  };

  const labelFor = (k: TxKind) => lang === "ar"
    ? ({ buy: "شراء", sell: "بيع", deposit: "إيداع", withdraw: "سحب" }[k])
    : ({ buy: "Buy",  sell: "Sell", deposit: "Deposit", withdraw: "Withdraw" }[k]);
  const methodLabel = (m: PayMethod) => lang === "ar"
    ? ({ payment_link: "رابط دفع", bank_transfer: "تحويل بنكي يدوي", card_mada: "بطاقة (مدى / Visa / Mastercard)", moyasar: "Moyasar (قريباً)", paytabs: "PayTabs (قريباً)", tap: "Tap Payments (قريباً)" }[m])
    : ({ payment_link: "Payment link", bank_transfer: "Manual bank transfer", card_mada: "Card (mada / Visa / Mastercard)", moyasar: "Moyasar (soon)", paytabs: "PayTabs (soon)", tap: "Tap Payments (soon)" }[m]);

  return (
    <Card className="gradient-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          {lang === "ar" ? "إضافة عملية" : "Add Operation"}
        </h3>
        <Badge variant="outline" className="gap-1 text-[10px]"><Info className="h-3 w-3" />{lang === "ar" ? "حالة الطلب: قيد المراجعة" : "Status: under review"}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{lang === "ar" ? "نوع العملية" : "Operation type"}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as TxKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["deposit","withdraw","buy","sell"] as TxKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {k === "deposit" ? <ArrowDownToLine className="inline me-1 h-3.5 w-3.5" /> :
                   k === "withdraw" ? <ArrowUpFromLine className="inline me-1 h-3.5 w-3.5" /> :
                   <Banknote className="inline me-1 h-3.5 w-3.5" />}
                  {labelFor(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{lang === "ar" ? "المبلغ (ريال)" : "Amount (SAR)"}</Label>
          <Input type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>

        {(kind === "deposit" || kind === "withdraw") && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>{lang === "ar" ? "طريقة الدفع" : "Payment method"}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["payment_link","bank_transfer","card_mada","moyasar","paytabs","tap"] as PayMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5 md:col-span-2">
          <Label>{lang === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {amt > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-4">
          <div><div className="text-muted-foreground">{lang === "ar" ? "المبلغ" : "Amount"}</div><div className="font-semibold">{amt} ﷼</div></div>
          <div><div className="text-muted-foreground">{lang === "ar" ? "رسوم التحويل" : "Transfer fee"}</div><div className="font-semibold text-danger">-{fee} ﷼</div></div>
          <div><div className="text-muted-foreground">{lang === "ar" ? "رسوم محفظة شهرية 0.1%" : "Monthly wallet 0.1%"}</div><div className="font-semibold">{monthlyFee} ﷼</div></div>
          <div><div className="text-muted-foreground">{lang === "ar" ? "الصافي" : "Net"}</div><div className="font-bold text-success">{net} ﷼</div></div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {lang === "ar"
          ? "تحويل أقل من 1,000 ريال = 5 ريال — تحويل 1,000 ريال أو أكثر = 10 ريال. رسوم المحفظة الشهرية 0.1%."
          : "<1,000 SAR = 5 SAR fee — ≥1,000 SAR = 10 SAR. Monthly wallet fee 0.1%."}
      </p>

      <Button className="mt-4 w-full" onClick={submit} disabled={busy || amt <= 0}>
        {busy ? "…" : (lang === "ar" ? "إرسال الطلب" : "Submit request")}
      </Button>
    </Card>
  );
}
