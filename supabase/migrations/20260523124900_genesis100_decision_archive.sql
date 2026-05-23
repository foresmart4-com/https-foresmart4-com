-- ForeSmart Genesis 100 decision archive persistence scaffold.
-- Runtime uses an in-memory archive until server-side persistence is wired.

CREATE TABLE IF NOT EXISTS public.genesis100_decision_archive (
  id text PRIMARY KEY,
  wallet_id uuid REFERENCES public.genesis100_wallets(id) ON DELETE CASCADE,
  user_id uuid,
  cycle_id text NOT NULL,
  symbol text NOT NULL,
  asset_name text NOT NULL,
  asset_class text NOT NULL,
  previous_recommendation text,
  new_recommendation text NOT NULL,
  decision_confidence_percent numeric NOT NULL DEFAULT 0,
  final_decision_score numeric NOT NULL DEFAULT 0,
  target_weight numeric NOT NULL DEFAULT 0,
  previous_weight numeric NOT NULL DEFAULT 0,
  action text NOT NULL,
  reason_ar text NOT NULL,
  reason_en text NOT NULL,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  quote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_mode text NOT NULL CHECK (ai_mode IN ('off','semi_ai','full_ai')),
  execution_mode text NOT NULL CHECK (execution_mode IN ('analysis_only','paper','live_blocked','live')),
  created_by text NOT NULL DEFAULT 'genesis100-ai',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_decision_archive_symbol_time
  ON public.genesis100_decision_archive(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_genesis100_decision_archive_cycle
  ON public.genesis100_decision_archive(cycle_id);
CREATE INDEX IF NOT EXISTS idx_genesis100_decision_archive_user_time
  ON public.genesis100_decision_archive(user_id, created_at DESC);

ALTER TABLE public.genesis100_decision_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own genesis100 decision archive" ON public.genesis100_decision_archive;
CREATE POLICY "users read own genesis100 decision archive"
  ON public.genesis100_decision_archive FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny client inserts genesis100 decision archive" ON public.genesis100_decision_archive;
DROP POLICY IF EXISTS "deny client updates genesis100 decision archive" ON public.genesis100_decision_archive;
DROP POLICY IF EXISTS "deny client deletes genesis100 decision archive" ON public.genesis100_decision_archive;
CREATE POLICY "deny client inserts genesis100 decision archive"
  ON public.genesis100_decision_archive AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 decision archive"
  ON public.genesis100_decision_archive AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 decision archive"
  ON public.genesis100_decision_archive AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);
