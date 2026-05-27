CREATE TABLE IF NOT EXISTS public.market_price_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  asset_class text NOT NULL,
  provider text NOT NULL,
  interval text NOT NULL,
  "timestamp" timestamptz NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric NOT NULL,
  volume numeric,
  data_mode text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS market_price_candles_uniq
  ON public.market_price_candles (symbol, asset_class, interval, "timestamp");

CREATE INDEX IF NOT EXISTS market_price_candles_lookup
  ON public.market_price_candles (symbol, interval, "timestamp" DESC);

ALTER TABLE public.market_price_candles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candles_public_read" ON public.market_price_candles;
CREATE POLICY "candles_public_read"
  ON public.market_price_candles
  FOR SELECT
  USING (true);

-- Block all client-side writes; only service role (server) can write.
DROP POLICY IF EXISTS "candles_no_anon_write" ON public.market_price_candles;
CREATE POLICY "candles_no_anon_write"
  ON public.market_price_candles
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);