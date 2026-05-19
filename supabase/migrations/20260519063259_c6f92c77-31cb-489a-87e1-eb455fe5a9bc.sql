revoke execute on function public.system_health_snapshot() from authenticated, anon, public;
grant execute on function public.system_health_snapshot() to service_role;