import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/archive")({
  component: ArchivePage,
});

interface Row {
  id: string; symbol: string; asset_name: string; price: number;
  change_pct: number | null; high: number | null; low: number | null;
  volume: number | null; captured_at: string;
}

function ArchivePage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("market_archive").select("*").order("captured_at", { ascending: false }).limit(200)
      .then(({ data }) => data && setRows(data as Row[]));
  }, [user]);

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-6 flex items-center gap-2 font-display text-3xl font-bold">
        <Archive className="h-7 w-7 text-primary" /> {t("archiveTitle")}
      </h1>
      <div className="overflow-hidden rounded-xl gradient-card border border-border shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("asset")}</th>
              <th className="px-4 py-3 text-end">{t("price")}</th>
              <th className="px-4 py-3 text-end">{t("change")}</th>
              <th className="px-4 py-3 text-end">{t("highToday")}</th>
              <th className="px-4 py-3 text-end">{t("lowToday")}</th>
              <th className="px-4 py-3 text-end">{t("capturedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">—</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-semibold">{r.symbol}</div>
                  <div className="text-xs text-muted-foreground">{r.asset_name}</div>
                </td>
                <td className="px-4 py-3 text-end font-medium">{r.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className={cn("px-4 py-3 text-end", (r.change_pct ?? 0) >= 0 ? "text-success" : "text-danger")}>
                  {r.change_pct !== null ? `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-end text-muted-foreground">{r.high?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                <td className="px-4 py-3 text-end text-muted-foreground">{r.low?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "—"}</td>
                <td className="px-4 py-3 text-end text-xs text-muted-foreground">
                  {new Date(r.captured_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
