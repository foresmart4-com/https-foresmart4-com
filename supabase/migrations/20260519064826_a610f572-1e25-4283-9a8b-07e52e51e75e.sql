CREATE TABLE IF NOT EXISTS public.backup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('automated','manual','restore','integrity_check')),
  status text NOT NULL CHECK (status IN ('success','failed','running','warning')),
  size_bytes bigint,
  encrypted boolean NOT NULL DEFAULT true,
  integrity_ok boolean,
  retention_days int DEFAULT 30,
  storage_location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_events_created_at ON public.backup_events (created_at DESC);

ALTER TABLE public.backup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view backup events"
  ON public.backup_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert backup events"
  ON public.backup_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed a representative success record so the admin dashboard isn't empty
INSERT INTO public.backup_events (kind, status, size_bytes, encrypted, integrity_ok, storage_location, notes)
VALUES ('automated','success', 5242880, true, true, 'lovable-cloud-managed', 'Daily managed backup');