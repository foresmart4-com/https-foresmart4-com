
-- 1) Harden broker_credentials: drop user SELECT on base table; users must use the meta view.
DROP POLICY IF EXISTS "users select own broker creds via view" ON public.broker_credentials;

-- The view broker_credentials_meta already exists with security_invoker=on and excludes encrypted columns.
-- Allow users to SELECT through the view by allowing SELECT on the base table ONLY for non-sensitive columns
-- is not enforceable via RLS alone; instead, we keep base-table SELECT admin-only and grant SELECT on the view.
GRANT SELECT ON public.broker_credentials_meta TO authenticated;

-- 2) Prevent duplicate wallets (one per user) if not already enforced
CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_unique ON public.wallets(user_id);

-- 3) Health check function (admin only). SECURITY DEFINER so it can read auth.users.
CREATE OR REPLACE FUNCTION public.db_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin required';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'auth_users',           (SELECT count(*) FROM auth.users),
      'profiles',             (SELECT count(*) FROM public.profiles),
      'user_roles',           (SELECT count(*) FROM public.user_roles),
      'wallets',              (SELECT count(*) FROM public.wallets),
      'subscriptions',        (SELECT count(*) FROM public.subscriptions),
      'portfolios',           (SELECT count(*) FROM public.portfolios),
      'portfolio_holdings',   (SELECT count(*) FROM public.portfolio_holdings),
      'wallet_transactions',  (SELECT count(*) FROM public.wallet_transactions),
      'ai_decisions',         (SELECT count(*) FROM public.ai_decisions),
      'auth_events',          (SELECT count(*) FROM public.auth_events),
      'trade_signals',        (SELECT count(*) FROM public.trade_signals),
      'execution_history',    (SELECT count(*) FROM public.execution_history)
    ),
    'orphans', jsonb_build_object(
      'profiles_missing_user',         (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)),
      'user_roles_missing_user',       (SELECT count(*) FROM public.user_roles r WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id)),
      'wallets_missing_user',          (SELECT count(*) FROM public.wallets w WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.user_id)),
      'subscriptions_missing_user',    (SELECT count(*) FROM public.subscriptions s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id)),
      'subscriptions_missing_plan',    (SELECT count(*) FROM public.subscriptions s WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans p WHERE p.id = s.plan_id)),
      'portfolios_missing_user',       (SELECT count(*) FROM public.portfolios pf WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pf.user_id)),
      'holdings_missing_portfolio',    (SELECT count(*) FROM public.portfolio_holdings h WHERE NOT EXISTS (SELECT 1 FROM public.portfolios pf WHERE pf.id = h.portfolio_id)),
      'holdings_user_mismatch',        (SELECT count(*) FROM public.portfolio_holdings h JOIN public.portfolios pf ON pf.id=h.portfolio_id WHERE h.user_id <> pf.user_id),
      'wallet_tx_missing_user',        (SELECT count(*) FROM public.wallet_transactions t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)),
      'ai_decisions_missing_user',     (SELECT count(*) FROM public.ai_decisions a WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id))
    ),
    'missing_links', jsonb_build_object(
      'users_without_profile', (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)),
      'users_without_role',    (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)),
      'users_without_wallet',  (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = u.id))
    ),
    'duplicates', jsonb_build_object(
      'profiles',                 (SELECT count(*) FROM (SELECT id FROM public.profiles GROUP BY id HAVING count(*)>1) x),
      'wallets',                  (SELECT count(*) FROM (SELECT user_id FROM public.wallets GROUP BY user_id HAVING count(*)>1) x),
      'user_roles',               (SELECT count(*) FROM (SELECT user_id, role FROM public.user_roles GROUP BY user_id, role HAVING count(*)>1) x),
      'active_subscriptions',     (SELECT count(*) FROM (SELECT user_id FROM public.subscriptions WHERE status IN ('active','trialing','past_due') GROUP BY user_id HAVING count(*)>1) x)
    ),
    'rls', jsonb_build_object(
      'public_tables_total',        (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
      'public_tables_with_rls',     (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity),
      'public_tables_without_rls',  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity),
      'tables_rls_no_policy', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname))
    ),
    'recent_auth_24h', jsonb_build_object(
      'signups',         (SELECT count(*) FROM public.auth_events WHERE event_type='signup' AND created_at > now() - interval '24 hours'),
      'signup_failed',   (SELECT count(*) FROM public.auth_events WHERE event_type='signup_failed' AND created_at > now() - interval '24 hours'),
      'signins',         (SELECT count(*) FROM public.auth_events WHERE event_type='signin' AND created_at > now() - interval '24 hours'),
      'signin_failed',   (SELECT count(*) FROM public.auth_events WHERE event_type='signin_failed' AND created_at > now() - interval '24 hours')
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.db_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.db_health_check() TO authenticated;
