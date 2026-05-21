import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { submitInterestLead } from "@/lib/interest-leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  interested_plan: z.enum(["trial", "quarterly", "semi_annual", "annual"]),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function InterestForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { lang } = useI18n();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submitLead = useServerFn(submitInterestLead);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    interested_plan: "trial" as "trial" | "quarterly" | "semi_annual" | "annual",
    notes: "",
  });

  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(t("الرجاء تعبئة الحقول بشكل صحيح", "Please fill the form correctly"));
      return;
    }
    setLoading(true);
    try {
      await submitLead({ data: {
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        interested_plan: parsed.data.interested_plan,
        notes: parsed.data.notes || null,
      }});
      setDone(true);
      toast.success(t("تم استلام طلبك! سنرسل لك رابط الدعوة قريباً", "Received! We'll email your invite soon"));
      onSuccess?.();
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("Too many")) {
        toast.error(t("محاولات كثيرة، حاول لاحقاً", "Too many submissions, try later"));
      } else {
        toast.error(t("تعذر الإرسال، حاول لاحقاً", "Could not submit, try again"));
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl gradient-card border border-border p-8 text-center shadow-card">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h3 className="font-display text-xl font-bold">
          {t("شكراً لاهتمامك!", "Thanks for your interest!")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "سنتواصل معك على البريد الإلكتروني ونرسل لك رابط الدعوة خلال 24 ساعة.",
            "We'll email your invite link within 24 hours.",
          )}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl gradient-card border border-border p-6 shadow-card space-y-4"
    >
      <div>
        <h3 className="font-display text-2xl font-bold">
          {t("سجّل اهتمامك واحصل على دعوة", "Register interest & get an invite")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "تجربة مجانية 14 يوم. ثم 3 أشهر بـ100 ريال، 6 أشهر بـ150 ريال، أو سنة كاملة بـ200 ريال.",
            "14-day free trial. Then 3 mo / 100 SAR, 6 mo / 150 SAR, or 12 mo / 200 SAR.",
          )}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("الاسم الكامل", "Full name")}</Label>
          <Input
            id="full_name"
            required
            maxLength={120}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("البريد الإلكتروني", "Email")}</Label>
          <Input
            id="email"
            type="email"
            required
            maxLength={255}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("رقم الجوال (اختياري)", "Phone (optional)")}</Label>
          <Input
            id="phone"
            type="tel"
            maxLength={40}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("الخطة المفضّلة", "Preferred plan")}</Label>
          <Select
            value={form.interested_plan}
            onValueChange={(v) =>
              setForm({ ...form, interested_plan: v as typeof form.interested_plan })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">
                {t("تجربة مجانية 14 يوم", "14-day free trial")}
              </SelectItem>
              <SelectItem value="quarterly">
                {t("3 أشهر — 100 ريال", "3 months — 100 SAR")}
              </SelectItem>
              <SelectItem value="semi_annual">
                {t("6 أشهر — 150 ريال", "6 months — 150 SAR")}
              </SelectItem>
              <SelectItem value="annual">
                {t("سنة كاملة — 200 ريال", "12 months — 200 SAR")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("ملاحظات (اختياري)", "Notes (optional)")}</Label>
        <Textarea
          id="notes"
          maxLength={1000}
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
      >
        {loading
          ? t("جارٍ الإرسال...", "Sending...")
          : t("أرسل لي رابط الدعوة", "Send me an invite link")}
      </Button>
    </form>
  );
}
