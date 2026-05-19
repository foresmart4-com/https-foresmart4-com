import { useEffect, useState } from "react";
import { Database, Shield, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface BackupRow {
  id: string;
  kind: string;
  status: string;
  size_bytes: number | null;
  encrypted: boolean;
  integrity_ok: boolean | null;
  created_at: string;
  notes: string | null;
}

export function BackupStatusPanel({ ar = false }: { ar?: boolean }) {
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("backup_events" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as unknown as BackupRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const last = rows[0];
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <Card className="p-5 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {ar ? "النسخ الاحتياطي والاستعادة" : "Backup & Recovery"}
          </h3>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-border/40 p-3 bg-muted/10">
          <div className="text-[10px] text-muted-foreground uppercase">{ar ? "الحالة" : "Status"}</div>
          <div className="text-sm font-semibold mt-1 flex items-center gap-1.5">
            {last?.status === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : last?.status === "failed" ? <AlertTriangle className="h-4 w-4 text-red-500" />
              : <Database className="h-4 w-4 text-muted-foreground" />}
            {last?.status ?? "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border/40 p-3 bg-muted/10">
          <div className="text-[10px] text-muted-foreground uppercase">{ar ? "آخر نسخة" : "Last Backup"}</div>
          <div className="text-sm font-semibold mt-1">
            {last ? new Date(last.created_at).toLocaleString() : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border/40 p-3 bg-muted/10">
          <div className="text-[10px] text-muted-foreground uppercase">{ar ? "فشل (آخر 20)" : "Failures (last 20)"}</div>
          <div className="text-sm font-semibold mt-1">
            <Badge variant={failedCount > 0 ? "destructive" : "secondary"}>{failedCount}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            {ar ? "لا توجد سجلات بعد. سيتم تسجيلها تلقائياً." : "No records yet. Backups log automatically."}
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-xs rounded-md border border-border/40 p-2 bg-background/40">
            <div className="flex items-center gap-2">
              <Badge variant={r.status === "success" ? "secondary" : "destructive"} className="text-[9px] uppercase">
                {r.kind}
              </Badge>
              <span>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {r.encrypted && <Shield className="h-3 w-3" />}
              {r.integrity_ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                : r.integrity_ok === false ? <AlertTriangle className="h-3 w-3 text-red-500" />
                : null}
              <span>{r.size_bytes ? `${(r.size_bytes / 1024 / 1024).toFixed(1)} MB` : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 text-[10px] text-muted-foreground space-y-0.5">
        <p>{ar ? "• النسخ الاحتياطي اليومي مفعّل عبر Lovable Cloud" : "• Daily backups managed by Lovable Cloud"}</p>
        <p>{ar ? "• استعادة لحظة زمنية متاحة (7 أيام)" : "• Point-in-time recovery: 7-day window"}</p>
        <p>{ar ? "• التخزين مشفّر باستخدام AES-256" : "• Storage encrypted with AES-256"}</p>
      </div>
    </Card>
  );
}
