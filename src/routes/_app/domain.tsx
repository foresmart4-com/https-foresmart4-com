import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/lib/use-access";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, Copy, ShieldAlert, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/domain")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><DomainPage /></ErrorBoundary>,
});

function Row({ label, value }: { label: string; value: string }) {
  const copy = () => { navigator.clipboard.writeText(value); toast.success("Copied"); };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-sm truncate">{value}</div>
      </div>
      <Button size="icon" variant="ghost" onClick={copy}><Copy className="h-4 w-4" /></Button>
    </div>
  );
}

function DomainPage() {
  const { lang, dir } = useI18n();
  const { isAdmin, loading } = useAccess();

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground">…</div>;
  if (!isAdmin) return <Navigate to="/settings" />;

  const ar = lang === "ar";

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <Link to="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
        {ar ? "العودة إلى الضبط" : "Back to Settings"}
      </Link>

      <h1 className="mb-2 flex items-center gap-2 font-display text-3xl font-bold">
        <Globe className="h-7 w-7 text-primary" />
        {ar ? "ضبط الدومين" : "Domain Settings"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {ar
          ? "هذه الصفحة مخصصة للمطور/المالك فقط لإدارة دومين الموقع."
          : "Developer/owner only — manage the site domain."}
      </p>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
        <div className="text-sm">
          {ar
            ? "الإعدادات الفعلية للدومين تتم من لوحة Lovable (Project Settings → Domains). هذه الصفحة دليل سريع."
            : "Actual domain configuration happens in the Lovable dashboard (Project Settings → Domains). This page is a quick reference."}
        </div>
      </div>

      <section className="mb-6 rounded-xl gradient-card border border-border p-5 shadow-card space-y-3">
        <h2 className="font-display text-lg font-semibold">
          {ar ? "خطوات الربط (GoDaddy وغيره)" : "Connect a domain (GoDaddy, etc.)"}
        </h2>
        <ol className="list-decimal space-y-2 ps-5 text-sm">
          <li>{ar ? "انشر المشروع أولاً عبر زر النشر." : "Publish the project first."}</li>
          <li>
            {ar ? "افتح " : "Open "}
            <strong>Project Settings → Domains</strong>
            {ar ? " ثم اضغط Connect Domain." : " and click Connect Domain."}
          </li>
          <li>{ar ? "أدخل الدومين (مثل yourdomain.com)." : "Enter your domain (e.g. yourdomain.com)."}</li>
          <li>{ar ? "أضف سجلات DNS التالية في لوحة المسجّل:" : "Add the following DNS records at your registrar:"}</li>
        </ol>

        <div className="grid gap-2 pt-2">
          <Row label="A — @ (root)" value="185.158.133.1" />
          <Row label="A — www" value="185.158.133.1" />
          <Row label="TXT — _lovable" value="lovable_verify=… (من لوحة Lovable)" />
        </div>

        <p className="pt-2 text-xs text-muted-foreground">
          {ar
            ? "انتشار DNS قد يستغرق من 15 دقيقة حتى 72 ساعة. سيتم تفعيل SSL تلقائياً."
            : "DNS propagation can take 15 minutes to 72 hours. SSL is provisioned automatically."}
        </p>
      </section>

      <section className="rounded-xl gradient-card border border-border p-5 shadow-card space-y-3">
        <h2 className="font-display text-lg font-semibold">
          {ar ? "روابط مفيدة" : "Useful links"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="https://docs.lovable.dev/features/custom-domain" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 me-2" />
              {ar ? "دليل الدومين الرسمي" : "Custom Domain Docs"}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="https://dnschecker.org" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 me-2" />
              DNS Checker
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="https://lovable.dev/projects" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 me-2" />
              {ar ? "لوحة Lovable" : "Lovable Dashboard"}
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
