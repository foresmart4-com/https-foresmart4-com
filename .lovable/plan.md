# Phase 2 — محفظة الأصول الشاملة (Universal Asset Portfolio)

## الهدف
تحويل صفحة `/stocks-portfolio` إلى صفحة `/assets-portfolio` تجمع كل أصول المستخدم في مكان واحد (يدوي + مزودون اختياريون)، مع تصنيف، تسعير حي، أرباح/خسائر، وشارات مصدر البيانات. التداول الحقيقي يبقى معطّلاً.

## 1) قاعدة البيانات (Migration)

جدول جديد `user_assets` لتخزين جميع الأصول (يدوي أو مرتبطة بمزود):

```
user_assets
  id uuid pk
  user_id uuid (RLS: auth.uid())
  asset_class enum: us_stock | sa_stock | etf | bond | crypto | metal
                  | commodity | cash | other
  source enum: manual | binance | alpaca | ibkr | demo
  symbol text          -- AAPL / 2222.SR / BTC / GOLD / USD
  name text            -- اسم العرض
  quantity numeric
  avg_cost numeric     -- متوسط تكلفة الشراء
  currency text default 'USD'
  market text          -- US / SA / CRYPTO / METAL / ...
  notes text
  yield_pct numeric    -- التوزيعات/الفائدة السنوية (اختياري)
  data_mode enum: live | delayed | manual | mock  default 'manual'
  is_active boolean default true
  created_at / updated_at
```

سياسات RLS: `auth.uid() = user_id` لكل العمليات. منع anon كلياً.

جدول `manual_cash_entries` (إيداعات/سحوبات يدوية لخانة الكاش):
```
  id, user_id, currency, amount, kind (deposit|withdrawal|adjustment),
  note, created_at
```
RLS مالك فقط.

(لا نلمس wallet_transactions — تلك خاصة بحركات SAR الفعلية).

## 2) Server Functions — `src/lib/assets.functions.ts`
كلها مع `requireSupabaseAuth` + Zod validation:

- `listUserAssets()` — يرجع كل الأصول + يحسب القيمة السوقية والـ P/L.
- `addUserAsset(input)` — إضافة يدوية.
- `updateUserAsset(id, patch)` — تعديل.
- `deleteUserAsset(id)` — حذف ناعم (is_active=false) أو حذف فعلي.
- `addManualCash(input)` — يضيف صف في `manual_cash_entries` ويُحدّث/يُنشئ صف cash في `user_assets`.
- `seedDemoBalance()` — يحقن 5–6 أصول تجريبية (source='demo', data_mode='mock') للمستخدم.
- `getAssetPrices(symbols, asset_class)` — يجلب الأسعار من المزود المناسب:
  - US/ETF/Bond → Alpaca/Finnhub (الموجودَين)
  - Crypto → Binance public (بدون مفاتيح) أو CoinGecko
  - SA stocks → TwelveData (موجود)
  - Metals/Commodity → سعر يدوي/متأخر مع شارة Delayed
  - Cash → 1.00
  يرجع `{symbol, price, mode: live|delayed|manual|mock}`.

## 3) UI — `src/routes/_app/assets-portfolio.tsx`

استبدال محتوى صفحة الأسهم الحالي (الاحتفاظ بالملف القديم كاسم بديل/redirect لتفادي كسر الروابط).

### الأقسام:
1. **Header**: عنوان «محفظة الأصول الشاملة» + شرح موجز عربي عن فائدتها (متابعة موحّدة لكل أصولك من سوق واحد ولوحة واحدة، حساب P/L، تنويع، تخصيص).
2. **Summary cards**: إجمالي القيمة، الكاش، P/L اليوم، P/L الكلي، عدد الأصول.
3. **Asset Allocation**: توزيع حسب `asset_class` (Progress bars + ألوان).
4. **Actions toolbar**:
   - زر «إضافة أصل» (Dialog)
   - زر «إيداع كاش يدوي» (Dialog)
   - زر «تحميل رصيد تجريبي»
   - زر «تحديث الأسعار»
   - مفتاح تحديث تلقائي 60s
5. **Assets Table** (Tabs حسب التصنيف: الكل / أسهم / ETFs / سندات / كريبتو / معادن / كاش):
   - الأعمدة: الرمز · النوع · السوق · الكمية · متوسط الشراء · السعر الحالي · القيمة · P/L · P/L% · العائد% · المصدر · إجراءات.
   - شارة لكل صف: Live (أخضر) / Delayed (أصفر) / Manual (رمادي) / Mock (بنفسجي).
   - Tooltips عربية على رأس كل عمود تشرح المعنى.
   - أزرار تعديل/حذف عبر Dialog.
6. **Broker Linking (اختياري)**: بطاقات Binance / Alpaca / IBKR — تعرض حالة الاتصال، عند الربط تستورد المراكز كـ `source='binance|alpaca|ibkr'` و `data_mode='live'`. لا تظهر أي زر تنفيذ أوامر.
7. **Live Trading Disabled banner**: شريط واضح أعلى الصفحة «التداول الحقيقي معطّل — معاينة فقط» مع `LIVE_TRADING_ENABLED=false` ثابت في الكود.

### مكونات فرعية:
- `AddAssetDialog.tsx` — نموذج: asset_class، symbol، name، quantity، avg_cost، currency، market، yield_pct، notes.
- `EditAssetDialog.tsx`
- `ManualCashDialog.tsx`
- `AssetRow.tsx` (مع Tooltip عربي على شارة المصدر يشرح Live/Delayed/Manual/Mock)
- `DataModeBadge.tsx` (مشترك)

## 4) i18n
إضافة مفاتيح عربية كاملة في `src/locales/ar.json` لكل النصوص + Tooltips:
- شرح كل تصنيف أصل
- معنى متوسط الشراء، P/L، العائد
- معنى كل شارة بيانات
- شرح أن الأرصدة اليدوية لا تُنفّذ صفقات حقيقية

## 5) قائمة التنقل
- إعادة تسمية «محفظة الأسهم» إلى «محفظة الأصول» في `src/routes/_app.tsx`.
- توجيه `/stocks-portfolio` إلى `/assets-portfolio` (redirect خفيف داخل الراوتر).

## 6) القيود/الحماية
- `LIVE_TRADING_ENABLED = false` ثابت + banner.
- كل الـ server functions تستخدم `requireSupabaseAuth` + Zod (حدود طول/أرقام معقولة).
- لا أسرار في الـ client. أسعار العملات الرقمية تستخدم endpoints عامة من السيرفر فقط.
- ربط البروكر لا يُغيّر أرصدة المستخدم اليدوية — يضيف مراكز منفصلة بمصدر مختلف.

## Deliverables
1. Migration (`user_assets` + `manual_cash_entries` + RLS).
2. `src/lib/assets.functions.ts` (8 server functions).
3. `src/routes/_app/assets-portfolio.tsx` + 4 مكونات Dialog/Row.
4. `DataModeBadge` مشترك.
5. تحديث i18n + قائمة التنقل + redirect من الصفحة القديمة.

التداول الحقيقي يبقى معطّلاً. الربط بالبروكر اختياري لاحقاً عبر نفس البنية.
