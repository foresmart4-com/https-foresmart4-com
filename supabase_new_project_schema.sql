-- ================================================================
-- ForeSmart — New Independent Supabase Project Schema
-- Target: https://tsidtguxrdztjjxwejwl.supabase.co
--
-- INSTRUCTIONS:
-- 1. Go to the new Supabase project → SQL Editor
-- 2. Paste this entire file and click Run
-- 3. Then update Railway env vars (see DEPLOY_CHECKLIST.md)
-- ================================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────
-- pgmq is needed for email queues. Enable via Dashboard → Database → Extensions first.
-- pg_cron and pg_net are also needed for the email cron job.
-- These cannot be created via SQL on Supabase managed projects; enable them in the dashboard.
CREATE EXTENSION IF NOT EXISTS pgmq;

-- ─── TYPES ───────────────────────────────────────────────────────

CREATE TYPE public.app_role AS ENUM ('admin', 'subscriber', 'pending');

-- ─── HELPER FUNCTIONS (must come before tables that use them) ────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Alias so older triggers that reference update_updated_at_column still work
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── PROFILES ────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ─── USER API KEYS ────────────────────────────────────────────────

CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own keys all" ON public.user_api_keys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── ALERTS ──────────────────────────────────────────────────────

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('above','below')),
  target_price NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts all" ON public.alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── MARKET ARCHIVE ──────────────────────────────────────────────

CREATE TABLE public.market_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change_pct NUMERIC,
  high NUMERIC,
  low NUMERIC,
  volume NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own archive all" ON public.market_archive FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_archive_user_time ON public.market_archive(user_id, captured_at DESC);

-- ─── USER ROLES ──────────────────────────────────────────────────

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER role check — used in RLS policies
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Returns the calling user's highest-priority role
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'subscriber' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Grants
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_role() FROM anon, authenticated, public;

-- ─── DISCLAIMER ACCEPTANCES ──────────────────────────────────────

CREATE TABLE public.disclaimer_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.disclaimer_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read acceptances" ON public.disclaimer_acceptances
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "own acceptances insert" ON public.disclaimer_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_disclaimer_user ON public.disclaimer_acceptances(user_id, accepted_at DESC);

-- RPC: check if current user accepted a specific disclaimer version
CREATE OR REPLACE FUNCTION public.has_accepted_disclaimer(_version text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.disclaimer_acceptances
    WHERE user_id = auth.uid() AND version = _version
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) FROM anon, public;

-- ─── WALLETS ─────────────────────────────────────────────────────

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet all" ON public.wallets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── WALLET TRANSACTIONS ─────────────────────────────────────────

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit','withdraw','buy','sell','fee')),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending','completed','failed','refunded')),
  reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx all" ON public.wallet_transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);

-- ─── BANK ACCOUNTS ───────────────────────────────────────────────

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'plaid',
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  account_id TEXT,
  institution_name TEXT,
  account_name TEXT,
  account_mask TEXT,
  account_type TEXT,
  currency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bank all" ON public.bank_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── PORTFOLIOS ──────────────────────────────────────────────────

CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  strategy TEXT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own portfolio all" ON public.portfolios FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT,
  market TEXT,
  quantity NUMERIC(18,8) NOT NULL DEFAULT 0,
  avg_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own holdings all" ON public.portfolio_holdings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── SUBSCRIPTION PLANS ──────────────────────────────────────────

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price_sar NUMERIC NOT NULL,
  duration_months INTEGER NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.subscription_plans
  FOR SELECT USING (is_active = true);
CREATE POLICY "admins manage plans" ON public.subscription_plans
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  moyasar_payment_id TEXT,
  amount_paid NUMERIC,
  currency TEXT NOT NULL DEFAULT 'SAR',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  product_id TEXT,
  price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user     ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status   ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_user_env ON public.subscriptions(user_id, environment);
CREATE INDEX idx_subscriptions_stripe   ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;

CREATE POLICY "own subscription read" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own subscription insert" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── WALLET TOP-UPS ──────────────────────────────────────────────

