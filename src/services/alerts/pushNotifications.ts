/** Browser Push Notifications — client-side wrapper around Notification API. */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

export function pushBrowserNotification(title: string, body: string, opts?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try { new Notification(title, { body, icon: "/favicon.ico", ...opts }); return true; }
  catch { return false; }
}
