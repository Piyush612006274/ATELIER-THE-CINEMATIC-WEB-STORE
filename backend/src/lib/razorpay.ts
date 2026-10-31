import crypto from "node:crypto";

import { getCreds } from "../admin/paymentConfig.js";
const base = "https://api.razorpay.com/v1";

export async function razorpayEnabled() { const c = await getCreds(); return c.source !== "none"; }

async function authHeader() {
  const { keyId, keySecret } = await getCreds();
  if (!keyId || !keySecret) throw new Error("PAYMENT_NOT_CONFIGURED");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: { Authorization: await authHeader(), "Content-Type": "application/json", ...(init.headers ?? {}) }
  });
  const text = await response.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body?.error?.description || body?.error?.reason || `Razorpay ${response.status}`);
  return body;
}

export async function createOrder(amount: number, receipt: string, notes: Record<string,string>) {
  return call("/orders", { method: "POST", body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt, notes }) });
}

export async function createQr(amount: number, receipt: string, expiresAt: Date) {
  return call("/payments/qr_codes", { method: "POST", body: JSON.stringify({
    type: "upi_qr",
    name: `ATELIER ${receipt}`,
    usage: "single_use",
    fixed_amount: true,
    payment_amount: amount * 100,
    description: `ATELIER order ${receipt}`,
    close_by: Math.floor(expiresAt.getTime() / 1000),
    notes: { receipt }
  }) });
}

export async function fetchQrPayments(qrId: string, createdAfter: Date) {
  const from = Math.floor(createdAfter.getTime() / 1000);
  return call(`/payments/qr_codes/${encodeURIComponent(qrId)}/payments?from=${from}&to=${Math.floor(Date.now()/1000)}&count=100`);
}

export async function fetchPayment(paymentId: string) {
  return call(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function capturePayment(paymentId: string, amount: number) {
  return call(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR" })
  });
}

export async function verifySignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = await getCreds();
  if (!keySecret) throw new Error("PAYMENT_NOT_CONFIGURED");
  const digest = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (signature.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function verifyWebhookSignature(raw: Buffer, signature?: string) {
  const webhookSecret = (await getCreds()).webhookSecret;
  if (!webhookSecret || !signature) return false;
  const digest = crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");
  if (signature.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function publicKey() { const c = await getCreds(); return c.keyId || null; }


/** Idempotent full-refund helper: consults the provider's refunded amount before creating a refund. */
export async function refundPayment(paymentId: string, expected?: { amountMinor?: number; currency?: string }) {
  const payment = await fetchPayment(paymentId);
  const amount = Number(payment.amount);
  const alreadyRefunded = Number(payment.amount_refunded ?? 0);
  if (expected?.amountMinor !== undefined && amount !== expected.amountMinor) throw new Error("RAZORPAY_REFUND_PAYMENT_AMOUNT_MISMATCH");
  if (expected?.currency && String(payment.currency).toUpperCase() !== expected.currency.toUpperCase()) throw new Error("RAZORPAY_REFUND_PAYMENT_CURRENCY_MISMATCH");
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(alreadyRefunded) || alreadyRefunded < 0 || alreadyRefunded > amount) {
    throw new Error("RAZORPAY_REFUND_AMOUNT_INVALID");
  }
  if (alreadyRefunded >= amount || payment.status === "refunded") {
    return { alreadyRefunded: true, paymentId, amount: alreadyRefunded, currency: payment.currency };
  }
  if (payment.status !== "captured") throw new Error("RAZORPAY_PAYMENT_NOT_REFUNDABLE");
  const remaining = amount - alreadyRefunded;
  const refund = await call(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount: remaining, notes: { source: "ATELIER_ADMIN_ORDER_REFUND" } })
  });
  return { alreadyRefunded: false, ...refund };
}
