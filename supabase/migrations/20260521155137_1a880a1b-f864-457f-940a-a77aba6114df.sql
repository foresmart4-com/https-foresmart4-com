
CREATE TYPE public.asset_class AS ENUM (
  'us_stock','sa_stock','etf','bond','crypto','metal','commodity','cash','other'
);
CREATE TYPE public.asset_source AS ENUM (
  'manual','binance','alpaca','ibkr','demo'
);
CREATE TYPE public.asset_data_mode AS ENUM (
  'live','delayed','manual','mock'
);
CREATE TYPE public.manual_cash_kind AS ENUM (
  'deposit','withdrawal','adjustment'
);

CREATE TABLE public.user_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_class public.asset_class NOT NULL,
  source public.asset_source NOT NULL DEFAULT 'manual',
  symbol text NOT NULL,
  name text,
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  market text,
  notes text,
  yield_pct numeric,
  data_mode public.asset_data_mode NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_assets_user ON public.user_assets(user_id) WHERE is_active;
CREATE INDEX idx_user_assets_class ON public.user_assets(user_id, asset_class) WHERE is_active;

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own user_assets all" ON public.user_assets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deny anon user_assets" ON public.user_assets
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_user_assets_updated
  BEFORE UPDATE ON public.user_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.manual_cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  amount numeric NOT NULL,
  kind public.manual_cash_kind NOT NULL DEFAULT 'deposit',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_cash_user ON public.manual_cash_entries(user_id, created_at DESC);

ALTER TABLE public.manual_cash_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own manual_cash all" ON public.manual_cash_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deny anon manual_cash" ON public.manual_cash_entries
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
