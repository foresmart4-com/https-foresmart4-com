
-- 1. Fix touch_updated_at: set search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Revoke EXECUTE on SECURITY DEFINER helper functions from anon/authenticated.
-- These are only invoked from inside RLS policies / triggers and should not be callable directly via PostgREST.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public."current_role"() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_subscriber_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_wallet() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_trial() FROM anon, authenticated, public;

-- 3. Block self-insert privilege escalation on user_roles with an explicit RESTRICTIVE policy.
CREATE POLICY "block non-admin role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin role updates"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin role deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Remove subscriptions table from realtime publication (no client code subscribes to it,
-- and exposing it to all authenticated users via Realtime channels leaks billing data).
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;

-- 5. Restrict disclaimer_acceptances SELECT so the IP/user_agent audit fields are not
-- returned to the end user. Only admins can read full rows; users no longer have read access
-- to their own disclaimer rows from the client (the app only needs to write them).
DROP POLICY IF EXISTS "own acceptances read" ON public.disclaimer_acceptances;
CREATE POLICY "admins read acceptances"
ON public.disclaimer_acceptances
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow the user to check whether *they* have accepted (without exposing audit columns).
-- We expose this via a SECURITY INVOKER helper that only returns the version+timestamp.
CREATE OR REPLACE FUNCTION public.has_accepted_disclaimer(_version text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.disclaimer_acceptances
    WHERE user_id = auth.uid() AND version = _version
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) TO authenticated;
