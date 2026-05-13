# خطة التحسينات الكبرى — ForeSmart

سأنفذ التحسينات الأربعة على مراحل (دفعة لكل مرحلة لضمان الجودة).

## المرحلة 1 — محرك الإشارات الذكي (Signals Engine)
**الصفحة الجديدة:** `/_app/signals`

- جدول DB جديد `trade_signals`: symbol, action (buy/sell/hold), confidence (0-100), entry, stop, targets[], rationale, technical_score, sentiment_score, generated_at, expires_at
- Server function `generateSignals` تجمع:
  - مؤشرات فنية محسوبة محلياً من market history: RSI(14), MACD, Bollinger Bands, MA50/MA200 cross, Momentum
  - تحليل معنويات أخبار عبر Lovable AI (gemini-3-flash) لكل أصل
  - دمج الإشارات بصيغة وزنية → درجة ثقة نهائية
- UI: شبكة بطاقات إشارات مع شريط ثقة، فلتر حسب القوة/المدى الزمني، أزرار سريعة (إضافة لـ Watchlist، إنشاء تنبيه، شراء)
- Cron job كل 30 دقيقة لتحديث الإشارات تلقائياً

## المرحلة 2 — Watchlist + تنبيهات لحظية
**الصفحة:** `/_app/watchlist` + تعزيز `/alerts`

- جدول `watchlist_items`: user_id, symbol, asset_name, market, added_at, target_price?, notes?
- بطاقات حية بسعر متغير ولون تغير + sparkline مصغّر
- تنبيهات متقدمة: شروط متعددة (price-above/below, change_pct, RSI overbought/oversold, MA cross)
- إرسال إشعار بريدي عند تفعيل التنبيه (يستخدم البنية الموجودة)
- زر "+" في كل بطاقة سوق/أصل لإضافته للقائمة

## المرحلة 3 — تحليلات أداء المحفظة
**تعزيز:** `/_app/portfolios`

- حساب: Sharpe ratio, max drawdown, total return, volatility, beta vs benchmark
- مخطط أداء تاريخي مقابل S&P500/المؤشر السعودي
- توصيات إعادة توازن AI: "محفظتك مركّزة 65% في التقنية، يُنصح بتنويع نحو الطاقة"
- تحليل التنويع: pie chart بالقطاعات والأسواق

## المرحلة 4 — سكانر فرص استثمارية
**الصفحة:** `/_app/scanner`

- فلاتر مرنة: نطاق سعر، تغير %، RSI، حجم تداول، رسملة سوقية
- presets جاهزة: "Momentum stocks", "Oversold value", "Breakout candidates", "Dividend kings"
- نتائج مرتبة بدرجة فرصة محسوبة AI
- زر إضافة مباشر لـ Watchlist أو إنشاء تنبيه

## المرحلة 5 — تحسينات شاملة
- إضافة روابط Sidebar للصفحات الجديدة
- ترجمات i18n عربي/إنجليزي كاملة
- SEO meta لكل صفحة جديدة
- تحسينات وصف ميتا للموقع (foresmart4.store)

## ابدأ بالمرحلة 1
بسبب الحجم، سأنفذ المرحلة 1 (محرك الإشارات) بالكامل في هذه الجولة، ثم ننتقل تباعاً للمراحل التالية في رسائل قادمة.
