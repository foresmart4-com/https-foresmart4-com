/** Mobile alerts — delegates to browser push on mobile + vibration when available. */
import { pushBrowserNotification } from "./pushNotifications";

export function sendMobileAlert(title: string, body: string) {
  const ok = pushBrowserNotification(title, body);
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([100, 50, 100]); } catch {}
  return ok;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}
