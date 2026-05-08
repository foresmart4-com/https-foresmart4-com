import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAdvisor } from "@/lib/ai-advisor.functions";
import { getMarketData } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/advisor")({
  component: AdvisorPage,
});

function AdvisorPage() {
  const { t, lang } = useI18n();
  const ask = useServerFn(askAdvisor);
  const { data: market } = useQuery({ queryKey: ["market"], queryFn: () => getMarketData() });
  const [q, setQ] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setReply("");
    const ctx = (market?.assets ?? [])
      .slice(0, 12)
      .map((a) => `${a.symbol}: ${a.price} (${a.changePct.toFixed(2)}%)`)
      .join("\n");
    const res = await ask({ data: { question: q, language: lang, context: ctx } });
    setBusy(false);
    if (res.error === "rate_limited") toast.error(lang === "ar" ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit, try again");
    else if (res.error === "payment_required") toast.error(lang === "ar" ? "أضف رصيداً في إعدادات Lovable AI" : "Add credits in Lovable AI settings");
    else if (res.error) toast.error(res.error);
    else setReply(res.reply);
  };

  const suggestions = lang === "ar"
    ? ["هل أشتري الذهب الآن؟", "ما توقعك للبتكوين هذا الأسبوع؟", "كيف تؤثر التوترات الجيوسياسية على النفط؟"]
    : ["Should I buy gold now?", "BTC outlook this week?", "How do geopolitical tensions affect oil?"];

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
          <Brain className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{t("advisor")}</h1>
          <p className="text-sm text-muted-foreground">{t("advisorPlaceholder")}</p>
        </div>
      </div>

      <div className="rounded-xl gradient-card border border-border p-5 shadow-card">
        <Textarea
          rows={4}
          placeholder={t("advisorPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => setQ(s)} className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={send} disabled={busy} className="gradient-primary text-primary-foreground">
            <Send className="me-2 h-4 w-4" />
            {busy ? t("loading") : t("send")}
          </Button>
        </div>
      </div>

      {reply && (
        <div className="mt-6 rounded-xl gradient-card border border-border p-6 shadow-card">
          <div className="mb-3 text-xs uppercase tracking-wide text-primary">{t("aiAdvice")}</div>
          <article className="prose prose-invert max-w-none prose-headings:font-display prose-p:text-foreground/90 prose-strong:text-foreground">
            <ReactMarkdown>{reply}</ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}
