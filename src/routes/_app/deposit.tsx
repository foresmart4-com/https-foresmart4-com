import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownToLine, Wallet, ShieldCheck, Clock, CheckCircle2, XCircle, Info, Copy, Ban } from "lucide-react";
import { toast } from "sonner";
import { calcTransferFee, depositHistoryMock, type DepositRecord } from "@/lib/mock-data";
import { logEvent } from "@/lib/tradingJournal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/deposit")({ component: DepositPage });

type Method = DepositRecord["method"];

const METHODS: { value: Method; ar: string; en: string; future?: boolean }[] = [
  { value: "payment_link",  ar: "رابط دفع",                 en: "Payment link" },
  { value: "manual_bank",   ar: "تحويل بنكي يدوي",          en: "Manual bank transfer" },
  { value: "mada_visa_mc",  ar: "مدى / Visa / Mastercard",  en: "mada / Visa / Mastercard" },
  { value: "moyasar",       ar: "Moyasar (قريباً)",          en: "Moyasar (soon)", future: true },
  { value: "paytabs",       ar: "PayTabs (قريباً)",          en: "PayTabs (soon)", future: true },
  { value: "tap",           ar: "Tap Payments (قريباً)",     en: "Tap Payments (soon)", future: true },
];

function statusBadge(s: DepositRecord["status"], lang: "ar" | "en") {
  const map = {
    review:    { cls: "bg-warning/15 text-warning border-warning/30",   ar: "قيد المراجعة", en: "Under review", Icon: Clock },
    completed: { cls: "bg-success/15 text-success border-success/30",   ar: "مكتمل",        en: "Completed",    Icon: CheckCircle2 },
    rejected:  { cls: "bg-danger/15 text-danger border-danger/30",      ar: "مرفوض",        en: "Rejected",     Icon: XCircle },
  } as const;
  const m = map[s]; const Icon = m.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", m.cls)}>
      <Icon className="h-3 w-3" />{lang === "ar" ? m.ar : m.en}
    </span>
  );
}

