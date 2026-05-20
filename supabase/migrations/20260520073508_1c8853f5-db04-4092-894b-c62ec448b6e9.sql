
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text,
  event_type text NOT NULL,
  resource_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event
  ON public.payment_events (provider, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_user ON public.payment_events (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON public.payment_events (event_type);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read payment events"
  ON public.payment_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage payment events"
  ON public.payment_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role')
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role');

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS paypal_subscription_id text,
  ADD COLUMN IF NOT EXISTS paypal_order_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_paypal_sub
  ON public.subscriptions (paypal_subscription_id) WHERE paypal_subscription_id IS NOT NULL;
