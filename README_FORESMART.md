# ForeSmart — منصة استثمار وتحليل ذكي

> نسخة MVP احترافية جاهزة كواجهة كاملة، مع بيانات تجريبية (Mock) في انتظار الربط مع APIs الحقيقية للأسواق والدفع والذكاء الاصطناعي.

---

## وصف المشروع

ForeSmart منصة استثمار باللغة العربية (RTL) بتصميم داكن احترافي قريب من منصات التداول الاحترافية. تتيح للمستخدمين المعتمدين بالدعوة فقط متابعة الأسواق، إدارة المحفظة، تجربة محاكاة التداول، الاطلاع على إشارات ذكاء اصطناعي، وإدارة الاشتراك والإيداع.

الوصول مقيّد بنظام **الدعوة + موافقة المالك**، ولا يوجد تسجيل مفتوح للعامة.

---

## الصفحات الموجودة

- `/` — الصفحة الرئيسية + نموذج "اهتمام / طلب دعوة".
- `/auth` — تسجيل الدخول (دعوة + موافقة المالك).
- `/dashboard` — لوحة تحكم (KPIs، رسم أداء 30 يوم، تنبيهات AI، أفضل الفرص).
- `/markets` — قائمة الأسواق + جدول الأصول المميّزة (أرامكو، تاسي، S&P 500، BTC، الذهب…).
- `/paper-trading` — محاكاة تداول (أسهم/عملات/سندات).
- `/wallet` — المحفظة + توزيع الأصول + P&L لكل أصل + شراء سريع.
- `/deposit` — صفحة إيداع احترافية مع طرق دفع متعددة وحساب رسوم تلقائي.
- `/subscription` — خطط الاشتراك (Basic / Pro) + تجربة 14 يوم مجانية.
- `/advisor` — ForeSmart AI Analyst (واجهة محادثة بردود تجريبية).
- `/alerts`, `/watchlist`, `/scanner`, `/heatmap`, `/calendar`, `/signals`, `/growth-plan`, `/archive`, `/portfolios`, `/external-accounts`, `/bank-accounts`, `/members`, `/profile`, `/settings`, `/domain`.

> القائمة الجانبية وأسماء الصفحات ثابتة كما هي الآن.

---

## المزايا المنجزة

- واجهة عربية RTL داكنة احترافية موحّدة عبر design tokens في `src/styles.css`.
- لوحة تحكم بـ 6 بطاقات KPI ورسم أداء (Recharts) وتنبيهات AI وأفضل الفرص.
- جدول أصول مميّزة مع إشارات AI ومستوى مخاطرة.
- محفظة: توزيع أصول (Pie)، سجل عمليات، نموذج عملية يدوي، شراء سريع، P&L لكل أصل.
- صفحة إيداع: نموذج كامل + حساب رسوم تلقائي + سجل الطلبات + ملخص واضح.
- خطط اشتراك Basic / Pro (3 / 6 / 12 شهر) + تجربة مجانية 14 يوم + جدول مقارنة.
- AI Analyst: واجهة محادثة + أسئلة جاهزة + تنويه قانوني.
- لوحة System Status للمسؤول (داخل الإعدادات).
- نظام الدعوة + موافقة المالك سليم ولم يُحذف.

---

## ما هو Mock حالياً

- بيانات الأسواق وKPIs والرسوم البيانية: `src/lib/mock-data.ts`.
- إشارات AI، أفضل الفرص، توزيع المحفظة، P&L لكل أصل.
- سجل الإيداعات.
- ردود ForeSmart AI Analyst (قوالب جاهزة).

كل هذه الحقول معزولة في `src/lib/mock-data.ts` ليسهل استبدالها لاحقاً ببيانات حقيقية.

---

## ما يحتاج ربط API لاحقاً

