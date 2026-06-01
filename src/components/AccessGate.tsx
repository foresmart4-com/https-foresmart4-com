import { type ReactNode } from "react";
import { useAccess } from "@/lib/use-access";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

export function AccessGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const { loading, role, accepted, canAccess } = useAccess();

  if (loading || role === null || accepted === null) {
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

  // DISCLAIMER MODAL — temporarily disabled
  // was: if (!accepted) { show disclaimer gate }

  return <>{children}</>;
}
