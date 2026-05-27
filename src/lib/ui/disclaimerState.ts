const STORAGE_KEY = "foresmart_disclaimer_ack_v4";
const VERSION = "v4";

interface DisclaimerAck {
  acknowledged: true;
  userId: string | null;
  acknowledgedAt: string;
  version: string;
}

function getKey(userId?: string): string {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

export function isDisclaimerAcknowledged(userId?: string): boolean {
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === "true") return true;
    if (localStorage.getItem(STORAGE_KEY) === "true") return true;
    if (userId && localStorage.getItem(getKey(userId)) === "true") return true;

    const raw = localStorage.getItem(STORAGE_KEY + "_data");
    if (raw) {
      const data = JSON.parse(raw) as DisclaimerAck;
      if (data.acknowledged && data.version === VERSION) return true;
    }
    if (userId) {
      const rawUser = localStorage.getItem(getKey(userId) + "_data");
      if (rawUser) {
        const data = JSON.parse(rawUser) as DisclaimerAck;
        if (data.acknowledged && data.version === VERSION) return true;
      }
    }
  } catch {}
  return false;
}

export function acknowledgeDisclaimer(userId?: string): void {
  const now = new Date().toISOString();
  const data: DisclaimerAck = {
    acknowledged: true,
    userId: userId ?? null,
    acknowledgedAt: now,
    version: VERSION,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(STORAGE_KEY + "_data", JSON.stringify(data));
    if (userId) {
      localStorage.setItem(getKey(userId), "true");
      localStorage.setItem(getKey(userId) + "_data", JSON.stringify(data));
    }
  } catch {}
}

export const DISCLAIMER_STORAGE_KEYS = [
  STORAGE_KEY,
  `${STORAGE_KEY}:<userId>`,
];
