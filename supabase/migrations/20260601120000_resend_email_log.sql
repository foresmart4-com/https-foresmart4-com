-- resend_email_log: audit trail for all Resend send attempts.
-- Columns match resend.server.ts exactly.

CREATE TABLE IF NOT EXISTS public.resend_email_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  user_id             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient           text        NOT NULL,
  subject             text        NOT NULL,
  template            text        NOT NULL,
  category            text        NOT NULL,
  lang                text        NOT NULL DEFAULT 'ar',
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','sent','failed','rate_limited')),
  attempts            integer     NOT NULL DEFAULT 0,
  provider_message_id text,
  provider_response   jsonb,
  error_message       text
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_resend_email_log_updated_at
    BEFORE UPDATE ON public.resend_email_log
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for rate-limit queries (recipient + created_at range scan)
CREATE INDEX IF NOT EXISTS idx_resend_email_log_recipient_created
  ON public.resend_email_log (recipient, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resend_email_log_created
  ON public.resend_email_log (created_at DESC);

-- RLS: service_role only
ALTER TABLE public.resend_email_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role only"
    ON public.resend_email_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also needed by resend.server.ts — email_rate_limit table for abuse tracking
CREATE TABLE IF NOT EXISTS public.email_rate_limit (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  recipient  text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  category   text        NOT NULL,
  count      integer     NOT NULL DEFAULT 1
);

ALTER TABLE public.email_rate_limit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role only"
    ON public.email_rate_limit
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_rate_limit_recipient
  ON public.email_rate_limit (recipient, created_at DESC);