- بيانات أسواق حية: Twelve Data / Alpha Vantage / Polygon (للأسهم السعودية والأمريكية والعملات).
- بيانات الكريبتو: CoinGecko / Binance.
- الذهب والنفط: TradingEconomics / Metals-API.
- ذكاء اصطناعي حقيقي للمستشار: Lovable AI Gateway (Gemini / GPT-5).
- روابط شراء السندات الأمريكية الفعلية (موجودة كروابط خارجية في `src/lib/bond-links.ts`).
- بوابات الدفع: Stripe / Moyasar / PayTabs / Tap.
- السحب من المحفظة (غير مفعل حالياً).

---

## Stripe lookup keys المطلوبة

عند تفعيل Stripe لاحقاً، يجب إنشاء أسعار في لوحة Stripe وربطها بـ lookup keys التالية تماماً:

```
quarterly_sar
semi_annual_sar
annual_sar
pro_quarterly_sar
pro_semi_annual_sar
pro_annual_sar
```

الأسعار يجب أن تطابق ما هو في جدول `subscription_plans` بالـ DB.

---

## رسوم التحويل (الإيداع)

| المبلغ | الرسوم |
|---|---|
| أقل من 1000 ريال | 5 ريال |
| 1000 ريال فأكثر | 10 ريال |

تُحسب تلقائياً في `calcTransferFee()` داخل `src/lib/mock-data.ts`.

---

## رسوم المحفظة الشهرية

- **0.1%** شهرياً من قيمة المحفظة (`MONTHLY_WALLET_FEE_PCT = 0.001`).
- يتم احتسابها كقيمة عرض فقط في الواجهة حالياً، ولا يتم خصمها فعلياً حتى ربط نظام الفوترة.

---

## خطط الاشتراك

### Basic
- 3 شهور: 100 ريال
- 6 شهور: 150 ريال
- سنة كاملة: 200 ريال

### Pro
- 3 شهور: 150 ريال
- 6 شهور: 200 ريال
- سنة كاملة: 300 ريال

> جميع الخطط تبدأ بـ **تجربة مجانية 14 يوم** بدون أي خصم.

---

## حالة الأنظمة (System Status — MVP)

| النظام | الحالة |
|---|---|
| بيانات الأسواق | Mock — جاهز للربط |
| الدفع | غير مفعّل — يحتاج Stripe lookup keys |
| الإيداع | يعمل كطلب مراجعة داخلي |
| السحب | غير مفعّل حالياً |
| AI | ردود تجريبية — جاهز للربط |
| الاشتراكات | الواجهة جاهزة — الدفع غير مفعّل |

---

## تنبيه قانوني مهم

> جميع التحليلات والإشارات والتنبيهات المعروضة في ForeSmart هي **لأغراض تعليمية واسترشادية فقط**، ولا تُعتبر توصية مالية ملزمة أو دعوة للشراء أو البيع. القرار الاستثماري يبقى مسؤولية المستخدم الكاملة، ويُنصح بالرجوع إلى مستشار مالي مرخّص قبل اتخاذ أي قرار.

---

## تحديثات هذه المرحلة (الربط الحقيقي والتجهيز التشغيلي)

### 1) بيانات العملات الرقمية — مباشر عبر CoinGecko
- `src/lib/marketApi.ts` يستخدم `https://api.coingecko.com/v3/coins/markets` لجلب أسعار: Bitcoin, Ethereum, Solana, BNB, XRP.
- يعرض السعر بالدولار، التغير 24 ساعة، القيمة السوقية، ووقت آخر تحديث.
- Fallback تلقائي إلى بيانات Mock عند فشل الاتصال.
- Badge واضح: `Live` عند النجاح، `Mock` عند الـ fallback.
- زر "تحديث" يعرض toast نجاح/فشل.

### 2) تجهيز ربط الأسهم والمؤشرات
- `fetchSaudiMarketData()` / `fetchUSMarketData()` / `fetchCommodityData()` كـ placeholders تُعيد بيانات Mock.
- يتم الربط لاحقاً عبر: **Twelve Data**, **Alpha Vantage**, **Finnhub**, ومزود سعودي عند توفره.

