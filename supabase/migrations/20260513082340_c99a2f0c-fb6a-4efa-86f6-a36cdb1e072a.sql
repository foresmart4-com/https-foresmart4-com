GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "block non-admin role inserts" ON public.user_roles;
DROP POLICY IF EXISTS "block non-admin role updates" ON public.user_roles;
DROP POLICY IF EXISTS "block non-admin role deletes" ON public.user_roles;

CREATE POLICY "admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) FROM anon, public;