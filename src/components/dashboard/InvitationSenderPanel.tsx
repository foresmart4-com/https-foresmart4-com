import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Loader2, ShieldCheck, Languages } from "lucide-react";
import { sendInvitationFn, checkAdminFn } from "@/lib/email/email.functions";
import { toast } from "sonner";

interface Props { ar?: boolean }

export function InvitationSenderPanel({ ar = false }: Props) {
  const checkAdmin = useServerFn(checkAdminFn);
  const sendInvite = useServerFn(sendInvitationFn);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [to, setTo] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [redirectTo, setRedirectTo] = useState(
    typeof window !== "undefined" ? `${window.location.origin}/auth` : "https://foresmart4.com/auth"
  );
  const [customUrl, setCustomUrl] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [lang, setLang] = useState<"ar" | "en">(ar ? "ar" : "en");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkAdmin({})
      .then((r) => { if (!cancelled) setIsAdmin(!!(r as { isAdmin: boolean })?.isAdmin); })
      .catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, [checkAdmin]);

  const submit = async () => {
    if (!to.trim()) {
      toast.error(ar ? "أدخل بريد العميل" : "Enter the client's email");
      return;
    }
    if (!customUrl.trim() && !redirectTo.trim()) {
      toast.error(ar ? "أدخل رابط الدعوة أو رابط إعادة التوجيه" : "Provide invite URL or redirect URL");
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const res = (await sendInvite({
        data: {
          to: to.trim(),
          inviteUrl: customUrl.trim() || undefined,
          redirectTo: customUrl.trim() ? undefined : redirectTo.trim(),
          inviterName: inviterName.trim() || undefined,
          personalMessage: personalMessage.trim() || undefined,
          expiresInDays,
          lang,
        },
      })) as { success: boolean; error?: string };
      if (res?.success) {
        setLastResult({ success: true, message: ar ? `تم إرسال الدعوة إلى ${to}` : `Invitation sent to ${to}` });
        toast.success(ar ? "تم إرسال الدعوة" : "Invitation sent");
        setTo("");
        setPersonalMessage("");
      } else {
        const msg = res?.error ?? "Send failed";
        setLastResult({ success: false, message: msg });
        toast.error(msg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLastResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  if (isAdmin === null) {
    return (
      <Card className="p-5 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{ar ? "جارٍ التحقق من الصلاحيات..." : "Checking permissions..."}</span>
      </Card>
    );
  }
  if (!isAdmin) return null;

  return (
    <Card className="p-5 space-y-4" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold">
              {ar ? "إرسال دعوة عميل" : "Send Client Invitation"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {ar ? "أرسل رابط دعوة مخصص إلى عميل جديد عبر البريد." : "Send a branded invitation link to a new client via email."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40">
            <ShieldCheck className="h-3 w-3" /> {ar ? "للمسؤول" : "Admin"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="gap-1"
          >
            <Languages className="h-3 w-3" /> {lang === "ar" ? "AR" : "EN"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inv-to">{ar ? "بريد العميل" : "Client email"} *</Label>
          <Input
            id="inv-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="client@example.com"
            maxLength={320}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-name">{ar ? "اسم المُرسِل (اختياري)" : "Your name (optional)"}</Label>
          <Input
            id="inv-name"
            value={inviterName}
            onChange={(e) => setInviterName(e.target.value)}
            placeholder={ar ? "فريق ForeSmart" : "ForeSmart Team"}
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inv-redirect">{ar ? "رابط إعادة التوجيه بعد القبول" : "Redirect URL after acceptance"}</Label>
          <Input
            id="inv-redirect"
            type="url"
            value={redirectTo}
            onChange={(e) => setRedirectTo(e.target.value)}
            placeholder="https://foresmart4.com/auth"
            maxLength={2048}
          />
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "سيُولَّد رابط دعوة آمن تلقائياً ويعيد توجيه العميل إلى هذا الرابط بعد التحقق."
              : "A secure invite link is auto-generated and redirects the client here after verification."}
          </p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inv-custom">{ar ? "أو رابط مخصص (يستبدل التوليد التلقائي)" : "Or custom invite URL (overrides auto-generated)"}</Label>
          <Input
            id="inv-custom"
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://foresmart4.com/invite/abc123"
            maxLength={2048}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="inv-msg">{ar ? "رسالة شخصية (اختياري)" : "Personal message (optional)"}</Label>
          <Textarea
            id="inv-msg"
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder={ar ? "مرحباً، يسعدنا انضمامك إلى المنصة..." : "Hi, we're excited to have you on the platform..."}
            maxLength={500}
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground text-end">{personalMessage.length}/500</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-days">{ar ? "مدة الصلاحية (أيام)" : "Validity (days)"}</Label>
          <Input
            id="inv-days"
            type="number"
            min={1}
            max={30}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "لغة البريد" : "Email language"}</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>English</Button>
            <Button type="button" size="sm" variant={lang === "ar" ? "default" : "outline"} onClick={() => setLang("ar")}>العربية</Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-xs text-muted-foreground">
          {lastResult && (
            <span className={lastResult.success ? "text-emerald-400" : "text-red-400"}>
              {lastResult.message}
            </span>
          )}
        </div>
        <Button onClick={submit} disabled={sending} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {ar ? "إرسال الدعوة" : "Send Invitation"}
        </Button>
      </div>
    </Card>
  );
}
