
ALTER TABLE public.resend_email_log
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

CREATE TABLE IF NOT EXISTS public.email_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  user_id uuid,
  category text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_rate_recipient ON public.email_rate_limit(recipient, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_email_rate_user ON public.email_rate_limit(user_id, window_start DESC);

ALTER TABLE public.email_rate_limit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins view rate limits" ON public.email_rate_limit;
CREATE POLICY "admins view rate limits"
  ON public.email_rate_limit FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
