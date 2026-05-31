import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { askGenesisAdvisor } from "@/lib/genesisAdvisor.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send, Loader2, AlertTriangle } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/_app/genesis-advisor")({
  component: () => (
    <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة">
      <GenesisAdvisorPage />
    </ErrorBoundary>
  ),
  head: () => ({
    meta: [
      { title: "Genesis المستشار المؤسسي — ForeSmart" },
      {
        name: "description",
        content:
          "تحليل اقتصادي مؤسسي مبني على بيانات Federal Reserve — Genesis Institutional Advisor",
      },
    ],
  }),
});

function GenesisAdvisorPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = useServerFn(askGenesisAdvisor);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await ask({ data: { question: question.trim(), lang: "ar" } });
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Brain className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Genesis المستشار المؤسسي
            </h1>
            <p className="text-sm text-muted-foreground">
              تحليل اقتصادي مؤسسي مبني على بيانات Federal Reserve
            </p>
          </div>
        </div>

        {/* Methodology badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          {["Ray Dalio", "Warren Buffett", "George Soros", "BlackRock"].map(
            (name) => (
              <span
                key={name}
                className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              >
                {name}
              </span>
            )
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="اكتب سؤالك الاستثماري هنا... مثال: ما رأيك في السوق السعودي الآن؟"
            className="min-h-[120px] text-base resize-none text-right"
            dir="rtl"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !question.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Genesis يحلل...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                تحليل
              </span>
            )}
          </Button>
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Response */}
        {result && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <Brain className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                تحليل Genesis المؤسسي
              </span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-right [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mt-5 [&>h2]:mb-2 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pr-4 [&>table]:w-full [&>table]:text-sm">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
