CREATE TABLE public.trade_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  asset_name text NOT NULL,
  category text,
  action text NOT NULL CHECK (action IN ('buy','sell','hold','watch')),
  horizon text NOT NULL DEFAULT 'short' CHECK (horizon IN ('short','medium','long')),
  confidence numeric NOT NULL DEFAULT 0,
  technical_score numeric,
  sentiment_score numeric,
  entry_price numeric,
  stop_loss numeric,
  targets jsonb DEFAULT '[]'::jsonb,
  rationale text,
  indicators jsonb DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours'
);

CREATE INDEX trade_signals_symbol_idx ON public.trade_signals (symbol);
CREATE INDEX trade_signals_generated_idx ON public.trade_signals (generated_at DESC);
CREATE INDEX trade_signals_expires_idx ON public.trade_signals (expires_at);

ALTER TABLE public.trade_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read signals"
  ON public.trade_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins manage signals"
  ON public.trade_signals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));