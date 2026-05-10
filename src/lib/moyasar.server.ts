// Moyasar API helpers (server-only)
// Docs: https://docs.moyasar.com/

const MOYASAR_BASE = "https://api.moyasar.com/v1";

export interface CreatePaymentInput {
  amountSar: number;        // amount in SAR (we convert to halalas)
  description: string;
  callbackUrl: string;
  metadata: Record<string, any>;
  source: any;              // { type: "creditcard"|"applepay"|..., ... } - usually filled by Moyasar.js on client
}

export interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  fee: number;
  currency: string;
  source: { type: string; company?: string; name?: string };
  metadata: Record<string, any>;
  created_at: string;
}

function getAuthHeader() {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) throw new Error("MOYASAR_SECRET_KEY not configured. Add it after creating your Moyasar account.");
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export async function fetchPayment(paymentId: string): Promise<MoyasarPayment> {
  const res = await fetch(`${MOYASAR_BASE}/payments/${paymentId}`, {
    headers: { Authorization: getAuthHeader() },
  });
  if (!res.ok) throw new Error(`Moyasar fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Compute fees breakdown for a top-up.
// Moyasar standard: 2.75% + 1 SAR per transaction (for cards). mada is 1% + 1 SAR.
// Site fee: 0.15% on top-up (only collected for the platform).
export function computeTopupFees(amountSar: number, isMada = false) {
  const moyasarFee = isMada
    ? +(amountSar * 0.01 + 1).toFixed(2)
    : +(amountSar * 0.0275 + 1).toFixed(2);
  const serviceFee = +(amountSar * 0.0015).toFixed(2);
  const netCredit = +(amountSar - moyasarFee - serviceFee).toFixed(2);
  return { moyasarFee, serviceFee, netCredit };
}