CREATE TABLE public.wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_sar NUMERIC NOT NULL,
  moyasar_fee_sar NUMERIC NOT NULL DEFAULT 0,
  service_fee_sar NUMERIC NOT NULL DEFAULT 0,
  net_credit_sar NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  moyasar_payment_id TEXT UNIQUE,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_topups_user ON public.wallet_topups(user_id);

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topups read" ON public.wallet_topups
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own topups insert" ON public.wallet_topups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage topups" ON public.wallet_topups
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_topups_updated BEFORE UPDATE ON public.wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── HELPER: has_active_subscription ─────────────────────────────

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND (
        (status IN ('trialing','active','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon, authenticated, public;

-- ─── HANDLE NEW USER ROLE (first user → admin, else → subscriber) ─

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles WHERE role = 'admin';
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'subscriber');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;

-- ─── HANDLE NEW USER WALLET ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_wallet() FROM anon, authenticated, public;

-- ─── SYNC SUBSCRIBER ROLE WHEN SUBSCRIPTION CHANGES ─────────────

CREATE OR REPLACE FUNCTION public.sync_subscriber_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('canceled','unpaid','incomplete_expired')
     AND (NEW.current_period_end IS NULL OR NEW.current_period_end <= now())
     AND NOT public.has_active_subscription(NEW.user_id) THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'subscriber';
  END IF;

  IF NEW.status IN ('trialing','active','past_due') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'subscriber')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_subscriber_role() FROM anon, authenticated, public;

-- ─── TRIGGERS ON auth.users ──────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

DROP TRIGGER IF EXISTS subscriptions_sync_role ON public.subscriptions;
CREATE TRIGGER subscriptions_sync_role
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_subscriber_role();

-- ─── WALLET CREDIT (atomic top-up crediting) ─────────────────────

CREATE OR REPLACE FUNCTION public.wallet_credit_topup(
  _topup_id uuid, _payment_id text, _payment_method text
)
RETURNS TABLE(credited boolean, wallet_id uuid, user_id uuid, amount numeric)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _topup public.wallet_topups%ROWTYPE;
  _wallet public.wallets%ROWTYPE;
BEGIN
  UPDATE public.wallet_topups
  SET status = 'paid',
      moyasar_payment_id = _payment_id,
      payment_method = _payment_method,
      updated_at = now()
  WHERE id = _topup_id AND status = 'pending'
  RETURNING * INTO _topup;

  IF _topup.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  INSERT INTO public.wallets (user_id, currency, balance) VALUES (_topup.user_id, 'SAR', 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + _topup.net_credit_sar, updated_at = now()
  WHERE user_id = _topup.user_id
  RETURNING * INTO _wallet;

  INSERT INTO public.wallet_transactions(user_id, wallet_id, type, amount, currency, status, reference, metadata)
  VALUES (
    _topup.user_id, _wallet.id, 'deposit', _topup.net_credit_sar, 'SAR',
    'completed', _payment_id,
    jsonb_build_object('gross', _topup.amount_sar, 'moyasar_fee', _topup.moyasar_fee_sar, 'service_fee', _topup.service_fee_sar)
  );

  RETURN QUERY SELECT true, _wallet.id, _topup.user_id, _topup.net_credit_sar;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_credit_topup(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit_topup(uuid, text, text) TO service_role;

-- ─── TRADE SIGNALS ────────────────────────────────────────────────

CREATE TABLE public.trade_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT,
  action TEXT NOT NULL CHECK (action IN ('buy','sell','hold','watch')),
  horizon TEXT NOT NULL DEFAULT 'short' CHECK (horizon IN ('short','medium','long')),
  confidence NUMERIC NOT NULL DEFAULT 0,
  technical_score NUMERIC,
  sentiment_score NUMERIC,
  entry_price NUMERIC,
  stop_loss NUMERIC,
  targets JSONB DEFAULT '[]'::jsonb,
  rationale TEXT,
  indicators JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '6 hours'
);

CREATE INDEX trade_signals_symbol_idx    ON public.trade_signals(symbol);
CREATE INDEX trade_signals_generated_idx ON public.trade_signals(generated_at DESC);
CREATE INDEX trade_signals_expires_idx   ON public.trade_signals(expires_at);

ALTER TABLE public.trade_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read signals" ON public.trade_signals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage signals" ON public.trade_signals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ─── AUTH EVENTS LOG ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_events_user_id_idx   ON public.auth_events(user_id);
CREATE INDEX IF NOT EXISTS auth_events_email_idx      ON public.auth_events(lower(email));
CREATE INDEX IF NOT EXISTS auth_events_created_idx    ON public.auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_event_type_idx ON public.auth_events(event_type);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role writes auth_events" ON public.auth_events
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "deny client insert auth_events" ON public.auth_events
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client update auth_events" ON public.auth_events
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny client delete auth_events" ON public.auth_events
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
CREATE POLICY "users read own auth_events" ON public.auth_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ─── BROKER CREDENTIALS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broker_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  broker TEXT NOT NULL DEFAULT 'binance',
  mode TEXT NOT NULL DEFAULT 'testnet' CHECK (mode IN ('testnet','live')),
  encrypted_api_key TEXT NOT NULL,
  encrypted_api_secret TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, broker, mode)
);
ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own broker creds" ON public.broker_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage broker creds" ON public.broker_credentials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER broker_credentials_touch BEFORE UPDATE ON public.broker_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── EXECUTION HISTORY ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  broker TEXT NOT NULL DEFAULT 'binance',
  mode TEXT NOT NULL DEFAULT 'testnet',
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price NUMERIC,
  status TEXT NOT NULL,
  order_id TEXT,
  slippage_pct NUMERIC,
  pnl NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.execution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own executions" ON public.execution_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_execution_history_user ON public.execution_history(user_id, created_at DESC);