### 3) تحسين صفحة الأسواق
- لوحة `CryptoLivePanel` جديدة فوق جدول الأصول المميّزة.
- بحث باسم/رمز الأصل + عمود "المصدر" (Live / Mock).
- التبويبات الحالية (أسهم/كريبتو/سندات/معادن/فوركس) لم تتغير.

### 4) ذكاء اصطناعي تجريبي منظم
- `src/lib/aiAnalyst.ts` — `generateMockAnalysis(prompt, marketContext, portfolioContext, lang)`.
- يصنّف السؤال (سعودي/كريبتو/مقارنة/مخاطر/توزيع/عام) ويرجع: ملخص + مؤشرات + مستوى مخاطر + نقاط مراقبة + تنبيه قانوني.
- جاهز للاستبدال بـ Lovable AI Gateway عند التفعيل.

### 5) المحفظة + بيانات السوق
- لوحة `CryptoLivePanel` نفسها قابلة لإعادة الاستخدام داخل المحفظة لاحقاً.
- نموذج العمليات اليدوي ورسوم التحويل ورسوم المحفظة الشهرية 0.1% كما هي.

### 6) إعدادات روابط الدفع (Placeholders)
- صفحة الإيداع تدعم `payment_link` / `manual_bank` / `mada_visa_mc` + (Moyasar/PayTabs/Tap كـ future).
- في الإعدادات: قسم "إعدادات روابط الدفع" (`PaymentLinksSettings`) — حقول placeholder لـ Moyasar / PayTabs / Tap / Stripe + رابط دفع يدوي.
- تنبيه واضح: "الدفع الحقيقي يحتاج ربط مزود دفع وتفعيل Webhooks لاحقاً."
- لا تُحفظ أي مفاتيح سرية في الواجهة.

### 7) طلبات السحب
- `src/components/WithdrawalSection.tsx` داخل صفحة المحفظة (بدون تغيير القائمة الرئيسية).
- الحقول: المبلغ، اسم البنك، صاحب الحساب، IBAN، ملاحظة + حساب رسوم تلقائي (5/10 ريال).
- حالات الطلب: قيد المراجعة / مكتمل / مرفوض + تنبيه أن السحب يدوي.

### 8) لوحة إدارة مبسطة
- `src/components/AdminReviewPanel.tsx` تظهر داخل الإعدادات للمسؤول فقط.
- تعرض: طلبات الإيداع، طلبات السحب، الاشتراكات، الدعوات، مع إجراءات (قبول/رفض/تعليم كمكتمل) — تجريبية مع toast، بدون backend.

### ما زال يحتاج لاحقاً
- **Backend حقيقي** لطلبات الإيداع/السحب والاشتراكات والدعوات.
- **مزود دفع مفعّل** (Moyasar / Stripe / PayTabs / Tap) + Webhooks.
- **مزود بيانات أسواق** للأسهم والسلع (Twelve Data / Alpha Vantage / Finnhub).
- **AI حقيقي** عبر Lovable AI Gateway لاستبدال `generateMockAnalysis`.

## Market Intelligence Engine

ملف: `src/lib/marketIntelligence.ts`

يولّد لكل أصل تحليلاً مركّباً يجمع:

- **مؤشرات فنية:** RSI, MA20, MA50, اتجاه (up/down/side), دعم/مقاومة، زخم، تقلب، إشارة حجم.
- **معنويات أخبار (Mock):** `mockNewsSentiment` يعطي positive/neutral/negative — قابل لاحقاً للربط مع Finnhub News / NewsAPI / GDELT.
- **اقتصاد كلي (Mock):** فائدة، تضخم، DXY، نفط، ذهب — قابل للربط لاحقاً.
- **عوامل مخاطر:** تقلب عالي، هبوط مفاجئ، صعود مبالغ، تضارب إشارات، سيولة منخفضة.

### دالة القرار `generateTradingDecision(ctx)`

