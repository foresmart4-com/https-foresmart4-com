# خطة إصلاح منظومة الدفع والاشتراكات

## القرار المعماري
- **Stripe (المدمجة في Lovable)** = الاشتراكات بالريال SAR، مع تجربة 14 يوم تتطلب بطاقة، وتجديد تلقائي.
- **Moyasar** = شحن المحفظة بالريال فقط (mada/Apple Pay/STC Pay).
- نُلغي صفحة Moyasar في الاشتراك، ونُلغي `createDepositSession` (Stripe USD للمحفظة) لأنها كود ميت.

---

## 1. تعديلات قاعدة البيانات (migration)

**أ. تعديل `subscriptions`:**
- إضافة: `stripe_subscription_id text unique`, `stripe_customer_id text`, `environment text default 'sandbox'`, `product_id text`, `price_id text`.
- إبقاء حقول Moyasar الحالية للتوافق (لكنها لن تُستخدم).

**ب. تعديل دالة `has_active_subscription`:**
- إضافة فلترة `environment` + قبول `trialing` (موجود) + شرط `canceled مع period_end مستقبلي` (وصول حتى نهاية الفترة).

**ج. تعديل دالة `handle_new_user_role`:**
- المستخدم الجديد يحصل على دور `subscriber` تلقائياً (بدلاً من `pending`) لتمكين التجربة.
- أول مستخدم يبقى `admin`.

**د. إضافة trigger يعتمد على `has_active_subscription`:**
- عند تحديث `subscriptions.status` إلى `canceled/unpaid/incomplete_expired` ومرور `current_period_end` → حذف دور `subscriber`.

**هـ. تفعيل realtime على `subscriptions`** ليُحدّث UI فوراً بعد دفع.

## 2. كتالوج المنتجات (Stripe)

إنشاء منتج واحد بسعرين عبر `payments--batch_create_product`:
- `id: stratagem_subscription`
- السعر `quarterly_sar`: 29900 هللة، SAR، تكرار شهري كل 3 أشهر (`recurring_interval=month, interval_count=3` — أو نستخدم `month` ونحتسب كم شهر في كل دفعة).
- السعر `annual_sar`: 89900 هللة، SAR، سنوياً.

> ملاحظة: سنحدّد فترة التجربة 14 يوم على Checkout Session لا على المنتج (`subscription_data.trial_period_days = 14`).

## 3. كود الخادم (Stripe)

**أ. `src/lib/stripe.server.ts`** — نسخ utility الموحّد (`createStripeClient` + `verifyWebhook`) كما في knowledge.

**ب. `src/lib/payments.functions.ts`** — استبدال `initiateSubscription` بـ:
- `createSubscriptionCheckout({ priceId, environment })`: ينشئ Stripe Checkout Session بـ `mode=subscription`, `subscription_data.trial_period_days=14`, `metadata.userId`, نجاح/إلغاء يعودان إلى `/subscription`.
- `createBillingPortalSession({ environment })`: لإدارة الاشتراك/إلغائه/تحديث البطاقة.
- إبقاء `previewTopupFees` و `initiateTopup` (Moyasar).

**ج. `src/routes/api/public/payments/webhook.ts`** — استبدال الموجود بمعالج Stripe الكامل من knowledge:
- يستقبل `customer.subscription.created/updated/deleted`.
- `upsert` على `subscriptions` بمفتاح `stripe_subscription_id`.
- يقرأ `?env=sandbox|live`.
- يتحقق من التوقيع HMAC.

## 4. كود الخادم (Moyasar — تنظيف وأمان)

**أ. `src/routes/api/public/moyasar-webhook.ts`:**
- إزالة منطق `subscription` (لم نعد نستخدم Moyasar للاشتراك).
- إبقاء `wallet_topup` فقط.
- تحسين تحقق `secret_token` ليكون مقارنة ثابتة (timing-safe).

**ب. حذف `createDepositSession` من `checkout.functions.ts`** (كود ميت).

## 5. الواجهة (UI)

**أ. `/subscription`:**
- إزالة Moyasar.js بالكامل.
- زر "ابدأ التجربة المجانية 14 يوم" → يستدعي `createSubscriptionCheckout` ويعيد التوجيه إلى Stripe Checkout.
- إذا اشتراك نشط: عرض حالة التجربة/التجديد + زر "إدارة الاشتراك" يفتح Customer Portal في تبويب جديد.
- زر "إلغاء الاشتراك" داخل البورتل (Stripe يديره).

**ب. `/wallet`:** بدون تغيير وظيفي (Moyasar كما هي).

**ج. `AccessGate`:**
- إزالة شاشة "pending" نهائياً.
- استبدالها بـ: إذا `!has_active_subscription` → عرض شاشة ترويج تدفع لصفحة `/subscription` فقط (بدلاً من قفل كامل).
- الأدمن يتجاوز.

**د. `useAccess.ts`:**
- إضافة `hasActiveSubscription` (استعلام `subscriptions` مع فلترة `environment`).
- `canAccess = isAdmin || hasActiveSubscription`.

## 6. أسرار مطلوبة من المستخدم

- **`MOYASAR_PUBLISHABLE_KEY`** و **`MOYASAR_SECRET_KEY`** و **`MOYASAR_WEBHOOK_SECRET`** (بعد إنشاء حساب على moyasar.com وتفعيل وضع الاختبار). بدونها: شحن المحفظة لا يعمل، لكن الاشتراك (Stripe) يعمل.

## 7. خطة الاختبار في المعاينة

**اختبار الاشتراك (Stripe Sandbox):**
1. سجّل مستخدم جديد → ينبغي أن تُفتح كل الصفحات (دون شاشة pending).
2. ادخل `/subscription` واضغط "ابدأ التجربة" على الخطة الفصلية.
3. في صفحة Stripe، استخدم بطاقة الاختبار: **`4242 4242 4242 4242`**, تاريخ مستقبلي، CVC `123`, الرمز البريدي `12345`.
4. عند العودة → يجب رؤية "أنت في تجربة 14 يوم" وزر "إدارة الاشتراك".
5. اختبار الإلغاء عبر Customer Portal → الحالة تتحول إلى `canceled` لكن الوصول يبقى حتى نهاية الفترة.
6. اختبار فشل الدفع: بطاقة `4000 0000 0000 0341`.

**اختبار شحن المحفظة (Moyasar):**
- لن يعمل قبل إضافة المفاتيح. بعد إضافتها: بطاقة اختبار Moyasar `4111 1111 1111 1111`, OTP `12345`.

**اختبار سيناريو نهاية التجربة:**
- داخل Stripe Sandbox، يمكن تقديم وقت التجربة من Customer Portal أو من لوحة Stripe لتشغيل تجديد فوري.

## التفاصيل التقنية

- جميع نداءات Stripe تمر عبر `createStripeClient(env)` (gateway proxy، لا SDK مباشر).
- Webhook URL: `https://project--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app/api/public/payments/webhook?env=sandbox` — مسجَّل تلقائياً.
- العملة في Stripe: SAR مدعومة طبيعياً.
- لا تغييرات على ملف `routeTree.gen.ts` (auto-generated).
- جدول `subscription_plans` يبقى للعرض فقط (الأسعار الحقيقية في Stripe).