function DepositPage() {
  const { lang, dir } = useI18n();
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState<Method>("mada_visa_mc");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<DepositRecord[]>(depositHistoryMock);

  const amt = Number(amount) || 0;
  const fee = calcTransferFee(amt);
  const net = Math.max(0, amt - fee);
  const selectedMethod = METHODS.find((m) => m.value === method)!;

  const submit = () => {
    if (amt < 100) { toast.error(lang === "ar" ? "الحد الأدنى 100 ريال" : "Min 100 SAR"); return; }
    if (selectedMethod.future) { toast.info(lang === "ar" ? "بوابة قيد التفعيل لاحقاً" : "Gateway not active yet"); return; }
    const year = new Date().getFullYear();
    const seq = String(1000 + history.length + 1).padStart(4, "0");
    const refId = `DEP-${year}-${seq}`;
    const rec: DepositRecord = {
      id: refId,
      date: new Date().toISOString().slice(0, 10),
      amountSar: amt, method, status: "review", notes: notes || undefined,
    };
    setHistory((h) => [rec, ...h]);
    setNotes("");
    logEvent({ source: "deposit", eventKind: "created", refId, amount: amt, status: "manual_review", notes: `${methodLabel(method)} — صافي ${net}` });
    toast.success(lang === "ar" ? `تم إنشاء طلب الإيداع ${refId} — قيد المراجعة` : `Deposit ${refId} submitted — under review`);
  };

  const copyRef = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(id);
    toast.success(lang === "ar" ? `تم نسخ ${id}` : `Copied ${id}`);
  };

  const cancelRequest = (id: string) => {
    setHistory((h) => h.map((r) => r.id === id ? { ...r, status: "rejected" } : r));
    logEvent({ source: "deposit", eventKind: "cancelled", refId: id, status: "rejected", notes: "إلغاء من قبل المستخدم" });
    toast.success(lang === "ar" ? `تم إلغاء الطلب ${id}` : `Cancelled ${id}`);
  };

  const methodLabel = useMemo(() => (m: Method) => {
    const x = METHODS.find((y) => y.value === m)!; return lang === "ar" ? x.ar : x.en;
  }, [lang]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "إيداع الرصيد" : "Deposit funds"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "أنشئ طلب إيداع باستخدام إحدى طرق الدفع المعتمدة." : "Create a deposit request with one of the supported methods."}
          </p>
        </div>
        <Link to="/wallet"><Button variant="outline" className="gap-2"><Wallet className="h-4 w-4" />{lang === "ar" ? "رجوع إلى المحفظة" : "Back to Wallet"}</Button></Link>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
        <Info className="h-4 w-4 shrink-0 text-warning" />
        <span>
          {lang === "ar"
            ? "تنبيه: هذا طلب إيداع يخضع لمراجعة الإدارة قبل إضافته إلى رصيدك، وليس إيداعاً بنكياً فورياً. سيتم إشعارك عند اعتماد الطلب."
            : "Notice: this is a deposit request reviewed by admin before crediting — it is not an instant bank deposit. You will be notified upon approval."}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gradient-card p-6 lg:col-span-2 space-y-5">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            {lang === "ar" ? "نموذج إيداع جديد" : "New deposit"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">{lang === "ar" ? "المبلغ (ريال)" : "Amount (SAR)"}</Label>
              <Input type="number" min={100} step={10} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">{lang === "ar" ? "طريقة الدفع" : "Payment method"}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {lang === "ar" ? m.ar : m.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">{lang === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === "ar" ? "مرجع التحويل، اسم المرسل، إلخ" : "Transfer reference, sender name, etc."} />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />{lang === "ar" ? "ملخّص الرسوم" : "Fee summary"}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><div className="text-xs text-muted-foreground">{lang === "ar" ? "المبلغ" : "Amount"}</div><div className="font-semibold">{amt.toLocaleString()} SAR</div></div>
              <div><div className="text-xs text-muted-foreground">{lang === "ar" ? "رسوم التحويل" : "Transfer fee"}</div><div className="text-danger">-{fee} SAR</div></div>
              <div><div className="text-xs text-muted-foreground">{lang === "ar" ? "الصافي" : "Net credit"}</div><div className="font-bold text-success">{net.toLocaleString()} SAR</div></div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {lang === "ar" ? "الرسوم: 5 ريال للمبالغ أقل من 1000 ريال، و10 ريال للمبالغ 1000 ريال فأكثر." : "Fees: 5 SAR under 1,000 SAR; 10 SAR for 1,000 SAR and above."}
            </p>
          </div>

          <Button onClick={submit} className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            {lang === "ar" ? "إرسال طلب الإيداع" : "Submit deposit request"}
          </Button>
        </Card>

        <Card className="gradient-card p-6 space-y-3">
          <h3 className="font-display text-base font-bold">{lang === "ar" ? "تعليمات سريعة" : "Quick guide"}</h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2"><Info className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />{lang === "ar" ? "مدى / Visa / Mastercard: دفع فوري عبر بوابة آمنة." : "mada / Visa / Mastercard: instant secure checkout."}</li>
            <li className="flex gap-2"><Info className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />{lang === "ar" ? "تحويل بنكي يدوي: نُراجع الإيصال خلال 24 ساعة." : "Manual bank: reviewed within 24h."}</li>
            <li className="flex gap-2"><Info className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />{lang === "ar" ? "روابط Moyasar / PayTabs / Tap قيد التفعيل." : "Moyasar / PayTabs / Tap links coming soon."}</li>
            <li className="flex gap-2"><Info className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />{lang === "ar" ? "لا يتم اعتماد الإيداع إلا بعد مراجعة الإدارة." : "Deposits require admin review before crediting."}</li>
          </ul>
          <Badge variant="outline" className="mt-2">{lang === "ar" ? "العملة الافتراضية: SAR" : "Default currency: SAR"}</Badge>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <header className="border-b border-border bg-muted/30 px-5 py-3 font-semibold">
          {lang === "ar" ? "طلبات الإيداع السابقة" : "Previous deposit requests"}
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start">{lang === "ar" ? "الرقم" : "ID"}</th>
              <th className="px-4 py-2 text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="px-4 py-2 text-start">{lang === "ar" ? "الطريقة" : "Method"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "الرسوم" : "Fee"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "الصافي" : "Net"}</th>
              <th className="px-4 py-2 text-end">{lang === "ar" ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => {
              const f = calcTransferFee(r.amountSar);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2 text-xs">{methodLabel(r.method)}</td>
                  <td className="px-4 py-2 text-end">{r.amountSar.toLocaleString()} SAR</td>
                  <td className="px-4 py-2 text-end text-danger">-{f}</td>
                  <td className="px-4 py-2 text-end font-medium text-success">{(r.amountSar - f).toLocaleString()}</td>
                  <td className="px-4 py-2 text-end">{statusBadge(r.status, lang as "ar" | "en")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
