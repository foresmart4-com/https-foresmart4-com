
-- 1) user_roles: deny all client writes; only service_role may write
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins delete roles" ON public.user_roles;

CREATE POLICY "service_role manages user_roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "deny client writes user_roles insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny client writes user_roles update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny client writes user_roles delete"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

-- 2) broker_credentials: hide encrypted material via a metadata view; restrict table SELECT
DROP POLICY IF EXISTS "users view own broker creds (metadata)" ON public.broker_credentials;

-- Only admins/service_role may read the underlying table (with secret columns)
CREATE POLICY "admins read broker creds raw"
ON public.broker_credentials
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Safe metadata-only view for end users
CREATE OR REPLACE VIEW public.broker_credentials_meta
WITH (security_invoker = true) AS
SELECT id, user_id, broker, mode, label, is_active, created_at, updated_at
FROM public.broker_credentials;

GRANT SELECT ON public.broker_credentials_meta TO authenticated;

CREATE POLICY "users view own broker creds meta"
ON public.broker_credentials
FOR SELECT
TO authenticated
USING (false);
-- (the view bypasses this via security_invoker over column-limited projection)

-- Note: view uses security_invoker so RLS still applies on base table — add policy granting metadata columns
-- Simpler: drop the false policy and rely on view-only access. Recreate a column-safe policy is not supported by RLS,
-- so we keep raw SELECT admin-only and ensure clients query the view instead.
DROP POLICY IF EXISTS "users view own broker creds meta" ON public.broker_credentials;

-- Allow users SELECT on base table for ownership check by the view (security_invoker passes auth.uid())
CREATE POLICY "users select own broker creds via view"
ON public.broker_credentials
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Revoke direct column access on sensitive columns from authenticated; allow only safe columns
REVOKE SELECT ON public.broker_credentials FROM authenticated;
GRANT SELECT (id, user_id, broker, mode, label, is_active, created_at, updated_at)
ON public.broker_credentials TO authenticated;

-- 3) email_rate_limit: restrict writes to service_role only
ALTER TABLE public.email_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role writes email_rate_limit"
ON public.email_rate_limit
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "deny client writes email_rate_limit insert"
ON public.email_rate_limit
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny client writes email_rate_limit update"
ON public.email_rate_limit
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny client writes email_rate_limit delete"
ON public.email_rate_limit
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);
