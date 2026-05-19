# دليل تدوير مفاتيح API

كل المفاتيح الحساسة مخزّنة كأسرار سيرفر فقط (`process.env.*`) ولا يوجد أي
مفتاح داخل الكود أو في ملفات `VITE_*`. التدوير لا يتطلب تعديل أي ملف كود
ولا إعادة نشر يدوي — يكفي تحديث قيمة السرّ ثم اختبار الاتصال.

---

## 1) Finnhub (`FINNHUB_API_KEY`)

**متى تُدوِّر:** عند تسريب مشتبه به، أو دوريًا كل 90 يومًا.

1. ادخل إلى لوحة Finnhub → API Keys → **Revoke** للمفتاح القديم.
2. أنشئ مفتاحًا جديدًا وانسخه.
3. في Lovable: **Cloud → Secrets** → عدِّل `FINNHUB_API_KEY` والصق القيمة الجديدة.
4. اختبر من صفحة `/market-data-monitor` — يجب أن يعود الحقل `configured: true` وحالة "fresh" خلال ثوانٍ.

**المتأثر:** `src/services/providers/finnhub.ts`، `src/routes/api/finnhub/stream.ts`.
لا يلزم redeploy — السرّ يُقرأ في كل طلب.

---

## 2) AlphaVantage / TwelveData / NewsAPI

نفس التدفق:
- `ALPHAVANTAGE_API_KEY` → لوحة AlphaVantage
- `TWELVEDATA_API_KEY` → لوحة TwelveData
- `NEWSAPI_KEY` و`NEWSAPI_KEY_BACKUP` → لوحة NewsAPI (NewsAPI تدعم تدوير سلس عبر backup key)

ثم تحقّق من `/provider-health` لرؤية إعادة الترتيب التلقائي.

---

## 3) Supabase (Service Role + Anon)

استخدم أداة Lovable المخصّصة: **Cloud → Settings → Rotate API keys**.
سيتم تحديث `SUPABASE_SERVICE_ROLE_KEY` و`SUPABASE_PUBLISHABLE_KEY` و`.env` تلقائيًا.

⚠️ **تحذير حرج:** قبل تدوير `SUPABASE_SERVICE_ROLE_KEY` تأكّد أن `VAULT_MASTER_KEY`
مضبوط بقيمة مستقلة. وإلا، كل المفاتيح المُشفّرة في `user_api_keys` و`broker_credentials`
ستصبح غير قابلة لفك التشفير (لأن المفتاح الرئيسي للتشفير يقع حاليًا على
service role key كاحتياط).

**خطوات آمنة:**
1. ولِّد قيمة عشوائية: `openssl rand -base64 32`
2. أضفها كسرّ جديد باسم `VAULT_MASTER_KEY` (Cloud → Secrets → Add).
3. اضبط الكود ليرفض الاحتياط (راجع التحذير الأمني في صفحة Security).
4. بعدها فقط دوِّر service role key بأمان.

---

## 4) Binance (`BINANCE_API_KEY` / `BINANCE_SECRET_KEY`)

1. لوحة Binance → API Management → **Delete** للمفتاح الحالي.
2. أنشئ زوج مفاتيح جديد مع تفعيل IP whitelist إن أمكن.
3. حدّث السرّين في Lovable Secrets.

---

## 5) Stripe / Resend / Payments webhooks

- `STRIPE_SANDBOX_API_KEY` → Stripe Dashboard → Developers → API keys → Roll
- `RESEND_API_KEY` → Resend → API Keys → Regenerate
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET` → أعد توليد الـ webhook في مزوّد الدفع وحدِّث القيمة

---

## 6) Lovable AI Gateway

`LOVABLE_API_KEY` لا يُدار يدويًا — استخدم زر **Rotate** من إعدادات AI Gateway
في Lovable.

---

## قائمة فحص بعد كل تدوير

- [ ] `/market-data-monitor` — مزوّد المفتاح "fresh" وغير `down`
- [ ] `/provider-health` — لا توجد أحداث failover جديدة سببها المفتاح المُدوَّر
- [ ] لا أخطاء `401/403` في logs الـ server functions خلال 5 دقائق
- [ ] إن دُوِّر المفتاح بسبب تسريب: راجع `auth_events` و`system_events` لرصد أي استخدام غير مشروع قبل التدوير
