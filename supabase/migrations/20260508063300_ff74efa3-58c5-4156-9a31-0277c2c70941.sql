CREATE TABLE public.external_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('crypto_wallet','lean','snaptrade','plaid','paypal','wise')),
  label TEXT,
  external_id TEXT,
  address TEXT,
  network TEXT,
  currency TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.external_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own external accounts all"
ON public.external_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_external_accounts_user ON public.external_accounts(user_id, provider);