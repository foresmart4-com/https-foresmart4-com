CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.resend_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  recipient text NOT NULL,
  subject text NOT NULL,
  template text NOT NULL,
  category text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resend_email_log_recipient ON public.resend_email_log(recipient);
CREATE INDEX IF NOT EXISTS idx_resend_email_log_status ON public.resend_email_log(status);
CREATE INDEX IF NOT EXISTS idx_resend_email_log_created_at ON public.resend_email_log(created_at DESC);

ALTER TABLE public.resend_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins view email log" ON public.resend_email_log;
CREATE POLICY "admins view email log"
  ON public.resend_email_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users view own email log" ON public.resend_email_log;
CREATE POLICY "users view own email log"
  ON public.resend_email_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_resend_email_log_updated_at ON public.resend_email_log;
CREATE TRIGGER trg_resend_email_log_updated_at
  BEFORE UPDATE ON public.resend_email_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();