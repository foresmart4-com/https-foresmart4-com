// Smart market alerts engine (Mock) — derives alerts from TradingDecisions
import type { TradingDecision } from "./marketIntelligence";

export type SmartAlertKind =
  | "buy_opportunity"
  | "stop_loss"
  | "high_volatility"
  | "conflict"
  | "mock_data"
  | "high_risk";

export type SmartAlert = {
  id: string;
  asset: string;
  kind: SmartAlertKind;
  severity: "info" | "warning" | "critical";
  message_ar: string;
  message_en: string;
  suggestion_ar: string;
  suggestion_en: string;
  createdAt: number;
};

export function buildSmartAlerts(decisions: TradingDecision[], dataIsMock = true): SmartAlert[] {
  const out: SmartAlert[] = [];
  const now = Date.now();
  for (const d of decisions) {
    const base = { asset: d.asset, createdAt: now };
    if (d.action === "STOP_LOSS") {
      out.push({
        ...base, id: `sa_sl_${d.asset}_${now}`, kind: "stop_loss", severity: "critical",
        message_ar: `تنبيه وقف خسارة على ${d.asset}`,
        message_en: `Stop-loss alert on ${d.asset}`,
        suggestion_ar: "راجع المركز فوراً وقلّل التعرض.",
        suggestion_en: "Review position and reduce exposure.",
      });
    }
    if (d.action === "BUY" && d.confidence >= 75) {
      out.push({
        ...base, id: `sa_buy_${d.asset}_${now}`, kind: "buy_opportunity", severity: "info",
        message_ar: `فرصة شراء محتملة على ${d.asset} (ثقة ${d.confidence}%)`,
        message_en: `Potential BUY on ${d.asset} (confidence ${d.confidence}%)`,
        suggestion_ar: "ضع وقف خسارة وأدخل بحجم محدود.",
        suggestion_en: "Set a stop-loss and use limited size.",
      });
    }
    if (d.risk.highVolatility) {
      out.push({
        ...base, id: `sa_vol_${d.asset}_${now}`, kind: "high_volatility", severity: "warning",
        message_ar: `تذبذب عالٍ على ${d.asset}`,
        message_en: `High volatility on ${d.asset}`,
        suggestion_ar: "قلّل حجم الصفقة أو انتظر استقرار التذبذب.",
        suggestion_en: "Reduce size or wait for volatility to ease.",
      });
    }
    if (d.risk.conflictingSignals) {
      out.push({
        ...base, id: `sa_conf_${d.asset}_${now}`, kind: "conflict", severity: "warning",
        message_ar: `إشارات متضاربة على ${d.asset}`,
        message_en: `Conflicting signals on ${d.asset}`,
        suggestion_ar: "تجنّب الدخول حتى وضوح الاتجاه.",
        suggestion_en: "Avoid entry until trend confirms.",
      });
    }
    if (d.riskLevel === "HIGH") {
      out.push({
        ...base, id: `sa_risk_${d.asset}_${now}`, kind: "high_risk", severity: "warning",
        message_ar: `مستوى مخاطر مرتفع على ${d.asset}`,
        message_en: `High risk on ${d.asset}`,
        suggestion_ar: "لا تفتح صفقة جديدة، فعّل وقف الخسارة.",
        suggestion_en: "Avoid new entries; enforce a stop.",
      });
    }
  }
  if (dataIsMock) {
    out.push({
      id: `sa_mock_${now}`, asset: "—", createdAt: now, kind: "mock_data", severity: "info",
      message_ar: "بعض البيانات تجريبية (Mock) — التحليل ليس على بيانات سوق حقيقية كاملة.",
      message_en: "Some data is mock — analysis is not fully on live data.",
      suggestion_ar: "استخدم النتائج للتعلم فقط، لا للتداول الحقيقي.",
      suggestion_en: "Use results for learning only, not real trading.",
    });
  }
  return out;
}
