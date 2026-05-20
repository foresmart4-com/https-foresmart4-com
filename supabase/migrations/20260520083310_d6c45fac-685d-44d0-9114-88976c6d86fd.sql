
-- Company Trading Mode: admin-only internal trading configuration & audit log
CREATE TABLE IF NOT EXISTS public.company_trading_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  live_trading_enabled boolean NOT NULL DEFAULT false,
  broker_connected boolean NOT NULL DEFAULT false,
  broker_name text,
  max_trade_size_usdt numeric NOT NULL DEFAULT 1000,
  daily_loss_limit_usdt numeric NOT NULL DEFAULT 500,
  allowed_assets text[] NOT NULL DEFAULT ARRAY['BTCUSDT','ETHUSDT'],
  approval_required boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure singleton row
INSERT INTO public.company_trading_config (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.company_trading_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read company config" ON public.company_trading_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update company config" ON public.company_trading_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deny client insert company config" ON public.company_trading_config
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client delete company config" ON public.company_trading_config
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.company_trading_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  decision text,
  symbol text,
  side text,
  quantity numeric,
  price numeric,
  status text NOT NULL DEFAULT 'recorded',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_trading_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read company audit" ON public.company_trading_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert company audit" ON public.company_trading_audit
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deny client update company audit" ON public.company_trading_audit
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny client delete company audit" ON public.company_trading_audit
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_company_audit_created ON public.company_trading_audit(created_at DESC);
