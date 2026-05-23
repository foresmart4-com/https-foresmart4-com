import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, ExternalLink, History } from "lucide-react";

export const Route = createFileRoute("/_app/changelog")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><ChangelogPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Changelog — ForeSmart" },
      { name: "description", content: "Published frontend releases with date and summary." },
    ],
  }),
});

const TAG_LABEL: Record<NonNullable<ChangelogEntry["tag"]>, { ar: string; en: string; cls: string }> = {
  feature: { ar: "ميزة", en: "Feature", cls: "bg-primary/15 text-primary" },
  fix: { ar: "إصلاح", en: "Fix", cls: "bg-amber-500/15 text-amber-500" },
  security: { ar: "أمان", en: "Security", cls: "bg-red-500/15 text-red-500" },
  performance: { ar: "أداء", en: "Performance", cls: "bg-emerald-500/15 text-emerald-500" },
  ui: { ar: "واجهة", en: "UI", cls: "bg-blue-500/15 text-blue-500" },
};

function ChangelogPage() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const editorUrl = "https://lovable.dev/projects/5a68377c-93dc-42f4-9999-fc0850af1ae2";
  const liveUrl = "https://foresmart4.com";

  const latest = CHANGELOG[0];

  return (
    <div dir={dir} className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            {isAr ? "سجل التغييرات" : "Changelog"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? "آخر الإصدارات المنشورة من واجهة ForeSmart مع تاريخ وملخص لكل تحديث."
              : "Latest published ForeSmart frontend releases with date and summary."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={editorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              {isAr ? "نشر التحديث الآن" : "Publish update now"}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              {isAr ? "فتح الموقع المباشر" : "Open live site"}
            </a>
          </Button>
        </div>
      </header>

      <Card className="mb-6 border-primary/40 bg-primary/5">
        <CardContent className="p-4 text-sm leading-relaxed">
          {isAr ? (
            <>
              <strong>كيف يعمل النشر بنقرة واحدة؟</strong> اضغط زر <em>نشر التحديث الآن</em> أعلاه — سيفتح
              محرر Lovable حيث تنقر <em>Publish → Update</em> مرة واحدة فقط لإرسال آخر تغييرات الواجهة إلى
              الموقع المباشر. التغييرات الخلفية (قواعد البيانات والدوال) تُنشر تلقائيًا.
            </>
          ) : (
            <>
              <strong>How does one-click publish work?</strong> Click <em>Publish update now</em> above —
              it opens the Lovable editor where a single <em>Publish → Update</em> click ships the latest
              frontend to the live site. Backend changes (database, server functions) deploy automatically.
            </>
          )}
        </CardContent>
      </Card>

      {latest && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-primary/50 text-primary">
            {isAr ? "أحدث نسخة" : "Latest"}
          </Badge>
          <span>{latest.version} · {latest.date}</span>
        </div>
      )}

      <ol className="space-y-4">
        {CHANGELOG.map((entry, idx) => {
          const tag = entry.tag ? TAG_LABEL[entry.tag] : null;
          return (
            <li key={entry.version}>
              <Card className={idx === 0 ? "border-primary/40" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base sm:text-lg">
                      {isAr ? entry.title_ar : entry.title_en}
                    </CardTitle>
                    {tag && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tag.cls}`}>
                        {isAr ? tag.ar : tag.en}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{entry.version}</span>
                    <span className="mx-2">·</span>
                    <time dateTime={entry.date}>
                      {new Date(entry.date).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </time>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="list-disc space-y-1 ps-5 text-sm text-foreground/90">
                    {(isAr ? entry.highlights_ar : entry.highlights_en).map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        {isAr
          ? "يتم تحديث هذه القائمة يدويًا مع كل نشر. عدّل src/lib/changelog.ts لإضافة نسخة جديدة."
          : "This list is maintained manually with every publish. Edit src/lib/changelog.ts to add a new release."}
      </p>
    </div>
  );
}
