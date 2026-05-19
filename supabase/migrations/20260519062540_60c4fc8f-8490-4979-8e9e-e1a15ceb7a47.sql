REVOKE EXECUTE ON FUNCTION public.db_health_check() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_health_check() TO service_role;