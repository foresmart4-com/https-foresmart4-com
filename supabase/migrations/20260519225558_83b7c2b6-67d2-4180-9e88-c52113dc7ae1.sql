
CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  actor_user_id uuid,
  old_role public.app_role,
  new_role public.app_role,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read role_change_audit"
  ON public.role_change_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own role_change_audit"
  ON public.role_change_audit FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id);

CREATE POLICY "service_role manages role_change_audit"
  ON public.role_change_audit FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "deny client insert role_change_audit"
  ON public.role_change_audit AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny client update role_change_audit"
  ON public.role_change_audit AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "deny client delete role_change_audit"
  ON public.role_change_audit AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_change_audit (target_user_id, actor_user_id, old_role, new_role, action)
    VALUES (NEW.user_id, auth.uid(), NULL, NEW.role, 'insert');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.role_change_audit (target_user_id, actor_user_id, old_role, new_role, action)
    VALUES (NEW.user_id, auth.uid(), OLD.role, NEW.role, 'update');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_change_audit (target_user_id, actor_user_id, old_role, new_role, action)
    VALUES (OLD.user_id, auth.uid(), OLD.role, NULL, 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_role_change ON public.user_roles;
CREATE TRIGGER trg_log_user_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();

DROP POLICY IF EXISTS "admins manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "users manage own roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated manage user_roles" ON public.user_roles;

CREATE POLICY "deny client insert user_roles"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny client update user_roles"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "deny client delete user_roles"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "service_role manages user_roles" ON public.user_roles;
CREATE POLICY "service_role manages user_roles"
  ON public.user_roles FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