ترجع: `action` (BUY/SELL/HOLD/STOP_LOSS/TAKE_PROFIT), `confidence` 0-100,
`riskLevel`, `reasonSummary`, `supportingFactors`, `warningFactors`,
`suggestedStopLoss`, `suggestedTakeProfit`, `suggestedPositionSize %`,
`timeHorizon`, `mode: "analysis_only"`.

قواعد:

- لا تعطي `BUY` إذا `riskLevel = HIGH` إلا بثقة > 85.
- `STOP_LOSS` إذا الهبوط تجاوز حد الخسارة.
- `TAKE_PROFIT` إذا وصل السعر للهدف مع RSI مرتفع.
- `HOLD` عند تضارب الإشارات.
- تنبيه ثابت: "هذا تحليل مساعد وليس توصية مالية ملزمة."

## Auto Trading Simulation

ملف: `src/lib/autoTrading.ts`

- **Paper trading فقط.** لا ينفذ أوامر حقيقية.
- يقرأ قرارات `generateTradingDecision` ويُنشئ `AutoTradeOrder` بحالة `simulated` أو `pending_review`.
- إعدادات: تفعيل، أصول مسموحة، أقصى مبلغ/صفقة، حد خسارة يومي، أدنى ثقة، وضع تنفيذ (آلي/موافقة).
- زر "إيقاف فوري" يعطل النظام ويسجل وقت الإيقاف.
- التخزين محلي `localStorage` بمفتاح `foresmart_autotrade_v1`.

## لماذا التداول الحقيقي غير مفعّل

- لا يوجد ربط Broker API.
- لا توجد طبقة backend آمنة لتنفيذ أوامر مالية.
- البيانات (أسهم/سلع/أخبار/اقتصاد كلي) Mock في معظمها.
- لا توجد Audit logs ولا Risk limits على مستوى الخادم.

## المطلوب لاحقاً للربط مع وسيط حقيقي

1. **Broker API** معتمد (مثلاً: Interactive Brokers, Alpaca, Saxo, محلي مرخّص).
2. **API Keys** محفوظة كأسرار في `process.env` على الخادم — لا تُمرّر للواجهة.
3. **Backend آمن** عبر TanStack `createServerFn` مع `requireSupabaseAuth`.
4. **Database** لجدول `orders`, `executions`, `risk_limits`, `audit_logs`.
5. **Audit Logs** لكل أمر (المستخدم، الوقت، IP، القرار، الحالة).
6. **Risk Limits** على مستوى الخادم (ليس الواجهة فقط).
7. **KYC/AML** ومراجعة قانونية قبل أي تنفيذ حقيقي.

> جميع الأوامر الحالية في النظام **تجريبية (Simulation/Paper)** ولا تُنفّذ تداولاً حقيقياً.

## AI Decision QA & Safety Rules

### اختبار القرارات

داخل صفحة **AI Analyst** يوجد قسم "اختبار قرارات الذكاء الاصطناعي" (`AIDecisionTester`) ويحتوي:

- **أصول اختبار ثابتة:** BTC, ETH, أرامكو, الراجحي, الذهب — تعرض السعر/RSI/MA20/MA50/الاتجاه/الدعم/المقاومة/المعنويات/المخاطر/القرار/الثقة/وقف الخسارة/جني الربح.
- **زر "إعادة تحليل جميع الأصول"** يعيد تشغيل `generateTradingDecision` لكل أصل ويظهر toast بالتحديث.
- **اختبار سيناريوهات** (5): هبوط حاد، صعود قوي، تذبذب عالي، إشارات متضاربة، كسر وقف الخسارة. كل بطاقة تعرض القرار + السبب + هل سيتم إنشاء أمر Auto Trading Simulation أم لا.
- **سجل قرارات AI** (`decisionLog` في `autoTrading.ts`): الأصل، القرار، الثقة، المخاطر، المصدر Live/Mock، الوقت، هل تم إنشاء أمر، سبب الرفض إن وجد.

### قواعد الأمان (Safety Rules)

مطبقة داخل `tryCreateOrderFromDecision`:

