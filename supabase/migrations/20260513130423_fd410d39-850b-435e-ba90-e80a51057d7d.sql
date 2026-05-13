
-- Update plans
UPDATE public.subscription_plans SET price_sar = 70, name_ar = 'الخطة الفصلية', name_en = 'Quarterly', sort_order = 1 WHERE code = 'quarterly';
UPDATE public.subscription_plans SET price_sar = 160, name_ar = 'الخطة السنوية', name_en = 'Annual', sort_order = 3 WHERE code = 'annual';

INSERT INTO public.subscription_plans (code, name_ar, name_en, price_sar, duration_months, is_active, sort_order, features)
VALUES ('semi_annual', 'الخطة النصف سنوية', 'Semi-Annual', 100, 6, true, 2,
  '["جميع المزايا","تنبيهات لحظية","مستشار ذكي","تجربة مجانية 14 يوم"]'::jsonb)
ON CONFLICT (code) DO UPDATE
  SET price_sar = EXCLUDED.price_sar,
      duration_months = EXCLUDED.duration_months,
      name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      sort_order = EXCLUDED.sort_order,
      is_active = true;

-- Interest leads
CREATE TABLE IF NOT EXISTS public.interest_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  interested_plan text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interest_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit interest"
  ON public.interest_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(full_name) BETWEEN 1 AND 120
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND char_length(email) <= 255
    AND (phone IS NULL OR char_length(phone) <= 40)
    AND (notes IS NULL OR char_length(notes) <= 1000)
    AND (interested_plan IS NULL OR interested_plan IN ('quarterly','semi_annual','annual','trial'))
  );

CREATE POLICY "Admins manage leads"
  ON public.interest_leads FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
