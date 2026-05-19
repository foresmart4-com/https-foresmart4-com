// Premium dark fintech HTML email templates — bilingual (AR/EN).
// Server-only string templates (no React Email dependency to keep bundle lean).

export type Lang = "ar" | "en";

const BRAND = {
  name: "ForeSmart",
  url: "https://foresmart4.com",
  support: "foresmart4@foresmart4.com",
  bg: "#06080f",
  card: "#0d1220",
  border: "#1f2937",
  text: "#e5e7eb",
  muted: "#94a3b8",
  primary: "#d4a84c",
  primaryGlow: "#f0d78c",
  success: "#10b981",
  danger: "#ef4444",
  warn: "#f59e0b",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(opts: {
  lang: Lang;
  title: string;
  preheader: string;
  accent?: string;
  badgeAr?: string;
  badgeEn?: string;
  body: string;
}): string {
  const dir = opts.lang === "ar" ? "rtl" : "ltr";
  const accent = opts.accent ?? BRAND.primary;
  const tagline = opts.lang === "ar"
    ? "منصة ذكاء اصطناعي مؤسسية للأسواق المالية"
    : "Institutional AI Intelligence for Global Markets";
  const footerLine = opts.lang === "ar"
    ? `© ${new Date().getFullYear()} ${BRAND.name} — جميع الحقوق محفوظة.`
    : `© ${new Date().getFullYear()} ${BRAND.name} — All rights reserved.`;
  const disclaimer = opts.lang === "ar"
    ? "هذا البريد للأغراض المعلوماتية فقط ولا يُعد نصيحة استثمارية. يتحمل المستخدم كامل المسؤولية عن قراراته المالية."
    : "This message is for informational purposes only and does not constitute financial advice. The user assumes full responsibility for financial decisions.";
  const legal = opts.lang === "ar"
    ? `<a href="${BRAND.url}/terms" style="color:${BRAND.muted};text-decoration:none;margin:0 8px">الشروط</a> · <a href="${BRAND.url}/privacy" style="color:${BRAND.muted};text-decoration:none;margin:0 8px">الخصوصية</a> · <a href="${BRAND.url}/refund-policy" style="color:${BRAND.muted};text-decoration:none;margin:0 8px">الاسترداد</a>`
    : `<a href="${BRAND.url}/terms" style="color:${BRAND.muted};text-decoration:none;margin:0 8px">Terms</a> · <a href="${BRAND.url}/privacy" style="color:${BRAND.muted};text-decoration:none;margin:0 8px">Privacy</a> · <a href="${BRAND.url}/refund-policy" style="color:${BRAND.muted};text-decoration:none;margin:0 8px">Refund</a>`;

  const badge = opts.badgeAr || opts.badgeEn
    ? `<div style="display:inline-block;padding:6px 14px;border:1px solid ${accent}44;background:${accent}11;color:${accent};border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:16px">${escapeHtml(opts.lang === "ar" ? (opts.badgeAr ?? "") : (opts.badgeEn ?? ""))}</div>`
    : "";

  return `<!doctype html>
<html lang="${opts.lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;color:${BRAND.text};">
<div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:32px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%">
      <tr><td style="padding:8px 4px 24px" align="${opts.lang === "ar" ? "right" : "left"}">
        <div style="display:flex;align-items:center;gap:10px;direction:${dir}">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryGlow});display:inline-block;line-height:36px;text-align:center;color:#0a0a0a;font-weight:800">F</div>
          <span style="font-size:18px;font-weight:700;color:${BRAND.text};margin:0 8px">${BRAND.name}</span>
        </div>
      </td></tr>

      <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;padding:32px 28px" align="${opts.lang === "ar" ? "right" : "left"}">
        ${badge}
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:${BRAND.text};font-weight:700">${escapeHtml(opts.title)}</h1>
        <div style="color:${BRAND.muted};font-size:15px;line-height:1.65">${opts.body}</div>
      </td></tr>

      <tr><td style="padding:18px 8px;color:${BRAND.muted};font-size:12px;line-height:1.6" align="center">
        <div style="margin-bottom:10px">${escapeHtml(tagline)}</div>
        <div style="margin-bottom:10px">${legal}</div>
        <div style="margin-bottom:6px;opacity:.8">${escapeHtml(disclaimer)}</div>
        <div style="opacity:.7">${escapeHtml(footerLine)}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function button(label: string, href: string, color = BRAND.primary): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0"><tr><td style="background:linear-gradient(135deg,${color},${BRAND.primaryGlow});border-radius:10px"><a href="${href}" style="display:inline-block;padding:12px 22px;color:#0a0a0a;font-weight:700;text-decoration:none;font-size:14px">${escapeHtml(label)}</a></td></tr></table>`;
}

function codeBox(code: string): string {
  return `<div style="margin:18px 0;padding:18px;background:#0a0e18;border:1px dashed ${BRAND.primary}55;border-radius:12px;text-align:center"><div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:10px;color:${BRAND.primary}">${escapeHtml(code)}</div></div>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:13px;font-weight:600;text-align:end">${escapeHtml(value)}</td></tr>`;
}

// ============ TEMPLATES ============

export interface RenderResult { subject: string; html: string; }

export function renderTest(lang: Lang): RenderResult {
  const t = lang === "ar"
    ? { subject: "اختبار البريد — ForeSmart", title: "تم تشغيل خدمة البريد بنجاح", body: "هذه رسالة اختبار من البنية التحتية للبريد عبر Resend. إذا وصلتك، فالنظام يعمل بشكل سليم." }
    : { subject: "Email Test — ForeSmart", title: "Email service is live", body: "This is a test message from the Resend email infrastructure. If you received it, the system is operating correctly." };
  return {
    subject: t.subject,
    html: shell({ lang, title: t.title, preheader: t.title, badgeAr: "اختبار", badgeEn: "Test", body: `<p>${escapeHtml(t.body)}</p>` }),
  };
}

export function renderOtp(lang: Lang, code: string, minutes = 10): RenderResult {
  const t = lang === "ar"
    ? { subject: "رمز التحقق — ForeSmart", title: "رمز التحقق الخاص بك", body: `استخدم الرمز أدناه لإكمال عملية التحقق. الرمز صالح لمدة <b>${minutes}</b> دقائق.`, hint: "إذا لم تطلب هذا الرمز، يرجى تجاهل الرسالة وإبلاغ الدعم فوراً." }
    : { subject: "Your Verification Code — ForeSmart", title: "Your verification code", body: `Use the code below to complete verification. This code expires in <b>${minutes}</b> minutes.`, hint: "If you didn't request this, please ignore this message and contact support." };
  return {
    subject: t.subject,
    html: shell({ lang, title: t.title, preheader: t.title, badgeAr: "تحقق آمن", badgeEn: "Secure OTP", body: `<p>${t.body}</p>${codeBox(code)}<p style="color:${BRAND.muted};font-size:13px">${escapeHtml(t.hint)}</p>` }),
  };
}

export function renderPasswordReset(lang: Lang, resetUrl: string): RenderResult {
  const t = lang === "ar"
    ? { subject: "استعادة كلمة المرور — ForeSmart", title: "إعادة تعيين كلمة المرور", body: "تلقينا طلباً لإعادة تعيين كلمة مرور حسابك. اضغط الزر أدناه لاختيار كلمة مرور جديدة.", cta: "إعادة تعيين كلمة المرور", hint: "إذا لم تطلب هذا، يمكنك تجاهل الرسالة بأمان." }
    : { subject: "Reset your password — ForeSmart", title: "Reset your password", body: "We received a request to reset your account password. Click the button below to choose a new password.", cta: "Reset password", hint: "If you didn't request this, you can safely ignore this email." };
  return {
    subject: t.subject,
    html: shell({ lang, title: t.title, preheader: t.title, badgeAr: "أمان الحساب", badgeEn: "Account Security", body: `<p>${escapeHtml(t.body)}</p>${button(t.cta, resetUrl)}<p style="color:${BRAND.muted};font-size:13px">${escapeHtml(t.hint)}</p>` }),
  };
}

export function renderAuthConfirm(lang: Lang, confirmUrl: string): RenderResult {
  const t = lang === "ar"
    ? { subject: "تأكيد البريد الإلكتروني — ForeSmart", title: "أكّد بريدك الإلكتروني", body: "مرحباً بك في ForeSmart. اضغط الزر أدناه لتأكيد بريدك الإلكتروني وبدء استخدام المنصة.", cta: "تأكيد البريد", hint: "إذا لم تنشئ هذا الحساب، يمكنك تجاهل الرسالة." }
    : { subject: "Confirm your email — ForeSmart", title: "Confirm your email", body: "Welcome to ForeSmart. Click below to confirm your email and start using the platform.", cta: "Confirm email", hint: "If you didn't create this account, you can ignore this email." };
  return {
    subject: t.subject,
    html: shell({ lang, title: t.title, preheader: t.title, badgeAr: "تفعيل الحساب", badgeEn: "Activate Account", body: `<p>${escapeHtml(t.body)}</p>${button(t.cta, confirmUrl)}<p style="color:${BRAND.muted};font-size:13px">${escapeHtml(t.hint)}</p>` }),
  };
}

export interface AiAlertPayload { symbol: string; signal: string; confidence?: number; price?: string; reason?: string; }
export function renderAiAlert(lang: Lang, p: AiAlertPayload): RenderResult {
  const t = lang === "ar"
    ? { subject: `تنبيه ذكاء اصطناعي: ${p.symbol} — ${p.signal}`, title: `إشارة ${p.symbol}`, sig: "الإشارة", conf: "درجة الثقة", price: "السعر", reason: "السبب", cta: "عرض في لوحة التحكم" }
    : { subject: `AI Alert: ${p.symbol} — ${p.signal}`, title: `${p.symbol} Signal`, sig: "Signal", conf: "Confidence", price: "Price", reason: "Reason", cta: "Open Dashboard" };
  const rows = [
    row(t.sig, p.signal),
    p.confidence !== undefined ? row(t.conf, `${Math.round(p.confidence)}%`) : "",
    p.price ? row(t.price, p.price) : "",
    p.reason ? row(t.reason, p.reason) : "",
  ].join("");
  const body = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 6px">${rows}</table>${button(t.cta, `${BRAND.url}/ai-dashboard`, BRAND.success)}`;
  return { subject: t.subject, html: shell({ lang, title: t.title, preheader: t.title, accent: BRAND.success, badgeAr: "تنبيه ذكاء اصطناعي", badgeEn: "AI Alert", body }) };
}

export interface RiskAlertPayload { severity: "info" | "warning" | "critical"; message: string; metric?: string; value?: string; }
export function renderRiskAlert(lang: Lang, p: RiskAlertPayload): RenderResult {
  const color = p.severity === "critical" ? BRAND.danger : p.severity === "warning" ? BRAND.warn : BRAND.primary;
  const t = lang === "ar"
    ? { subject: `تنبيه مخاطر [${p.severity}] — ForeSmart`, title: "تنبيه إدارة المخاطر", sev: "الخطورة", metric: "المؤشر", value: "القيمة", cta: "مراجعة المخاطر" }
    : { subject: `Risk Alert [${p.severity}] — ForeSmart`, title: "Risk Management Alert", sev: "Severity", metric: "Metric", value: "Value", cta: "Review Risk" };
  const rows = [
    row(t.sev, p.severity.toUpperCase()),
    p.metric ? row(t.metric, p.metric) : "",
    p.value ? row(t.value, p.value) : "",
  ].join("");
  const body = `<p>${escapeHtml(p.message)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0">${rows}</table>${button(t.cta, `${BRAND.url}/ai-dashboard`, color)}`;
  return { subject: t.subject, html: shell({ lang, title: t.title, preheader: p.message, accent: color, badgeAr: "إدارة مخاطر", badgeEn: "Risk Engine", body }) };
}

export interface SubscriptionPayload { event: "trial_started" | "renewed" | "canceled" | "past_due" | "upgraded"; planName: string; endsAt?: string; }
export function renderSubscriptionNotice(lang: Lang, p: SubscriptionPayload): RenderResult {
  const eventLabel: Record<SubscriptionPayload["event"], { ar: string; en: string }> = {
    trial_started: { ar: "بدء التجربة المجانية", en: "Free trial started" },
    renewed: { ar: "تم تجديد الاشتراك", en: "Subscription renewed" },
    canceled: { ar: "تم إلغاء الاشتراك", en: "Subscription canceled" },
    past_due: { ar: "تأخر في الدفع", en: "Payment past due" },
    upgraded: { ar: "تمت ترقية الخطة", en: "Plan upgraded" },
  };
  const lbl = eventLabel[p.event][lang];
  const t = lang === "ar"
    ? { subject: `${lbl} — ${p.planName}`, plan: "الخطة", ends: "تاريخ الانتهاء", cta: "إدارة الاشتراك" }
    : { subject: `${lbl} — ${p.planName}`, plan: "Plan", ends: "Next billing / Ends", cta: "Manage Subscription" };
  const rows = [row(t.plan, p.planName), p.endsAt ? row(t.ends, p.endsAt) : ""].join("");
  const body = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0">${rows}</table>${button(t.cta, `${BRAND.url}/subscription`)}`;
  return { subject: t.subject, html: shell({ lang, title: lbl, preheader: lbl, badgeAr: "الفوترة", badgeEn: "Billing", body }) };
}

export interface SecurityNoticePayload { event: string; ip?: string; device?: string; location?: string; at?: string; }
export function renderSecurityNotice(lang: Lang, p: SecurityNoticePayload): RenderResult {
  const t = lang === "ar"
    ? { subject: `إشعار أمني — ${p.event}`, title: "إشعار أمني على حسابك", ip: "IP", device: "الجهاز", loc: "الموقع", at: "الوقت", cta: "مراجعة النشاط", hint: "إذا لم تكن أنت، غيّر كلمة المرور فوراً وفعّل التحقق الثنائي." }
    : { subject: `Security Notice — ${p.event}`, title: "Security notice on your account", ip: "IP", device: "Device", loc: "Location", at: "Time", cta: "Review Activity", hint: "If this wasn't you, change your password immediately and enable 2FA." };
  const rows = [
    p.ip ? row(t.ip, p.ip) : "",
    p.device ? row(t.device, p.device) : "",
    p.location ? row(t.loc, p.location) : "",
    p.at ? row(t.at, p.at) : "",
  ].join("");
  const body = `<p>${escapeHtml(p.event)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0">${rows}</table>${button(t.cta, `${BRAND.url}/settings`, BRAND.warn)}<p style="color:${BRAND.muted};font-size:13px">${escapeHtml(t.hint)}</p>`;
  return { subject: t.subject, html: shell({ lang, title: t.title, preheader: p.event, accent: BRAND.warn, badgeAr: "أمان", badgeEn: "Security", body }) };
}

export interface InvitationPayload {
  inviteUrl: string;
  inviterName?: string;
  personalMessage?: string;
  expiresInDays?: number;
}
export function renderInvitation(lang: Lang, p: InvitationPayload): RenderResult {
  const days = p.expiresInDays ?? 7;
  const t = lang === "ar"
    ? {
        subject: `دعوة للانضمام إلى ForeSmart`,
        title: p.inviterName ? `${p.inviterName} يدعوك للانضمام إلى ForeSmart` : "دعوة للانضمام إلى ForeSmart",
        intro: "تمت دعوتك للوصول إلى منصة ForeSmart — منصة ذكاء اصطناعي مؤسسية للأسواق المالية. اضغط الزر أدناه لتفعيل حسابك.",
        cta: "تفعيل الدعوة",
        valid: `الرابط صالح لمدة ${days} أيام.`,
        msgLabel: "رسالة شخصية",
        fallback: "إذا لم يعمل الزر، انسخ هذا الرابط في متصفحك:",
      }
    : {
        subject: `You're invited to ForeSmart`,
        title: p.inviterName ? `${p.inviterName} invited you to ForeSmart` : "You're invited to ForeSmart",
        intro: "You've been invited to ForeSmart — an institutional AI intelligence platform for global markets. Click below to activate your account.",
        cta: "Accept Invitation",
        valid: `This link is valid for ${days} days.`,
        msgLabel: "Personal message",
        fallback: "If the button doesn't work, copy this link into your browser:",
      };
  const personal = p.personalMessage
    ? `<div style="margin:18px 0;padding:14px 16px;background:#0a0e18;border-${lang === "ar" ? "right" : "left"}:3px solid ${BRAND.primary};border-radius:8px"><div style="color:${BRAND.muted};font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${escapeHtml(t.msgLabel)}</div><div style="color:${BRAND.text};font-size:14px;line-height:1.6">${escapeHtml(p.personalMessage)}</div></div>`
    : "";
  const body = `<p>${escapeHtml(t.intro)}</p>${personal}${button(t.cta, p.inviteUrl)}<p style="color:${BRAND.muted};font-size:12px">${escapeHtml(t.valid)}</p><p style="color:${BRAND.muted};font-size:12px;word-break:break-all">${escapeHtml(t.fallback)}<br/><a href="${p.inviteUrl}" style="color:${BRAND.primary};text-decoration:none">${escapeHtml(p.inviteUrl)}</a></p>`;
  return { subject: t.subject, html: shell({ lang, title: t.title, preheader: t.intro, badgeAr: "دعوة", badgeEn: "Invitation", body }) };
}

// ============ Welcome + Trial + Billing + Notification ============

export interface WelcomePayload { name?: string; dashboardUrl?: string; }
export function renderWelcome(lang: Lang, p: WelcomePayload = {}): RenderResult {
  const url = p.dashboardUrl ?? `${BRAND.url}/ai-dashboard`;
  const t = lang === "ar"
    ? { subject: `أهلاً بك في ${BRAND.name}`, title: p.name ? `أهلاً ${p.name}` : `أهلاً بك في ${BRAND.name}`, body: "تم تفعيل حسابك بنجاح. ابدأ الآن باستكشاف لوحات الذكاء الاصطناعي ومراقبة الأسواق على مدار الساعة.", cta: "الانتقال إلى لوحة التحكم" }
    : { subject: `Welcome to ${BRAND.name}`, title: p.name ? `Welcome, ${p.name}` : `Welcome to ${BRAND.name}`, body: "Your account is ready. Start exploring AI intelligence dashboards and 24/7 market monitoring.", cta: "Open Dashboard" };
  return { subject: t.subject, html: shell({ lang, title: t.title, preheader: t.title, badgeAr: "مرحباً", badgeEn: "Welcome", body: `<p>${escapeHtml(t.body)}</p>${button(t.cta, url)}` }) };
}

export interface TrialPayload { event: "started" | "ending_soon" | "ended"; endsAt?: string; daysLeft?: number; }
export function renderTrial(lang: Lang, p: TrialPayload): RenderResult {
  const map: Record<TrialPayload["event"], { ar: string; en: string }> = {
    started: { ar: "بدأت تجربتك المجانية", en: "Your free trial has started" },
    ending_soon: { ar: "تجربتك المجانية على وشك الانتهاء", en: "Your free trial is ending soon" },
    ended: { ar: "انتهت تجربتك المجانية", en: "Your free trial has ended" },
  };
  const label = map[p.event][lang];
  const t = lang === "ar"
    ? { subject: label, days: "الأيام المتبقية", ends: "تاريخ الانتهاء", cta: "إدارة الاشتراك", body: p.event === "ended" ? "للاستمرار في الوصول إلى الذكاء المؤسسي، قم بترقية اشتراكك الآن." : "استفد من تجربتك المجانية واستكشف جميع لوحات التحليل المتقدمة." }
    : { subject: label, days: "Days remaining", ends: "Ends at", cta: "Manage Subscription", body: p.event === "ended" ? "To continue accessing institutional intelligence, upgrade your subscription now." : "Make the most of your free trial — explore every advanced analytics panel." };
  const rows = [
    p.daysLeft !== undefined ? row(t.days, String(p.daysLeft)) : "",
    p.endsAt ? row(t.ends, p.endsAt) : "",
  ].join("");
  const body = `<p>${escapeHtml(t.body)}</p>${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0">${rows}</table>` : ""}${button(t.cta, `${BRAND.url}/subscription`)}`;
  return { subject: t.subject, html: shell({ lang, title: label, preheader: label, badgeAr: "تجربة مجانية", badgeEn: "Free Trial", body }) };
}

export interface NotificationPayload { title: string; message: string; ctaLabel?: string; ctaUrl?: string; }
export function renderNotification(lang: Lang, p: NotificationPayload): RenderResult {
  const body = `<p>${escapeHtml(p.message)}</p>${p.ctaLabel && p.ctaUrl ? button(p.ctaLabel, p.ctaUrl) : ""}`;
  return { subject: p.title, html: shell({ lang, title: p.title, preheader: p.message.slice(0, 120), badgeAr: "إشعار", badgeEn: "Notification", body }) };
}

// Plain text fallback (improves deliverability and supports text-only readers)
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, 4000);
}