1. **STOP_LOSS له أولوية على أي قرار آخر** — يُنشأ دائماً (Paper) حتى لو كان النظام معطلاً.
2. لا يُنشأ أمر BUY على بيانات تجريبية إلا إذا فعّل المستخدم `allowMockSimulation` (Toggle داخل الـ QA).
3. لا يُنشأ أمر إذا `confidence < minConfidence`.
4. لا يُنشأ أمر إذا `riskLevel = HIGH`.
5. لا يُنشأ أمر إذا تم بلوغ `dailyLossLimit`.
6. لا يُنشأ أمر إذا `auto_trading_disabled` أو الأصل خارج قائمة `allowedAssets`.

أسباب الرفض موحّدة في `REJECT_REASONS_AR` وتظهر في السجل + toasts.

### حالة System Status بعد هذه المرحلة

- AI Decision Testing: **Active**
- Safety Rules: **Active**
- Paper Trading: **Simulation Only**

---

## Functional Integration Audit (Final MVP Wiring)

تم في هذه المرحلة ربط اللوحات وتجهيز النظام للإنتاج لاحقاً دون أي ربط حقيقي.

### اللوحات المربوطة وظيفياً

| اللوحة | المصدر | الإجراء |
|--------|--------|---------|
| WatchlistPanel | watchlistStore + generateTradingDecision | تحليل الآن / إضافة للمحفظة / إزالة |
| SmartAlertsPanel | قرارات AI + Watchlist | مراقبة / تجاهل |
| PortfolioRiskDashboard | computePortfolioRisk(mock positions) | عرض تركّز/تنويع/توصيات |
| BacktestingPanel | backtesting.ts (mock-deterministic) | اختيار استراتيجية + تصدير |
| TradingJournalPanel | tradingJournal store | فلتر + إضافة + تصدير CSV |
| AutoTradingModeBar | autoTrading store | تفعيل/إيقاف/إيقاف طارئ + دورة محاكاة + تقرير |
| AIDecisionPanel + Tester | marketIntelligence | اختبار قرارات + توضيح Score |
| RiskManagementPanel | assetPnl mock + AI | SL/TP محاكاة |
| WithdrawalSection | localStorage | طلبات مراجعة |
| AdminReviewPanel | mock pending list | اعتماد/رفض |
| PaymentLinksSettings | localStorage placeholders | روابط Stripe (placeholder) |
| CryptoLivePanel | CoinGecko | Live polling |
| SystemReadinessPanel | aggregator | System Check + MVP Score + Data Source Manager + Export Report |

### Unified Data Status Badges (`DataStatusBadge`)
`Live` · `Mock` · `Simulation` · `Manual Review` · `Not Connected` · `Ready Later`
يُستخدم في الأسواق، المحفظة، AI، الإعدادات، Watchlist.

### Auto Trading Modes (محدّث)
- **Conservative**: minConfidence=85, maxRisk=LOW, position≤5%, allowMockSimulation=false
- **Balanced**:     minConfidence=75, maxRisk=MEDIUM, position≤10%, allowMockSimulation=true
- **Aggressive**:   minConfidence=65, maxRisk=MEDIUM, position≤15%, allowMockSimulation=true
- HIGH risk لا يُنشئ أمراً أبداً في كل الأوضاع.

### Emergency Stop
زر `E-Stop` داخل AutoTradingModeBar → يستدعي `emergencyStop()` → يوقف autoTrading ويسجل `haltedAt`.

### System Check + MVP Readiness Score
يُحسب من 12 فحصاً: Crypto, Stocks, AI engine, Simulation, Watchlist, Portfolio, Payments, Deposit/Withdrawal, Admin, Docs, Journal, Safety.
الصيغة: نقاط = Σ(ok ? (warn ? 0.65 : 1) : 0) / N × 100.

### Export System Report
زر داخل SystemReadinessPanel يصدّر JSON يشمل: MVP score, system checks, data sources, autoTrading state, watchlist count, portfolio risk, journal count, gaps.

