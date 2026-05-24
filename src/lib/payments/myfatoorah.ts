type MyFatoorahMode = "test" | "live";
export type MyFatoorahPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export const MYFATOORAH_STATUS_LABELS_AR: Record<MyFatoorahPaymentStatus, string> = {
  pending: "قيد الانتظار",
  paid: "مدفوع",
  failed: "فشل",
  cancelled: "ملغي",
};

export const MYFATOORAH_COMPANY_FLAGS = {
  companyOnly: true,
  publicPayments: false,
  liveTrading: false,
} as const;

interface MyFatoorahConfig {
  configured: boolean;
  apiToken: string | null;
  baseUrl: string;
  mode: MyFatoorahMode;
}

interface CreatePaymentInput {
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  customerReference?: string;
  paymentMethodId?: number;
  callbackUrl?: string;
  errorUrl?: string;
  invoiceItems?: Array<{ ItemName: string; Quantity: number; UnitPrice: number }>;
}

export interface MyFatoorahTransaction {
  id: string;
  invoiceId: string | null;
  paymentId: string | null;
  customerReference: string;
  amount: number;
  currency: string;
  status: MyFatoorahPaymentStatus;
  statusAr: string;
  paymentUrl: string | null;
  rawStatus: string | null;
  createdAt: string;
  updatedAt: string;
  companyOnly: true;
  publicPayments: false;
  liveTrading: false;
}

const transactions = new Map<string, MyFatoorahTransaction>();

function nowIso() {
  return new Date().toISOString();
}

function readConfig(): MyFatoorahConfig {
  const mode = (process.env.MYFATOORAH_MODE?.toLowerCase() === "live" ? "live" : "test") as MyFatoorahMode;
  const fallbackBaseUrl = mode === "live"
    ? "https://api.myfatoorah.com"
    : "https://apitest.myfatoorah.com";
  const baseUrl = (process.env.MYFATOORAH_BASE_URL || fallbackBaseUrl).replace(/\/+$/, "");
  const apiToken = process.env.MYFATOORAH_API_TOKEN?.trim() || null;
  return { configured: Boolean(apiToken), apiToken, baseUrl, mode };
}

function statusFromMyFatoorah(raw: unknown): MyFatoorahPaymentStatus {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("paid") || value.includes("success")) return "paid";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("fail") || value.includes("expire") || value.includes("error")) return "failed";
  return "pending";
}

function publicTransaction(tx: MyFatoorahTransaction) {
  return {
    ...tx,
    statusAr: MYFATOORAH_STATUS_LABELS_AR[tx.status],
    ...MYFATOORAH_COMPANY_FLAGS,
  };
}

async function callMyFatoorah<T>(path: string, body: unknown): Promise<T> {
  const config = readConfig();
  if (!config.apiToken) {
    throw new Error("MYFATOORAH_API_TOKEN is not configured");
  }

  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`MyFatoorah request failed with HTTP ${res.status}`);
  }

  return payload as T;
}

function txKey(tx: Pick<MyFatoorahTransaction, "id" | "invoiceId" | "paymentId" | "customerReference">): string {
  return tx.paymentId || tx.invoiceId || tx.customerReference || tx.id;
}

function saveTransaction(tx: MyFatoorahTransaction) {
  transactions.set(tx.id, tx);
  transactions.set(txKey(tx), tx);
  if (tx.invoiceId) transactions.set(tx.invoiceId, tx);
  if (tx.paymentId) transactions.set(tx.paymentId, tx);
  return publicTransaction(tx);
}

export function getMyFatoorahRuntimeStatus() {
  const config = readConfig();

  return {
    provider: "myfatoorah",
    configured: config.configured,
    mode: process.env.MYFATOORAH_MODE ?? config.mode,
    baseUrl: process.env.MYFATOORAH_BASE_URL ?? config.baseUrl,
    secretsExposed: false,
    companyOnly: true,
    publicPayments: false,
  };
}

