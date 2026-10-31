import crypto from "node:crypto";
import { prisma } from "../database/prisma.js";

/** Razorpay credentials managed from Admin → Payments. Secrets are AES-256-GCM encrypted at rest. */
export const PAYMENT_SETTING_KEY = "__atelier_payment_config_v1";
export type StoredPaymentConfig = { keyId: string; keySecret: string; webhookSecret: string; enabled: boolean; updatedAt: string };
export type RazorpayCreds = { keyId: string; keySecret: string; webhookSecret: string; source: "admin" | "env" | "none"; mode: "test" | "live" | "unknown" };

function encKey(): Buffer {
  const secret = String(process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || process.env.AI_PROVIDER_ENCRYPTION_KEY || process.env.JWT_SECRET || "").trim();
  if (secret.length < 16) throw new Error("PAYMENT_ENCRYPTION_KEY_UNAVAILABLE");
  return crypto.createHash("sha256").update(`ATELIER-PAYMENT-CONFIG-V1:${secret}`).digest();
}
function seal(value: unknown) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return { version: 1, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}
function unseal(w: any): StoredPaymentConfig | null {
  if (!w || typeof w !== "object" || w.version !== 1) return null;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(w.iv, "base64"));
    d.setAuthTag(Buffer.from(w.tag, "base64"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(w.data, "base64")), d.final()]).toString("utf8"));
  } catch { console.error("Payment config could not be decrypted. Was the encryption key changed?"); return null; }
}

export const modeOf = (keyId: string): "test" | "live" | "unknown" => keyId.startsWith("rzp_test_") ? "test" : keyId.startsWith("rzp_live_") ? "live" : "unknown";
export function validateKeyId(v: string) { return /^rzp_(test|live)_[A-Za-z0-9]{6,}$/.test(v.trim()); }

export async function readStored(): Promise<StoredPaymentConfig | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: PAYMENT_SETTING_KEY } });
  return row ? unseal(row.value) : null;
}
export async function writeStored(cfg: StoredPaymentConfig) {
  const value = seal(cfg) as any;
  await prisma.siteSetting.upsert({ where: { key: PAYMENT_SETTING_KEY }, update: { value }, create: { key: PAYMENT_SETTING_KEY, value } });
  cache = null;
}
export async function clearStored() { await prisma.siteSetting.deleteMany({ where: { key: PAYMENT_SETTING_KEY } }); cache = null; }

let cache: { at: number; creds: RazorpayCreds } | null = null;
/** Admin-saved credentials win when enabled; otherwise fall back to backend/.env. */
export async function getCreds(): Promise<RazorpayCreds> {
  if (cache && Date.now() - cache.at < 5000) return cache.creds;
  let creds: RazorpayCreds = { keyId: "", keySecret: "", webhookSecret: "", source: "none", mode: "unknown" };
  const stored = await readStored().catch(() => null);
  if (stored && stored.enabled && stored.keyId && stored.keySecret) {
    creds = { keyId: stored.keyId, keySecret: stored.keySecret, webhookSecret: stored.webhookSecret || "", source: "admin", mode: modeOf(stored.keyId) };
  } else {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim(), keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    if (keyId && keySecret) creds = { keyId, keySecret, webhookSecret: String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim(), source: "env", mode: modeOf(keyId) };
  }
  cache = { at: Date.now(), creds };
  return creds;
}

export async function describeConfig() {
  const stored = await readStored().catch(() => null);
  const active = await getCreds();
  return {
    active: { source: active.source, mode: active.mode, keyId: active.keyId, ready: active.source !== "none" },
    saved: stored ? { keyId: stored.keyId, enabled: stored.enabled, keySecretSet: Boolean(stored.keySecret), keySecretHint: stored.keySecret ? `••••${stored.keySecret.slice(-4)}` : "", webhookSecretSet: Boolean(stored.webhookSecret), mode: modeOf(stored.keyId), updatedAt: stored.updatedAt } : null,
    envConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  };
}

/** Calls a cheap authenticated Razorpay endpoint to confirm the key pair is valid. */
export async function testCreds(keyId: string, keySecret: string) {
  const res = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64") } });
  const text = await res.text(); let body: any = {}; try { body = JSON.parse(text); } catch {}
  if (!res.ok) return { ok: false, status: res.status, message: body?.error?.description || `Razorpay responded with HTTP ${res.status}` };
  return { ok: true, status: res.status, message: "Razorpay accepted these credentials." };
}
