REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;

REVOKE EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_accepted_disclaimer(text) FROM public;