-- ─── AI DECISIONS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence NUMERIC,
  regime TEXT,
  rationale TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own ai decisions" ON public.ai_decisions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user ON public.ai_decisions(user_id, created_at DESC);

-- ─── AUTONOMOUS SESSIONS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.autonomous_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mode TEXT NOT NULL DEFAULT 'testnet',
  strategy TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  stop_reason TEXT,
  starting_equity NUMERIC,
  ending_equity NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE public.autonomous_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own autopilot sessions" ON public.autonomous_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ─── INVESTMENT PLANS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL
    CHECK (plan_type IN ('conservative','balanced','aggressive','ai_adaptive','custom')),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  capital_amount NUMERIC NOT NULL CHECK (capital_amount > 0),
  currency TEXT NOT NULL DEFAULT 'USDT',
  target_markets TEXT[] NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  projection JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed','cancelled')),
  ai_confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investment plans all" ON public.investment_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all investment plans" ON public.investment_plans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER investment_plans_touch BEFORE UPDATE ON public.investment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── PORTFOLIO SNAPSHOTS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  equity NUMERIC NOT NULL,
  available NUMERIC NOT NULL,
  exposure_pct NUMERIC,
  pnl_day NUMERIC,
  pnl_total NUMERIC,
  holdings JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own snapshots" ON public.portfolio_snapshots
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user
  ON public.portfolio_snapshots(user_id, captured_at DESC);

-- ─── RISK EVENTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own risk events" ON public.risk_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_risk_events_user ON public.risk_events(user_id, created_at DESC);

-- ─── EMAIL INFRASTRUCTURE ────────────────────────────────────────
-- NOTE: Before running this section, enable these extensions in
-- Supabase Dashboard → Database → Extensions:
--   • pgmq       (message queue)
--   • pg_net     (HTTP calls from pg_cron)
--   • pg_cron    (scheduled jobs)

