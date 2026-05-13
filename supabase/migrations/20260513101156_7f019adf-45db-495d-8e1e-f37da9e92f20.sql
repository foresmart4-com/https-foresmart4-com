
CREATE TABLE IF NOT EXISTS public.paper_balances (
  user_id uuid PRIMARY KEY,
  cash_usd numeric NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.paper_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own paper balance all" ON public.paper_balances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  asset_name text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  pnl numeric,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_price numeric
);
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own paper trades all" ON public.paper_trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
