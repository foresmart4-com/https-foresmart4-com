import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, type AppRole } from "@/lib/use-access";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Users, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/members")({
  component: MembersPage,
});

interface Row { user_id: string; role: AppRole; display_name: string | null; created_at: string }

function MembersPage() {
  const { t } = useI18n();
  const { isAdmin, loading } = useAccess();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (!roles) return;
    const ids = [...new Set(roles.map((r) => r.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    // Aggregate: pick best role per user
    const best = new Map<string, Row>();
    for (const r of roles) {
      const cur = best.get(r.user_id);
      const rank = (x: AppRole) => (x === "admin" ? 0 : x === "subscriber" ? 1 : 2);
      if (!cur || rank(r.role as AppRole) < rank(cur.role)) {
        best.set(r.user_id, { user_id: r.user_id, role: r.role as AppRole, display_name: nameMap.get(r.user_id) ?? null, created_at: r.created_at });
      }
    }
    setRows([...best.values()]);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const setRole = async (user_id: string, newRole: AppRole) => {
    // Remove existing non-admin roles, then add the new one
    await supabase.from("user_roles").delete().eq("user_id", user_id).neq("role", "admin");
    if (newRole !== "admin") {
      const { error } = await supabase.from("user_roles").insert({ user_id, role: newRole });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t("saved"));
    load();
  };

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <Users className="h-7 w-7 text-primary" /> {t("members")}
      </h1>

      <div className="rounded-xl gradient-card border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("member")}</th>
              <th className="px-4 py-3 text-start">{t("role")}</th>
              <th className="px-4 py-3 text-end">—</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.display_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.user_id.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3">
                  <span className={
                    r.role === "admin" ? "rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary" :
                    r.role === "subscriber" ? "rounded-full bg-success/15 px-2 py-0.5 text-xs text-success" :
                    "rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning"
                  }>
                    {t(r.role)}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  {r.role !== "admin" && (
                    <div className="flex justify-end gap-2">
                      {r.role !== "subscriber" && (
                        <Button size="sm" variant="outline" onClick={() => setRole(r.user_id, "subscriber")}>
                          <Check className="me-1 h-3 w-3" /> {t("activate")}
                        </Button>
                      )}
                      {r.role !== "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => setRole(r.user_id, "pending")}>
                          <X className="me-1 h-3 w-3" /> {t("revoke")}
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
