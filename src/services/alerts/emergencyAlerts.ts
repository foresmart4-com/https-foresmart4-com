/** Emergency alerts — escalates highest-severity events across all channels. */
import { emitAlert } from "./alertEngine";
import { pushBrowserNotification } from "./pushNotifications";
import { sendMobileAlert } from "./mobileAlerts";

export function triggerEmergency(reason: string, meta?: Record<string, unknown>) {
  const ev = emitAlert({
    title: "EMERGENCY", body: reason, severity: "critical",
    channels: ["browser","email","mobile","emergency"],
    category: "risk", meta,
  });
  try { pushBrowserNotification("EMERGENCY", reason, { tag: "emergency" }); } catch {}
  try { sendMobileAlert("EMERGENCY", reason); } catch {}
  return ev;
}
