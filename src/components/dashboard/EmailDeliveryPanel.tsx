import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Send, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { getEmailHealthFn, sendTestEmailFn } from "@/lib/email/email.functions";
import { toast } from "sonner";

interface Health {
  configured: boolean;
  sender: string;
  status: "ok" | "degraded" | "down" | "unconfigured";
  totals: { sent: number; failed: number; pending: number; total: number };
  successRate: number;
  lastSentAt?: string | null;
  lastError?: string | null;
}

const STATUS_TONE: Record<Health["status"], { color: string; label: string; Icon: typeof CheckCircle2 }> = {
  ok:           { color: "text-emerald-400", label: "Operational",  Icon: CheckCircle2 },
  degraded:     { color: "text-amber-400",   label: "Degraded",     Icon: AlertTriangle },
  down:         { color: "text-red-400",     label: "Down",         Icon: XCircle },
  unconfigured: { color: "text-muted-foreground", label: "Unconfigured", Icon: AlertTriangle },
};

export function EmailDeliveryPanel() {
  const fetchHealth = useServerFn(getEmailHealthFn);
  const sendTest = useServerFn(sendTestEmailFn);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchHealth({ data: { windowHours: 24 } });
      setHealth(data as Health);
      setForbidden(false);
    } catch (e: any) {
      if (String(e?.message ?? "").includes("Forbidden")) setForbidden(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleTest = async (lang: "en" | "ar") => {
    setSending(true);
    try {
      const r = await sendTest({ data: { lang } });
      if ((r as any)?.success) toast.success(lang === "ar" ? "تم إرسال بريد الاختبار" : "Test email sent");
      else toast.error((r as any)?.error ?? "Failed to send");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (forbidden) return null;

  const tone = STATUS_TONE[health?.status ?? "unconfigured"];
  const Icon = tone.Icon;

  return (
    <Card className="p-5 bg-card/40 border-border/60 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide uppercase text-foreground">Email Delivery</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Resend · {health?.sender ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`gap-1.5 ${tone.color} border-current/30`}>
            <Icon className="w-3 h-3" /> {tone.label}
          </Badge>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Metric label="Sent" value={health?.totals.sent ?? 0} tone="text-emerald-400" />
        <Metric label="Failed" value={health?.totals.failed ?? 0} tone="text-red-400" />
        <Metric label="Pending" value={health?.totals.pending ?? 0} tone="text-amber-400" />
        <Metric label="Success" value={`${Math.round((health?.successRate ?? 1) * 100)}%`} tone="text-primary" />
      </div>

      {health?.lastError && (
        <div className="mb-3 p-2 rounded-md bg-red-500/5 border border-red-500/20 text-xs text-red-300 break-words">
          Last error: {health.lastError}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => handleTest("en")} disabled={sending || !health?.configured} className="flex-1">
          <Send className="w-3.5 h-3.5 mr-1.5" /> Test EN
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTest("ar")} disabled={sending || !health?.configured} className="flex-1">
          <Send className="w-3.5 h-3.5 mr-1.5" /> اختبار AR
        </Button>
      </div>

      {!health?.configured && (
        <p className="text-xs text-amber-400/80 mt-3">RESEND_API_KEY not configured on the server.</p>
      )}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="p-2.5 rounded-md bg-background/40 border border-border/40 text-center">
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