export async function createMyFatoorahPayment(request: Request) {
  const origin = new URL(request.url).origin;
  const input = await request.json().catch(() => ({})) as Partial<CreatePaymentInput>;
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      error: "amount must be a positive number",
      ...MYFATOORAH_COMPANY_FLAGS,
    };
  }

  const currency = (input.currency || "SAR").toUpperCase();
  const customerReference = input.customerReference || `foresmart4-${Date.now()}`;
  const callbackUrl = input.callbackUrl || `${origin}/api/payments/myfatoorah/webhook`;
  const errorUrl = input.errorUrl || `${origin}/api/payments/myfatoorah/webhook`;

  type ExecutePaymentResponse = {
    IsSuccess?: boolean;
    Message?: string;
    Data?: {
      InvoiceId?: number | string;
      PaymentURL?: string;
      CustomerReference?: string;
    };
  };

  try {
    const payload = {
      PaymentMethodId: input.paymentMethodId ?? 2,
      CustomerName: input.customerName || "ForeSmart4 Company",
      CustomerEmail: input.customerEmail || "billing@foresmart4.com",
      CustomerMobile: input.customerMobile || "500000000",
      CustomerReference: customerReference,
      DisplayCurrencyIso: currency,
      InvoiceValue: amount,
      CallBackUrl: callbackUrl,
      ErrorUrl: errorUrl,
      Language: "ar",
      UserDefinedField: JSON.stringify(MYFATOORAH_COMPANY_FLAGS),
      InvoiceItems: input.invoiceItems?.length
        ? input.invoiceItems
        : [{ ItemName: "ForeSmart4 internal company payment", Quantity: 1, UnitPrice: amount }],
    };

    const result = await callMyFatoorah<ExecutePaymentResponse>("/v2/ExecutePayment", payload);
    const invoiceId = result.Data?.InvoiceId != null ? String(result.Data.InvoiceId) : null;
    const paymentUrl = result.Data?.PaymentURL ?? null;
    const at = nowIso();
    const tx: MyFatoorahTransaction = {
      id: `mf-${invoiceId || customerReference}`,
      invoiceId,
      paymentId: null,
      customerReference,
      amount,
      currency,
      status: "pending",
      statusAr: MYFATOORAH_STATUS_LABELS_AR.pending,
      paymentUrl,
      rawStatus: result.IsSuccess === false ? result.Message ?? "ExecutePayment failed" : "pending",
      createdAt: at,
      updatedAt: at,
      ...MYFATOORAH_COMPANY_FLAGS,
    };

    return {
      success: Boolean(paymentUrl),
      PaymentURL: paymentUrl,
      transaction: saveTransaction(tx),
      ...MYFATOORAH_COMPANY_FLAGS,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "MyFatoorah ExecutePayment failed",
      ...MYFATOORAH_COMPANY_FLAGS,
    };
  }
}

export async function verifyMyFatoorahPayment(key: string, keyType: "PaymentId" | "InvoiceId" = "PaymentId") {
  type PaymentStatusResponse = {
    IsSuccess?: boolean;
    Data?: {
      InvoiceId?: number | string;
      InvoiceStatus?: string;
      CustomerReference?: string;
      InvoiceValue?: number;
      InvoiceDisplayValue?: string;
      InvoiceTransactions?: Array<{ PaymentId?: string; TransactionStatus?: string; Error?: string }>;
    };
  };

  const result = await callMyFatoorah<PaymentStatusResponse>("/v2/GetPaymentStatus", { Key: key, KeyType: keyType });
  const rawStatus = result.Data?.InvoiceStatus
    || result.Data?.InvoiceTransactions?.[0]?.TransactionStatus
    || "pending";
  const status = statusFromMyFatoorah(rawStatus);
  const invoiceId = result.Data?.InvoiceId != null ? String(result.Data.InvoiceId) : keyType === "InvoiceId" ? key : null;
  const paymentId = result.Data?.InvoiceTransactions?.[0]?.PaymentId || (keyType === "PaymentId" ? key : null);
  const customerReference = result.Data?.CustomerReference || `foresmart4-${invoiceId || paymentId || Date.now()}`;
  const existing = transactions.get(paymentId || invoiceId || customerReference);
  const at = nowIso();
  const tx: MyFatoorahTransaction = {
    id: existing?.id || `mf-${invoiceId || paymentId || customerReference}`,
    invoiceId,
    paymentId,
    customerReference,
    amount: existing?.amount || Number(result.Data?.InvoiceValue ?? 0),
    currency: existing?.currency || "SAR",
    status,
    statusAr: MYFATOORAH_STATUS_LABELS_AR[status],
    paymentUrl: existing?.paymentUrl || null,
    rawStatus: String(rawStatus),
    createdAt: existing?.createdAt || at,
    updatedAt: at,
    ...MYFATOORAH_COMPANY_FLAGS,
  };

  return {
    success: result.IsSuccess !== false,
    transaction: saveTransaction(tx),
    ...MYFATOORAH_COMPANY_FLAGS,
  };
}

export async function handleMyFatoorahWebhook(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const paymentId = String(body.PaymentId || body.paymentId || url.searchParams.get("paymentId") || url.searchParams.get("paymentId") || "");
  const invoiceId = String(body.InvoiceId || body.invoiceId || url.searchParams.get("invoiceId") || url.searchParams.get("Id") || "");
  const key = paymentId || invoiceId;

  if (!key) {
    return {
      success: false,
      error: "Missing paymentId or invoiceId",
      ...MYFATOORAH_COMPANY_FLAGS,
    };
  }

  try {
    return await verifyMyFatoorahPayment(key, paymentId ? "PaymentId" : "InvoiceId");
  } catch (error) {
    const at = nowIso();
    const status = statusFromMyFatoorah(body.InvoiceStatus || body.status || url.searchParams.get("status"));
    const tx: MyFatoorahTransaction = {
      id: `mf-${invoiceId || paymentId}`,
      invoiceId: invoiceId || null,
      paymentId: paymentId || null,
      customerReference: String(body.CustomerReference || `foresmart4-${invoiceId || paymentId}`),
      amount: Number(body.InvoiceValue ?? 0),
      currency: String(body.Currency || "SAR"),
      status,
      statusAr: MYFATOORAH_STATUS_LABELS_AR[status],
      paymentUrl: null,
      rawStatus: error instanceof Error ? error.message : "webhook verification failed",
      createdAt: at,
      updatedAt: at,
      ...MYFATOORAH_COMPANY_FLAGS,
    };

    return {
      success: false,
      transaction: saveTransaction(tx),
      ...MYFATOORAH_COMPANY_FLAGS,
    };
  }
}
