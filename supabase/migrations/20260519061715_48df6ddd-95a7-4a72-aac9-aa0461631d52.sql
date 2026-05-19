
-- 1) Drop duplicate triggers on auth.users (kept one per purpose)
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- 2) Centralized auth events log
CREATE TABLE IF NOT EXISTS public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  event_type text NOT NULL,           -- signup, signin, signout, password_reset_request, password_update, signin_failed, signup_failed
  status text NOT NULL DEFAULT 'ok',  -- ok, error
  error_message text,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_events_user_id_idx ON public.auth_events(user_id);
CREATE INDEX IF NOT EXISTS auth_events_email_idx ON public.auth_events(lower(email));
CREATE INDEX IF NOT EXISTS auth_events_created_idx ON public.auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_event_type_idx ON public.auth_events(event_type);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Service role writes
CREATE POLICY "service_role writes auth_events"
ON public.auth_events
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Block all client writes
CREATE POLICY "deny client insert auth_events"
ON public.auth_events
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny client update auth_events"
ON public.auth_events
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "deny client delete auth_events"
ON public.auth_events
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

-- Users read their own; admins read all
CREATE POLICY "users read own auth_events"
ON public.auth_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
