-- ForeSmart Genesis 100 persistence scaffolding.
-- Runtime APIs currently use isolated module-level state; these tables are
-- prepared for server-side persistence without exposing client write access.

CREATE TABLE IF NOT EXISTS public.genesis100_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  capital numeric NOT NULL DEFAULT 0 CHECK (capital >= 0),
  cash_balance numeric NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
  invested_balance numeric NOT NULL DEFAULT 0 CHECK (invested_balance >= 0),
  target_monthly_return numeric NOT NULL DEFAULT 0.025,
  max_drawdown numeric NOT NULL DEFAULT 0.12,
  risk_profile text NOT NULL DEFAULT 'balanced'
    CHECK (risk_profile IN ('conservative','balanced','growth')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active_analysis','paper_trading','execution_ready','paused')),
  live_execution_enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_wallets_user
  ON public.genesis100_wallets(user_id);

ALTER TABLE public.genesis100_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own genesis100 wallets" ON public.genesis100_wallets;
CREATE POLICY "users read own genesis100 wallets"
  ON public.genesis100_wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny client inserts genesis100 wallets" ON public.genesis100_wallets;
DROP POLICY IF EXISTS "deny client updates genesis100 wallets" ON public.genesis100_wallets;
DROP POLICY IF EXISTS "deny client deletes genesis100 wallets" ON public.genesis100_wallets;
CREATE POLICY "deny client inserts genesis100 wallets"
  ON public.genesis100_wallets AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 wallets"
  ON public.genesis100_wallets AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 wallets"
  ON public.genesis100_wallets AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE TABLE IF NOT EXISTS public.genesis100_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.genesis100_wallets(id) ON DELETE CASCADE,
  user_id uuid,
  symbol text NOT NULL,
  action text NOT NULL,
  old_weight numeric NOT NULL DEFAULT 0,
  new_weight numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  quote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_mode text NOT NULL
    CHECK (execution_mode IN ('analysis_only','paper','live_blocked','live')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_decisions_wallet_time
  ON public.genesis100_decisions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_genesis100_decisions_user_time
  ON public.genesis100_decisions(user_id, created_at DESC);

ALTER TABLE public.genesis100_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own genesis100 decisions" ON public.genesis100_decisions;
CREATE POLICY "users read own genesis100 decisions"
  ON public.genesis100_decisions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny client inserts genesis100 decisions" ON public.genesis100_decisions;
DROP POLICY IF EXISTS "deny client updates genesis100 decisions" ON public.genesis100_decisions;
DROP POLICY IF EXISTS "deny client deletes genesis100 decisions" ON public.genesis100_decisions;
CREATE POLICY "deny client inserts genesis100 decisions"
  ON public.genesis100_decisions AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 decisions"
  ON public.genesis100_decisions AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 decisions"
  ON public.genesis100_decisions AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE TABLE IF NOT EXISTS public.genesis100_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.genesis100_wallets(id) ON DELETE CASCADE,
  user_id uuid,
  period text NOT NULL
    CHECK (period IN ('hourly','daily','weekly','monthly','quarterly','semiannual','annual')),
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_reports_wallet_period_time
  ON public.genesis100_reports(wallet_id, period, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_genesis100_reports_user_time
  ON public.genesis100_reports(user_id, created_at DESC);

ALTER TABLE public.genesis100_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own genesis100 reports" ON public.genesis100_reports;
CREATE POLICY "users read own genesis100 reports"
  ON public.genesis100_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny client inserts genesis100 reports" ON public.genesis100_reports;
DROP POLICY IF EXISTS "deny client updates genesis100 reports" ON public.genesis100_reports;
DROP POLICY IF EXISTS "deny client deletes genesis100 reports" ON public.genesis100_reports;
CREATE POLICY "deny client inserts genesis100 reports"
  ON public.genesis100_reports AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 reports"
  ON public.genesis100_reports AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 reports"
  ON public.genesis100_reports AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);