DO $$ BEGIN PERFORM pgmq.create('auth_emails');         EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq');     EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('pending','sent','suppressed','failed','bounced','complained','dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log" ON public.email_send_log
    FOR SELECT USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log" ON public.email_send_log
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log" ON public.email_send_log
    FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created   ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_log_message   ON public.email_send_log(message_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state" ON public.email_send_state
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN RETURN FALSE; END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails
    FOR SELECT USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens
    FOR SELECT USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update tokens" ON public.email_unsubscribe_tokens
    FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ─── GENESIS 100 TABLES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.genesis100_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  capital NUMERIC NOT NULL DEFAULT 0 CHECK (capital >= 0),
  cash_balance NUMERIC NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
  invested_balance NUMERIC NOT NULL DEFAULT 0 CHECK (invested_balance >= 0),
  target_monthly_return NUMERIC NOT NULL DEFAULT 0.025,
  max_drawdown NUMERIC NOT NULL DEFAULT 0.12,
  risk_profile TEXT NOT NULL DEFAULT 'balanced'
    CHECK (risk_profile IN ('conservative','balanced','growth')),
  ai_mode TEXT NOT NULL DEFAULT 'semi_ai'
    CHECK (ai_mode IN ('off','semi_ai','full_ai')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active_analysis','paper_trading','execution_ready','paused')),
  live_execution_enabled BOOLEAN NOT NULL DEFAULT false,
  external_transfers_allowed BOOLEAN NOT NULL DEFAULT false,
  ai_can_transfer_outside_platform BOOLEAN NOT NULL DEFAULT false,
  manual_withdrawal_only BOOLEAN NOT NULL DEFAULT true,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_wallets_user ON public.genesis100_wallets(user_id);
ALTER TABLE public.genesis100_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own genesis100 wallets" ON public.genesis100_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deny client inserts genesis100 wallets" ON public.genesis100_wallets
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 wallets" ON public.genesis100_wallets
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 wallets" ON public.genesis100_wallets
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.genesis100_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.genesis100_wallets(id) ON DELETE CASCADE,
  user_id UUID,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  old_weight NUMERIC NOT NULL DEFAULT 0,
  new_weight NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_mode TEXT NOT NULL
    CHECK (execution_mode IN ('analysis_only','paper','live_blocked','live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_decisions_wallet_time
  ON public.genesis100_decisions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_genesis100_decisions_user_time
  ON public.genesis100_decisions(user_id, created_at DESC);

ALTER TABLE public.genesis100_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own genesis100 decisions" ON public.genesis100_decisions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deny client inserts genesis100 decisions" ON public.genesis100_decisions
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 decisions" ON public.genesis100_decisions
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 decisions" ON public.genesis100_decisions
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.genesis100_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.genesis100_wallets(id) ON DELETE CASCADE,
  user_id UUID,
  period TEXT NOT NULL
    CHECK (period IN ('hourly','daily','weekly','monthly','quarterly','semiannual','annual')),
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis100_reports_wallet_period_time
  ON public.genesis100_reports(wallet_id, period, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_genesis100_reports_user_time
  ON public.genesis100_reports(user_id, created_at DESC);

ALTER TABLE public.genesis100_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own genesis100 reports" ON public.genesis100_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deny client inserts genesis100 reports" ON public.genesis100_reports
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client updates genesis100 reports" ON public.genesis100_reports
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny client deletes genesis100 reports" ON public.genesis100_reports
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- ─── SEED DATA ───────────────────────────────────────────────────

INSERT INTO public.subscription_plans
  (code, name_ar, name_en, price_sar, duration_months, trial_days, sort_order, features)
VALUES
  ('quarterly', 'الخطة الفصلية', 'Quarterly', 100, 3, 14, 1,
    '["وصول كامل لجميع الأسواق","التداول المباشر","المستشار الذكي","الأرشيف الكامل","تجربة مجانية 14 يوم"]'::jsonb),
  ('annual', 'الخطة السنوية', 'Annual', 150, 12, 14, 2,
    '["جميع مزايا الخطة الفصلية","وفر 150 ريال سنوياً","أولوية الدعم","تنبيهات غير محدودة","تجربة مجانية 14 يوم"]'::jsonb)
ON CONFLICT DO NOTHING;

-- ================================================================
-- DONE — Schema created successfully.
-- Now update Railway env vars (see instructions above the file).
-- ================================================================
