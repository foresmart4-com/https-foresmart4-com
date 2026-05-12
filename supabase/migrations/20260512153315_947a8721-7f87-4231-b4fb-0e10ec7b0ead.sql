-- Auto-create a 14-day trial subscription row for every new user
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trial_plan_id uuid;
BEGIN
  SELECT id INTO trial_plan_id FROM public.subscription_plans
    WHERE code = 'quarterly' AND is_active = true LIMIT 1;
  
  INSERT INTO public.subscriptions (
    user_id, plan_id, status, trial_ends_at,
    current_period_start, current_period_end, environment, currency
  ) VALUES (
    NEW.id, trial_plan_id, 'trialing',
    now() + interval '14 days',
    now(), now() + interval '14 days',
    'sandbox', 'SAR'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- Seed subscription_plans if empty (so trial trigger has a plan_id and UI shows plans)
INSERT INTO public.subscription_plans (code, name_ar, name_en, price_sar, duration_months, trial_days, features, sort_order, is_active)
SELECT 'quarterly', 'الخطة الفصلية', 'Quarterly Plan', 299, 3, 14, 
  '["وصول كامل لجميع التحليلات","تحديثات لحظية للأسواق","المستشار الذكي","تنبيهات الأسعار","شحن المحفظة"]'::jsonb,
  1, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE code = 'quarterly');

INSERT INTO public.subscription_plans (code, name_ar, name_en, price_sar, duration_months, trial_days, features, sort_order, is_active)
SELECT 'annual', 'الخطة السنوية', 'Annual Plan', 899, 12, 14,
  '["جميع مزايا الخطة الفصلية","توفير 25% مقارنة بالفصلية","الأولوية في الدعم","تقارير شهرية مخصصة","تحليلات حصرية"]'::jsonb,
  2, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE code = 'annual');