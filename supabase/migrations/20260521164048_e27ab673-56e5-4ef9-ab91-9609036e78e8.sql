
-- =====================================================================
-- Phase 5: Watchlists + Smart Alerts
-- =====================================================================

-- ---------- user_watchlists ----------
CREATE TABLE IF NOT EXISTS public.user_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_watchlists_user_idx ON public.user_watchlists(user_id);
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny anon user_watchlists"
  ON public.user_watchlists FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "own user_watchlists all"
  ON public.user_watchlists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_watchlists_updated
  BEFORE UPDATE ON public.user_watchlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- user_watchlist_items ----------
CREATE TABLE IF NOT EXISTS public.user_watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  watchlist_id uuid NOT NULL REFERENCES public.user_watchlists(id) ON DELETE CASCADE,
  symbol text NOT NULL CHECK (char_length(symbol) BETWEEN 1 AND 30),
  name text,
  asset_type text NOT NULL CHECK (asset_type IN
    ('US_STOCK','SAUDI_STOCK','CRYPTO','METAL','COMMODITY','BOND','ETF','CASH')),
  market text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, symbol)
);
CREATE INDEX IF NOT EXISTS user_watchlist_items_user_idx ON public.user_watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS user_watchlist_items_list_idx ON public.user_watchlist_items(watchlist_id);
ALTER TABLE public.user_watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny anon user_watchlist_items"
  ON public.user_watchlist_items FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "own user_watchlist_items all"
  ON public.user_watchlist_items FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  );

-- ---------- user_price_alerts ----------
CREATE TABLE IF NOT EXISTS public.user_price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL CHECK (char_length(symbol) BETWEEN 1 AND 30),
  name text,
  asset_type text NOT NULL CHECK (asset_type IN
    ('US_STOCK','SAUDI_STOCK','CRYPTO','METAL','COMMODITY','BOND','ETF','CASH')),
  market text,
  condition text NOT NULL CHECK (condition IN
    ('price_above','price_below','change_above','change_below')),
  target_value numeric NOT NULL,
  note text,
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_price numeric,
  last_status text CHECK (last_status IN ('triggered','no_change','failed','pending')),
  last_error text,
  triggered_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_price_alerts_user_idx ON public.user_price_alerts(user_id);
ALTER TABLE public.user_price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny anon user_price_alerts"
  ON public.user_price_alerts FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "own user_price_alerts all"
  ON public.user_price_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_price_alerts_updated
  BEFORE UPDATE ON public.user_price_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- user_alert_events ----------
CREATE TABLE IF NOT EXISTS public.user_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid NOT NULL REFERENCES public.user_price_alerts(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('triggered','no_change','failed')),
  price numeric,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_alert_events_user_idx ON public.user_alert_events(user_id);
CREATE INDEX IF NOT EXISTS user_alert_events_alert_idx ON public.user_alert_events(alert_id);
ALTER TABLE public.user_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny anon user_alert_events"
  ON public.user_alert_events FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "users read own alert events"
  ON public.user_alert_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "deny client insert alert events"
  ON public.user_alert_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "deny client update alert events"
  ON public.user_alert_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "deny client delete alert events"
  ON public.user_alert_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);