### Data Source Manager (Admin only)
يعرض حالة كل مزود (CoinGecko=Live, AI=Mock, Stocks/Brokers/Payments=Not Connected) مع حقول placeholder للمفاتيح **لا تُحفظ** — مع تنبيه أن المفاتيح يجب أن تعيش في Backend آمن لاحقاً.

### Status Map
- **Live**: CoinGecko
- **Mock**: بيانات الأسهم، AI، News, Macro
- **Simulation**: كل أوامر التداول، Backtesting
- **Manual Review**: الإيداع والسحب
- **Not Connected**: Stripe, Broker API, Alpha Vantage, Twelve Data, Finnhub, Saudi Provider, News API
- **Ready Later**: المزايا التي تحتاج Backend مخصصاً

### يحتاج لاحقاً
- مزود دفع (Stripe lookup keys → server functions).
- مزود أسواق للأسهم (Twelve Data/Alpha Vantage/Finnhub) عبر server functions.
- مزود أخبار + معنويات حقيقي.
- وسيط تداول (IB/Alpaca) — لا يُربط من الواجهة أبداً.
- Backend آمن لتخزين مفاتيح API (Lovable Cloud secrets).

---

## Final Operational MVP

### Deposit / Withdrawal Timeline
- أرقام مرجعية: `DEP-YYYY-####` و `WDR-YYYY-####`.
- خط زمني مرئي: تم الإنشاء → قيد المراجعة → اعتُمد/رُفض → مكتمل.
- أزرار: نسخ الرقم، إلغاء (إن كان قيد المراجعة).
- تنبيه ثابت: "الإيداع والسحب يتمان بالمراجعة اليدوية حالياً ولا يوجد تحويل بنكي آلي."
- كل عملية تُسجَّل في الدفتر الموحد عبر `logEvent({ source: "deposit" | "withdrawal" })`.

### Trading Journal Event Aggregation
- `JournalEntry` موسّعة بحقول: `source`, `status`, `eventKind`, `refId`, `confidence`, `riskLevel`, `amount`.
- المصادر: `ai`, `auto_trading`, `watchlist`, `portfolio`, `deposit`, `withdrawal`, `backtest`, `system`, `admin`.
- مولّدات أحداث تلقائية: تشغيل دورة محاكاة، إيقاف طارئ، تغيير وضع، فحص النظام، إجراءات الإدارة، إنشاء/إلغاء طلبات الإيداع، تحليل أصل من Watchlist.
- فلاتر اللوحة: مصدر + حالة + win/lose + مسح الفلاتر + تصدير CSV + Empty State مع زر إنشاء حدث تجريبي.

### Admin Operational Console
- ملخصات: إجمالي إيداعات/سحوبات، معلقة/مكتملة/مرفوضة.
- حالة النظام مع DataStatusBadge: CoinGecko / الأسهم / AI / Auto Trading / الدفع / السحب البنكي.
- جداول قابلة للتمرير الأفقي: إيداعات، سحوبات، اشتراكات، دعوات.
- إجراءات (اعتماد/رفض/مراجعة/تفاصيل) تُحدّث الحالة محلياً + toast + تسجيل في الدفتر.
- لوحات إضافية: قرارات AI عالية المخاطر + آخر أوامر المحاكاة.

### Data Consistency Layer
- `logEvent(...)` نقطة مركزية لكل الأحداث.
- التداول الآلي يدعو الدفتر تلقائياً عند: enable/disable/E-Stop/mode_change/simulation_cycle.
- Watchlist يستدعي الدفتر عند "تحليل الآن".
- Deposit يستدعي الدفتر عند إنشاء/إلغاء طلب.
- Admin يستدعي الدفتر عند كل إجراء.

### System Final Check + MVP Readiness Score
- 12 فحصاً مرئياً مع شارات OK / Warn / Fail.
- النتيجة: 0–100 مع شريط لوني + قائمة الفجوات بعد تشغيل الفحص.

