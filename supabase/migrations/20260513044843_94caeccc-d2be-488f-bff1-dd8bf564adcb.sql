-- Move plaid secrets out of bank_accounts into a service_role-only table
CREATE TABLE IF NOT EXISTS public.bank_account_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  plaid_access_token text,
  plaid_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_account_secrets ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated. service_role bypasses RLS.

REVOKE ALL ON public.bank_account_secrets FROM anon, authenticated;
GRANT ALL ON public.bank_account_secrets TO service_role;

-- Migrate any existing data
INSERT INTO public.bank_account_secrets (bank_account_id, user_id, plaid_access_token, plaid_item_id)
SELECT id, user_id, plaid_access_token, plaid_item_id
FROM public.bank_accounts
WHERE plaid_access_token IS NOT NULL OR plaid_item_id IS NOT NULL
ON CONFLICT (bank_account_id) DO NOTHING;

-- Drop sensitive columns from bank_accounts
ALTER TABLE public.bank_accounts DROP COLUMN IF EXISTS plaid_access_token;
ALTER TABLE public.bank_accounts DROP COLUMN IF EXISTS plaid_item_id;