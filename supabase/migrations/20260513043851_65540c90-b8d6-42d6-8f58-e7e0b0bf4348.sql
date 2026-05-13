CREATE OR REPLACE FUNCTION public.wallet_apply_order(_user_id uuid, _amount numeric, _side text)
RETURNS TABLE(id uuid, balance numeric, currency text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF _side = 'buy' THEN
    RETURN QUERY
      UPDATE public.wallets w
      SET balance = w.balance - _amount,
          updated_at = now()
      WHERE w.user_id = _user_id
        AND w.balance >= _amount
      RETURNING w.id, w.balance, w.currency;
  ELSIF _side = 'sell' THEN
    RETURN QUERY
      UPDATE public.wallets w
      SET balance = w.balance + _amount,
          updated_at = now()
      WHERE w.user_id = _user_id
      RETURNING w.id, w.balance, w.currency;
  ELSE
    RAISE EXCEPTION 'invalid side: %', _side;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_apply_order(uuid, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_apply_order(uuid, numeric, text) TO service_role;