### Export Reports (Settings → Admin)
- تقرير النظام JSON
- دفتر التداول CSV
- أوامر المحاكاة CSV
- مخاطر المحفظة JSON
- (كل زر يعرض toast إذا لم تكن البيانات متاحة)

### Unified Status Badges (`DataStatusBadge`)
`Live` · `Mock` · `Simulation` · `Manual Review` · `Not Connected` · `Ready Later` — مستخدمة في Markets، Wallet، AI، Watchlist، Deposit، Settings، Admin، Data Source Manager.

### Safety Notices (ثابتة بصرياً)
- AI Analyst: "التحليل مساعد ولا يعتبر توصية مالية ملزمة."
- Auto Trading: "التداول الآلي الحالي محاكاة فقط ولا ينفذ أوامر حقيقية."
- Deposit/Withdrawal: "تخضع للمراجعة اليدوية."
- Data Source Manager: "المفاتيح يجب حفظها لاحقاً في Backend آمن."
- Backtesting: "نتائج المحاكاة لا تضمن الأداء المستقبلي."

### Status Map النهائي
- **Live**: CoinGecko (Crypto).
- **Mock**: الأسهم، الأخبار، الاقتصاد الكلي، AI engine.
- **Simulation**: Auto Trading، Backtesting، AI orders.
- **Manual Review**: Deposit، Withdrawal.
- **Not Connected**: Broker API، Bank Transfer Automation، Stripe / payment webhooks، Real AI provider، Stock Market provider، News API.

### يحتاج Backend لاحقاً
- تخزين المستخدمين والعمليات وAudit Logs.
- حفظ مفاتيح API في Lovable Cloud Secrets.
- Webhooks (Stripe/البنك).
- صلاحيات إنتاجية وUser Roles على جدول `user_roles`.
- Broker Integration (IB/Alpaca) عبر server functions فقط.
- Payment provider integration كاملة.

---

## Phase: Withdrawal Parity, Manual Review Center & Audit-ready Journal

### Withdrawal Timeline (parity with Deposit)
- Unique ref `WDR-YYYY-NNNN`, 4-step timeline (Created → Review → Approved/Rejected/Cancelled → Completed).
- Fee summary (5 SAR < 1000, 10 SAR ≥ 1000), holder + IBAN (masked), note.
- Statuses: review / completed / rejected / cancelled.
- Actions: copy ref, view details (toast modal), cancel-if-pending.
- Every action logged via `logEvent({ source: "withdrawal", actor, severity, beforeState, afterState })`.

### Manual Review Center (Admin Console)
- Unified table of Deposits + Withdrawals with filters (type / status / search).
- Approve / Reject / Reopen / Note / Details — each writes an audit entry with `before_state` and `after_state`.

### Audit-ready Trading Journal
- New fields per entry: `journalRef` (`JRN-YYYY-NNNN`), `actor` (user/admin/system/ai), `severity` (info/warning/critical), `linkedRefId`, `beforeState`, `afterState`.
- Row left-border colored by severity, badge per entry.
- Filters: source, status, actor, severity, linked ref id.
- Two exports: full Journal CSV and Admin/critical-only Audit CSV.

### Production Roadmap (Settings)
- 4 phases (Backend, Payments, Market Data, Broker) with status badge, required items, top risk and details modal.
- See `BACKEND_REQUIREMENTS.md` for the full schema, endpoints, security and migration path.

### Enhanced System Report
- JSON export now includes Manual Review Summary, Audit Journal Summary, Auto Trading Simulation Summary, Data Source Status, Payment Placeholder Status, AI Engine Status and Production Roadmap.
- New companion CSV summary export.

### Current Status
- Frontend MVP: Advanced
- Crypto Data: Live (CoinGecko) with Mock fallback
- Stocks: Mock
- AI: Mock Engine
- Auto Trading: Simulation Only (STOP_LOSS priority, HIGH risk blocked)
- Deposit / Withdrawal: Manual Review
- Broker: Not Connected
- Payment: Not Connected
- Backend: Not Connected (see `BACKEND_REQUIREMENTS.md`)
