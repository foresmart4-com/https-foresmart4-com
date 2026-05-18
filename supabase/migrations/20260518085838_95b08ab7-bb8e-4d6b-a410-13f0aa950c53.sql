
-- Helper: reuse public.update_updated_at_column() if present.

-- 1. broker_credentials (server-only writes, encrypted at rest)
CREATE TABLE IF NOT EXISTS public.broker_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  broker text NOT NULL DEFAULT 'binance',
  mode text NOT NULL DEFAULT 'testnet' CHECK (mode IN ('testnet','live')),
  encrypted_api_key text NOT NULL,
  encrypted_api_secret text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, broker, mode)
);
ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own broker creds (metadata)" ON public.broker_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage broker creds" ON public.broker_credentials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER broker_credentials_touch BEFORE UPDATE ON public.broker_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. execution_history
CREATE TABLE IF NOT EXISTS public.execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  broker text NOT NULL DEFAULT 'binance',
  mode text NOT NULL DEFAULT 'testnet',
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY','SELL')),
  type text NOT NULL,
  quantity numeric NOT NULL,
  price numeric,
  status text NOT NULL,
  order_id text,
  slippage_pct numeric,
  pnl numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.execution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own executions" ON public.execution_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_execution_history_user ON public.execution_history(user_id, created_at DESC);

-- 3. ai_decisions
CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset text NOT NULL,
  action text NOT NULL,
  confidence numeric,
  regime text,
  rationale text,
  context jsonb DEFAULT '{}'::jsonb,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own ai decisions" ON public.ai_decisions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user ON public.ai_decisions(user_id, created_at DESC);

-- 4. autonomous_sessions
CREATE TABLE IF NOT EXISTS public.autonomous_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  mode text NOT NULL DEFAULT 'testnet',
  strategy text,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  stop_reason text,
  starting_equity numeric,
  ending_equity numeric,
  metadata jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.autonomous_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own autopilot sessions" ON public.autonomous_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 5. investment_plans (users can create/update their own)
CREATE TABLE IF NOT EXISTS public.investment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('conservative','balanced','aggressive','ai_adaptive','custom')),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  capital_amount numeric NOT NULL CHECK (capital_amount > 0),
  currency text NOT NULL DEFAULT 'USDT',
  target_markets text[] NOT NULL DEFAULT '{}',
  risk_level text NOT NULL DEFAULT 'medium',
  allocation jsonb NOT NULL DEFAULT '{}'::jsonb,
  projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  ai_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investment plans all" ON public.investment_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all investment plans" ON public.investment_plans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER investment_plans_touch BEFORE UPDATE ON public.investment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. portfolio_snapshots
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  equity numeric NOT NULL,
  available numeric NOT NULL,
  exposure_pct numeric,
  pnl_day numeric,
  pnl_total numeric,
  holdings jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own snapshots" ON public.portfolio_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user ON public.portfolio_snapshots(user_id, captured_at DESC);

-- 7. risk_events
CREATE TABLE IF NOT EXISTS public.risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  category text NOT NULL,
  message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own risk events" ON public.risk_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_risk_events_user ON public.risk_events(user_id, created_at DESC);
