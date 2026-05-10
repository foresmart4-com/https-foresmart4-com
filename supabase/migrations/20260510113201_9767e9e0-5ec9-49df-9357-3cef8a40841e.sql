
-- Update default wallet currency to SAR for new wallets
ALTER TABLE public.wallets ALTER COLUMN currency SET DEFAULT 'SAR';

-- Subscription plans (public read)
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
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | trialing | active | past_due | canceled | expired
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  moyasar_payment_id TEXT,
  amount_paid NUMERIC,
  currency TEXT NOT NULL DEFAULT 'SAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscription read" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "own subscription insert" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins manage subscriptions" ON public.subscriptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Wallet top-ups
CREATE TABLE public.wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_sar NUMERIC NOT NULL,
  moyasar_fee_sar NUMERIC NOT NULL DEFAULT 0,
  service_fee_sar NUMERIC NOT NULL DEFAULT 0,
  net_credit_sar NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  moyasar_payment_id TEXT UNIQUE,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_topups_user ON public.wallet_topups(user_id);

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own topups read" ON public.wallet_topups
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "own topups insert" ON public.wallet_topups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins manage topups" ON public.wallet_topups
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger function (reuse existing if any, else create)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_topups_updated BEFORE UPDATE ON public.wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper to check active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status IN ('trialing','active')
      AND (current_period_end IS NULL OR current_period_end > now())
  )
$$;

-- Seed plans
INSERT INTO public.subscription_plans (code, name_ar, name_en, price_sar, duration_months, trial_days, sort_order, features) VALUES
  ('quarterly', 'الخطة الفصلية', 'Quarterly', 100, 3, 14, 1,
    '["وصول كامل لجميع الأسواق","التداول المباشر","المستشار الذكي","الأرشيف الكامل","تجربة مجانية 14 يوم"]'::jsonb),
  ('annual', 'الخطة السنوية', 'Annual', 150, 12, 14, 2,
    '["جميع مزايا الخطة الفصلية","وفر 150 ريال سنوياً","أولوية الدعم","تنبيهات غير محدودة","تجربة مجانية 14 يوم"]'::jsonb);
