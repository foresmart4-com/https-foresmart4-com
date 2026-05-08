import { useState, type ReactNode } from "react";
import { useAccess } from "@/lib/use-access";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";

export function AccessGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const { loading, role, accepted, acceptDisclaimer, canAccess } = useAccess();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading || role === null) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  }

  // Pending approval
  if (!canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-lg rounded-2xl gradient-card border border-border p-8 shadow-card text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-warning/10">
            <Clock className="h-7 w-7 text-warning" />
          </div>
          <h1 className="font-display text-2xl font-bold">{t("pendingTitle")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("pendingDesc")}</p>
          <Button onClick={signOut} variant="outline" className="mt-6">
            <LogOut className="me-2 h-4 w-4" /> {t("logout")}
          </Button>
        </div>
      </div>
    );
  }

  // Disclaimer not yet accepted
  if (!accepted) {
    const submit = async () => {
      if (!agree) { toast.error(t("mustAccept")); return; }
      setBusy(true);
      const { error } = await acceptDisclaimer();
      setBusy(false);
      if (error) toast.error(error);
    };
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="max-w-2xl rounded-2xl gradient-card border border-border p-8 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-danger/10">
              <ShieldAlert className="h-6 w-6 text-danger" />
            </div>
            <h1 className="font-display text-2xl font-bold">{t("disclaimerTitle")}</h1>
          </div>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-muted/30 p-4 text-sm leading-relaxed text-foreground/90">
            {t("disclaimerBody")}
          </div>
          <label className="mt-5 flex items-start gap-3 cursor-pointer">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
            <span className="text-sm">{t("iAccept")}</span>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={signOut}>{t("logout")}</Button>
            <Button onClick={submit} disabled={busy || !agree} className="gradient-primary text-primary-foreground">
              {busy ? t("loading") : t("iAccept")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
