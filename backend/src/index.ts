import "./lib/env.js";
import { requireJwtSecret, adminEmailFromEnv } from "./lib/env.js";
try { requireJwtSecret(); } catch (e) { console.error(String(e instanceof Error ? e.message : e)); }
if (!adminEmailFromEnv()) console.warn("ADMIN_EMAIL is empty — seed and EMAIL_RESERVED checks will not protect an admin identity until you set it in backend/.env");

import crypto from "node:crypto";
import path from "node:path";
import { isIP } from "node:net";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./database/prisma.js";
import { clearSession, clearAdminSession, readCustomerToken, readAdminToken, setSession, cookieName, adminCookieName } from "./lib/auth.js";
import { requireAdmin, requireAuth } from "./middleware/auth.js";
import { createOrder as razorpayCreateOrder, createQr, fetchPayment, capturePayment, fetchQrPayments, publicKey, razorpayEnabled, refundPayment, verifySignature, verifyWebhookSignature } from "./lib/razorpay.js";
import { notifyAdminOrderPaid } from "./lib/whatsapp.js";
import { issueOtp, consumeOtp } from "./lib/email.js";
import { env } from "./lib/env.js";
import { aiConfigStatus, generateAtelierChat, generateTryOn, isLocalTryOnConfigured, tryOnImageFor } from "./lib/ai.js";
import { createVirgoLiveSession } from "./lib/virgo-live.js";
import { createDevelopmentWorkspace, exportDevelopmentWorkspace, listDevelopmentWorkspaceFiles, readDevelopmentWorkspaceFile, runDevelopmentWorkspaceCommand, writeDevelopmentWorkspaceFile } from "./lib/devWorkspace.js";
import { siteSettingValueSchema } from "./lib/site-editor-settings.js";
import { generateConfiguredImage, getImageGenerationProvider, isImageGenerationConfigured, hasConfiguredImageGenerator } from "./admin/imageGeneration.js";
import { deleteAIProvider, listAIProviders, saveAIProvider, testAIProvider, activeAIProvider } from "./admin/aiProviders.js";
import { CIN_TYPES } from "./database/cinematicDefaults.js";
import { ensureCmsDefaults, resetPageToDefaults, CORE_SLUGS, cmsDefaultPages } from "./database/cmsDefaults.js";
import { canonicalImagesFor, collectionTypeFor, type CollectionType } from "./database/catalog.js";
import { factoryReset, restoreSnapshot, saveSnapshot, scheduleDailyCapture, ensureInitialSnapshot, dayKey } from "./admin/siteHistory.js";
import { DESIGN_DEFAULT_SETTINGS, DESIGN_SETTING_KEYS } from "./database/siteDefaults.js";
import { describeConfig, readStored, writeStored, clearStored, validateKeyId, testCreds, modeOf } from "./admin/paymentConfig.js";
import { WARNING_HTML, getActiveIpBlock, isInternalSecurityTokenValid, isProtectedIp, normalizeIp, detectSuspiciousSignal, recordSecuritySignal, logBlockedAccess } from "./lib/security.js";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const allowedOrigins = [process.env.WEB_ORIGIN].filter(Boolean).flatMap(v=>String(v).split(",").map(x=>x.trim()).filter(Boolean));

app.disable("x-powered-by");
const trustProxyValue = (process.env.TRUST_PROXY ?? "").trim();
// Do not trust arbitrary X-Forwarded-For values by default. Set TRUST_PROXY only
// when the API is behind a known, correctly configured reverse proxy.
app.set("trust proxy", !trustProxyValue ? false : trustProxyValue === "true" ? true : /^\d+$/.test(trustProxyValue) ? Number(trustProxyValue) : trustProxyValue);
app.use((_req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  if(process.env.NODE_ENV==="production") res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");
  next();
});
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : ["http://localhost:3000"], credentials: true }));
app.use(cookieParser());

function requestIp(req: Request): string {
  return normalizeIp(String(req.ip || req.socket.remoteAddress || ""));
}
function isInternalSecurityRoute(req: Request): boolean {
  return req.path === "/api/security/ip-status" || req.path === "/api/security/report";
}
async function flagRequest(req: Request, res: Response, reason: string, ip = requestIp(req)) {
  console.warn("Security request denied", { method: req.method, path: String(req.originalUrl || req.path).slice(0, 240), reason });
  try { await recordSecuritySignal({ ipAddress: ip, path: req.originalUrl, method: req.method, reason, userAgent: req.get("user-agent") }); }
  catch (error) { console.error("Security event could not be persisted:", error instanceof Error ? error.message : error); }
  return res.status(404).type("html").send(WARNING_HTML);
}

// Enforce temporary/permanent IP blocks before any normal API route. Localhost
// and explicit SECURITY_IP_ALLOWLIST addresses are protected from lockout.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (isInternalSecurityRoute(req) || req.path === "/api/health") return next();
  const ip = requestIp(req);
  if (!isIP(ip)) return next();
  // Loopback and configured allowlist IPs cannot be auto-blocked, but they
  // still pass through payload detection so local testing cannot bypass it.
  if (!isProtectedIp(ip)) {
    try {
      const block = await getActiveIpBlock(ip);
      if (block) {
        try { await logBlockedAccess(ip, req.originalUrl, req.method, req.get("user-agent")); }
        catch (error) { console.error("Blocked access audit failed:", error instanceof Error ? error.message : error); }
        return res.status(404).type("html").send(WARNING_HTML);
      }
    } catch (error) {
      // Fail closed if the block store cannot be checked; otherwise an outage could
      // silently bypass IP bans. The 503 is reserved for security-store unavailability.
      console.error("IP block lookup failed:", error instanceof Error ? error.message : error);
      return res.status(503).json({ error: "SECURITY_STATUS_UNAVAILABLE" });
    }
  }
  const signal = detectSuspiciousSignal(req.originalUrl, true);
  if (signal) return flagRequest(req, res, signal, ip);
  return next();
});

const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE) > 0 ? Number(process.env.RATE_LIMIT_PER_MINUTE) : 600,
  standardHeaders: true,
  legacyHeaders: false,
  // Session checks are read-only and run on every storefront boot. Keep them
  // out of the broad API bucket; requireAuth/requireAdmin still gate the data,
  // while auth mutations retain their dedicated limit.
  skip: (req) => isInternalSecurityRoute(req) || (req.method === "GET" && ["/api/auth/me", "/api/auth/admin/me"].includes(req.path)),
  // Rate limiting is an availability control, not evidence of an exploit.
  // Return a standard 429 JSON response without recording a security strike
  // or returning the misleading security-warning HTML page.
  handler: (_req, res) => res.status(429).json({ error: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please retry shortly." }),
});
app.use(apiRateLimit);
const authRateLimit = rateLimit({
  windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => { void flagRequest(req, res, "AUTH_RATE_LIMIT_EXCEEDED"); },
});

app.post("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const signature = String(req.headers["x-razorpay-signature"] ?? "");
  if (!(await verifyWebhookSignature(req.body as Buffer, signature))) return res.status(400).json({ error:"INVALID_SIGNATURE" });
  try {
    const payload = JSON.parse((req.body as Buffer).toString("utf8"));
    const entity = payload?.payload?.payment?.entity;
    if (payload?.event === "payment.captured" && entity?.id && entity?.order_id) {
      const intent = await prisma.paymentIntent.findUnique({ where:{razorpayOrderId:entity.order_id} });
      if (!intent) return res.status(202).json({ ok:true, ignored:true });
      const paidMinorAmount = Number(entity.amount);
      const paidAmount = intent.amount;
      if (!Number.isSafeInteger(paidMinorAmount) || paidMinorAmount !== intent.amount * 100 || String(entity.currency).toUpperCase() !== intent.currency.toUpperCase()) {
        console.error("Razorpay capture does not match payment intent", { intentId:intent.id, providerPaymentId:entity.id });
        return res.status(400).json({ error:"PAYMENT_INTENT_MISMATCH" });
      }
      // A late/replayed capture event must never resurrect a refunded intent/payment.
      if (intent.status === "REFUNDED") {
        console.warn("Ignoring duplicate capture event for a refunded intent", { intentId:intent.id, providerPaymentId:entity.id });
        return res.json({ ok:true, alreadyRefunded:true });
      }
      if (!paymentMeta(intent).address || paymentMeta(intent).snapshotVersion !== 1) {
        console.error("Captured payment intent is missing the immutable order snapshot", { intentId:intent.id, providerPaymentId:entity.id });
        return res.status(500).json({ error:"PAYMENT_SNAPSHOT_MISSING" });
      }
      await prisma.payment.upsert({ where:{providerId:entity.id}, update:{status:"CAPTURED",raw:entity,capturedAt:new Date()}, create:{paymentIntentId:intent.id,provider:"razorpay",providerId:entity.id,method:entity.method,amount:paidAmount,currency:entity.currency,status:"CAPTURED",raw:entity,capturedAt:new Date()} });
      await finalizePaidOrder(intent.id,{providerId:entity.id,method:entity.method,utr:entity?.acquirer_data?.rrn,raw:entity});
    }
    res.json({ ok:true });
  } catch (e) {
    console.error("Razorpay webhook processing failed; provider retry is required", e);
    res.status(500).json({ error:"WEBHOOK_PROCESSING_FAILED" });
  }
});

app.use((req,res,next)=>{
  const routeOwnedParser = (req.method === "POST" && (req.path === "/api/admin/images/upload" || req.path === "/api/ai/dev-workspace/import")) || (req.method === "PUT" && (req.path === "/api/admin/settings" || /^\/api\/ai\/dev-workspace\/[^/]+\/file$/.test(req.path)));
  if (routeOwnedParser) return next();
  // Try-on sends the customer's photo as a base64 data URL; it needs a larger,
  // explicitly bounded parser limit than the default 1 MB JSON API payload.
  if (req.method === "POST" && req.path === "/api/ai/try-on") return express.json({limit:isLocalTryOnConfigured()?"40mb":"20mb"})(req,res,next);
  if (req.method === "POST" && req.path === "/api/ai/chat") return express.json({limit:"3gb"})(req,res,next);
  if (req.method === "PUT" && /^\/api\/ai\/dev-workspace\/[^/]+\/file$/.test(req.path)) return express.json({limit:"3mb"})(req,res,next);
  if (req.method === "POST" && req.path === "/api/admin/ai/generate-image") return express.json({limit:"12mb"})(req,res,next);
  return express.json({limit:"1mb"})(req,res,next);
});
// Form-encoded bodies are another common input path; parse safely so the same
// request inspection applies regardless of JSON vs form content type.
app.use(express.urlencoded({ extended: false, limit: "1mb", parameterLimit: 1000 }));

// Inspect parsed request content as well as the URL. High-confidence indicators
// get a 404 warning page immediately; repeat signals trigger an automatic 24h ban.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (isInternalSecurityRoute(req)) return next();
  const ip = requestIp(req);
  if (!isIP(ip)) return next();
  const rawBody = req.body && typeof req.body === "object" ? JSON.stringify(req.body).slice(0, 15000) : String(req.body ?? "").slice(0, 15000);
  const signal = detectSuspiciousSignal(rawBody, false);
  if (signal) return flagRequest(req, res, signal, ip);
  return next();
});

// Record the end-of-day website design state after any admin design edit.
app.use("/api/admin", (req: Request, res: Response, next: NextFunction) => {
  if (["POST","PUT","PATCH","DELETE"].includes(req.method) && /^\/(pages|sections|settings)(\/|$)/.test(req.path)) {
    res.on("finish", () => { if (res.statusCode < 400) scheduleDailyCapture(prisma, (req as any).session?.userId ?? null); });
  }
  next();
});

const phoneSchema = z.string().trim()
  .transform(v => v.replace(/[\s\-\(\)]/g, ""))
  .refine(v => /^(?:\+?91)?[6-9]\d{9}$/.test(v) || /^\d{10,12}$/.test(v), { message: "Enter a valid 10-digit mobile number" });
const passwordSchema = z.string().trim().min(12, "Password must be at least 12 characters").max(128, "Password must be 128 characters or fewer").regex(/[A-Z]/, "Password must include an uppercase letter").regex(/[a-z]/, "Password must include a lowercase letter").regex(/[0-9]/, "Password must include a number").regex(/[^A-Za-z0-9]/, "Password must include a special character");
const loginPasswordSchema = z.string().min(1).max(128);
const hashEmail = (email:string) => crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const hashIdentity = (value:string) => crypto.createHash("sha256").update(value.trim().toLowerCase().replace(/\s+/g," ")).digest("hex");
const normalizePhone = (phone:string) => phone.replace(/\D/g,"");
const hashAddress = (a:any) => hashIdentity([a?.firstName,a?.lastName,a?.phone,a?.addressLine1,a?.addressLine2,a?.city,a?.state,a?.postalCode,a?.country].filter(Boolean).join("|"));
async function isBlockedIdentity(input:{email?:string;phone?:string;address?:any}){
  const emailHash=input.email?hashEmail(input.email):undefined;
  const phoneHash=input.phone?hashIdentity(normalizePhone(input.phone)):undefined;
  const addressHash=input.address?hashAddress(input.address):undefined;
  // Match each value only against its own column (avoid cross-field false positives).
  const clauses: Record<string, string>[] = [];
  if(emailHash) clauses.push({emailHash});
  if(phoneHash) clauses.push({phoneHash});
  if(addressHash) clauses.push({addressHash});
  if(!clauses.length)return false;
  return Boolean(await prisma.blockedIdentity.findFirst({where:{OR:clauses}}));
}
const addressSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: phoneSchema,
  addressLine1: z.string().trim().min(3, "Address must be at least 3 characters").max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  postalCode: z.string().trim()
    .transform(v => v.replace(/\s+/g, ""))
    .refine(v => /^\d{5,8}$/.test(v), { message: "Enter a valid PIN/postal code" }),
  country: z.string().trim().min(2).max(80).default("India")
});
const registerSchema = z.object({ name:z.string().trim().min(2).max(80), email:z.string().trim().toLowerCase().email(), phone:phoneSchema, password:passwordSchema, acceptedTerms:z.literal(true), address:addressSchema });
const loginSchema = z.object({ email:z.string().trim().toLowerCase().email(), password:loginPasswordSchema });
const constantTimeStringEqual = (left:string,right:string) => { const a=Buffer.from(left); const b=Buffer.from(right); return a.length>0 && a.length===b.length && crypto.timingSafeEqual(a,b); };
const imagePathRe=/^\/(?:images|uploads)\/[A-Za-z0-9_./%-]+\.(?:jpe?g|png|webp|avif)(?:\?.*)?$/i;
const imageHttpsRe=/^https:\/\/[^\s<>"']+$/i;
const imageRefSchema=z.string().trim().min(1).max(1200).refine(v=>imagePathRe.test(v)||imageHttpsRe.test(v),"Invalid image source");
const cartItemSchema = z.object({ productId:z.string().min(1), quantity:z.number().int().min(1).max(20), size:z.string().min(1).max(20), color:z.string().min(1).max(50) });

function safeUser(u:any){ return { id:u.id, name:u.name, email:u.email, phone:u.phone, role:u.role, createdAt:u.createdAt }; }
function currentSession(req:Request){ return readCustomerToken(req.cookies?.[cookieName]); }
function virgoSession(req: Request, audience: "customer" | "admin" = "customer") { return audience === "admin" ? readAdminToken(req.cookies?.[adminCookieName]) : currentSession(req); }
function routeParam(req:Request,key:string):string { const value=req.params[key]; return Array.isArray(value) ? (value[0] ?? "") : (value ?? ""); }
async function setting(key:string, fallback:any=""){ const s=await prisma.siteSetting.findUnique({where:{key}}); return s?.value ?? fallback; }
async function settingsMap(){
  const rows=await prisma.siteSetting.findMany();
  const map=Object.fromEntries(rows.filter(r=>!r.key.startsWith("__atelier_")).map(r=>[r.key,r.value]));
  const envDefaults={paymentQrUrl:process.env.PAYMENT_QR_URL??"",paymentUpiId:process.env.PAYMENT_UPI_ID??"",whatsappAdminNumber:process.env.WHATSAPP_ADMIN_TO??"",contactEmail:process.env.CONTACT_EMAIL??""};
  for(const [key,value] of Object.entries(envDefaults)) if(map[key]===undefined || map[key]===null || map[key]==="") map[key]=value;
  return map;
}
const publicSettingKeys=new Set([
  "navLinks","siteName","tagline","headerHomeLabel","headerShopLabel","headerCollectionsLabel","headerAboutLabel",
  "footerTagline","contactEmail","currency","newsletterText","announcement","footerShopLabel","footerAboutLabel",
  "footerHelpLabel","socialInstagram","socialPinterest","socialFacebook","copyrightText","whatsappAdminNumber",
  "hero1Eyebrow","hero1Line1","hero1Line2","hero1Line3","hero1Text","hero1Image",
  "hero2Eyebrow","hero2Line1","hero2Line2","hero2Line3","hero2Text","hero2Image",
  "hero3Eyebrow","hero3Line1","hero3Line2","hero3Line3","hero3Text","hero3Image",
  "theme","imageSettings","checkoutTheme","siteCopyOverrides","siteMediaOverrides","siteMotion","homeTicker","homeFilmTitle","homeFilmText",
  "homeManifestoTitle","homeManifestoEmphasis","homeManifestoBody",
  "homeShopTitle","homeShopBody","homeEditorialCard1Title","homeEditorialCard1Label","homeEditorialCard1Image",
  "homeEditorialCard2Title","homeEditorialCard2Label","homeEditorialCard2Image"
]);
async function publicSettingsMap(){const all=await settingsMap();return Object.fromEntries(Object.entries(all).filter(([key])=>publicSettingKeys.has(key)));}
function productPublic(p:any){ return { ...p, collectionType: collectionTypeFor(p), images: canonicalImagesFor(p) }; }
function sanitizeCustomerOrder(o:any){
  return { ...o, paymentIntent: o.paymentIntent ? { ...o.paymentIntent, payments: Array.isArray(o.paymentIntent.payments) ? o.paymentIntent.payments.map((p:any)=>({ id:p.id, provider:p.provider, method:p.method, amount:p.amount, currency:p.currency, status:p.status, utr:p.utr, capturedAt:p.capturedAt, createdAt:p.createdAt })) : [] } : undefined, items: o.items };
}
const ORDER_TRANSITIONS:Record<string, string[]>={
  PAID:["PROCESSING","CANCELLED","REFUNDED"],
  PROCESSING:["SHIPPED","CANCELLED","REFUNDED"],
  SHIPPED:["DELIVERED"],
  DELIVERED:["REFUNDED"],
  CANCELLED:[],
  REFUNDED:[]
};
function cartTotal(items:any[]){ return items.reduce((sum,i)=>sum + Number(i.product.price)*i.quantity,0); }
function cartPublic(c:any){ return { ...c, items: Array.isArray(c.items) ? c.items.map((i:any)=>({ ...i, product: i.product ? productPublic(i.product) : i.product })) : [] }; }
function orderNumber(){ return `ATL-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${cryptoRandom(5)}`; }
function cryptoRandom(n:number){ return crypto.randomBytes(Math.ceil(n*0.75)).toString("base64url").replace(/[^A-Z0-9]/gi,"").slice(0,n).toUpperCase().padEnd(n,"X"); }
function formatAddress(a:any){ return [a.firstName+" "+a.lastName,a.addressLine1,a.addressLine2,a.city,a.state,a.postalCode,a.country,a.phone].filter(Boolean).join(", "); }
function shippingFor(subtotal:number, method:"standard"|"express"){ return method==="express" ? 499 : subtotal>=3000 ? 0 : 199; }
function paymentMeta(intent:any){ return (intent?.metadata && typeof intent.metadata === "object") ? intent.metadata as Record<string,any> : {}; }

app.get("/api/health", async (_req,res)=>{
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ok:true,service:"atelier-api",database:"connected",time:new Date().toISOString()});
  } catch {
    res.status(503).json({ok:false,service:"atelier-api",database:"unreachable",time:new Date().toISOString()});
  }
});
// Private endpoints called only by the Next.js request gate. The random shared
// secret is server-only (never NEXT_PUBLIC_*); invalid access gets an uninformative 404.
app.get("/api/security/ip-status", async (req, res) => {
  if (!isInternalSecurityTokenValid(req.get("x-atelier-security-token"))) return res.status(404).json({ error: "NOT_FOUND" });
  const ip = normalizeIp(req.get("x-atelier-client-ip") || "");
  if (!isIP(ip)) return res.status(400).json({ error: "INVALID_CLIENT_IP" });
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const block = await getActiveIpBlock(ip);
    return res.json({ blocked: Boolean(block), permanent: block?.isPermanent ?? false, expiresAt: block?.expiresAt?.toISOString() ?? null });
  } catch (error) {
    console.error("Security status lookup failed:", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "SECURITY_STATUS_UNAVAILABLE" });
  }
});
app.post("/api/security/report", async (req, res) => {
  if (!isInternalSecurityTokenValid(req.get("x-atelier-security-token"))) return res.status(404).json({ error: "NOT_FOUND" });
  const ip = normalizeIp(req.get("x-atelier-client-ip") || "");
  if (!isIP(ip)) return res.status(400).json({ error: "INVALID_CLIENT_IP" });
  const parsed = z.object({ path: z.string().max(500).default("/"), method: z.string().max(16).default("GET"), reason: z.enum(["SQL_INJECTION", "XSS_PAYLOAD", "PATH_TRAVERSAL", "COMMAND_INJECTION", "SENSITIVE_FILE_PROBE"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_SECURITY_REPORT" });
  try {
    const result = await recordSecuritySignal({ ipAddress: ip, path: parsed.data.path, method: parsed.data.method, reason: parsed.data.reason, userAgent: req.get("x-atelier-client-user-agent") });
    return res.status(202).json({ ok: true, autoBlocked: result.autoBlocked });
  } catch (error) {
    console.error("Frontend security report failed:", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "SECURITY_REPORT_UNAVAILABLE" });
  }
});

app.get("/api/settings", async (_req,res)=>res.json(await publicSettingsMap()));
app.get("/api/public/config", async (_req,res)=>res.json({ razorpayKeyId:await publicKey(), site:await publicSettingsMap() }));

app.post("/api/newsletter/subscribe", async (req,res,next)=>{
  try {
    const d=z.object({email:z.string().trim().toLowerCase().email()}).parse(req.body);
    const entityId=hashEmail(d.email);
    const existing=await prisma.auditLog.findFirst({where:{action:"NEWSLETTER_SUBSCRIBE",entity:"Newsletter",entityId}});
    if(existing) return res.json({ok:true,subscribed:true,alreadySubscribed:true});
    await prisma.auditLog.create({data:{action:"NEWSLETTER_SUBSCRIBE",entity:"Newsletter",entityId,details:{emailDomain:d.email.split("@")[1]}}});
    res.status(201).json({ok:true,subscribed:true,alreadySubscribed:false});
  } catch(e){next(e)}
});

app.get("/api/categories", async (_req,res)=>res.json(await prisma.category.findMany({where:{active:true},orderBy:{sortOrder:"asc"}})));

const aiChatRateLimit = rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false });
const aiTryOnRateLimit = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
const aiImageGenerationRateLimit = rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: true, legacyHeaders: false });

app.get("/api/ai/status", async (_req, res, next) => { try { res.setHeader("Cache-Control","no-store"); res.json(await aiConfigStatus()); } catch (e) { next(e); } });

app.get("/api/ai/usage", requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const userLimit = Number(env.AI_TRY_ON_USER_24H_LIMIT || 5);
    const monthlyLimit = Number(env.AI_TRY_ON_MONTHLY_LIMIT || 100);
    const [recent, monthly] = await Promise.all([
      prisma.auditLog.findMany({ where: { actorId: req.session!.userId, action: "AI_TRY_ON", createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.auditLog.count({ where: { actorId: req.session!.userId, action: "AI_TRY_ON", createdAt: { gte: monthStart } } })
    ]);
    const oldest = recent[0]?.createdAt;
    const resetAt = oldest ? new Date(oldest.getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
    res.json({ used: recent.length, remaining: Math.max(0, userLimit - recent.length), limit: userLimit, monthlyUsed: monthly, monthlyRemaining: Math.max(0, monthlyLimit - monthly), monthlyLimit, resetAt });
  } catch (e) { next(e); }
});

const virgoVoiceRateLimit = rateLimit({ windowMs: 60_000, limit: 4, standardHeaders: true, legacyHeaders: false, message: { error: "VIRGO_VOICE_BUSY" } });
app.post("/api/ai/voice/session", virgoVoiceRateLimit, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const voiceOptions = z.object({ resumeHandle: z.string().min(1).max(8192).optional(), audience: z.enum(["customer", "admin"]).default("customer"), developmentInstructions: z.string().max(2000).default("") }).parse(req.body || {});
    const session = virgoSession(req, voiceOptions.audience);
    const [products, cart, person] = await Promise.all([
      prisma.product.findMany({ where: { status: "ACTIVE" }, include: { category: true }, orderBy: { createdAt: "desc" }, take: 100 }),
      session?.role === "USER" ? getOrCreateCart(session.userId) : Promise.resolve({ items: [] as any[] }),
      session ? prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, role: true } }) : Promise.resolve(null)
    ]);
    res.json(await createVirgoLiveSession({ person, resumeHandle: voiceOptions.resumeHandle, developmentInstructions: voiceOptions.developmentInstructions, products: products as any, cart: cart.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity, size: i.size, color: i.color })) }));
  }
  catch { res.status(503).json({ error: "VIRGO_VOICE_UNAVAILABLE" }); }
});

app.post("/api/ai/chat", aiChatRateLimit, async (req, res, next) => {
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", disconnect);
  const sendEvent = (event: Record<string, any>) => { if (!res.destroyed) res.write(JSON.stringify(event) + "\n"); };
  try {
    const d = z.object({
      message: z.string().trim().max(100_000).default(""),
      stream: z.boolean().default(false),
      developmentMode: z.boolean().default(false),
      workspaceFiles: z.array(z.object({ path: z.string().min(1).max(500), content: z.string().max(120_000) })).max(20).default([]),
      audience: z.enum(["customer", "admin"]).default("customer"),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12_000) })).max(30).default([]),
      attachments: z.array(z.object({ name: z.string().min(1).max(180), mimeType: z.string().min(1).max(100), dataBase64: z.string().min(1).max(2_800_000_000) })).max(40).default([]),
    }).refine((value) => value.message.length > 0 || value.attachments.length > 0, { message: "MESSAGE_OR_ATTACHMENT_REQUIRED" }).parse(req.body);
    if (d.attachments.length > (d.developmentMode ? 40 : 8)) return res.status(400).json({ error: "CHAT_ATTACHMENT_COUNT_LIMIT" });
    if (!d.developmentMode && d.message.length > 12_000) return res.status(400).json({ error: "CHAT_MESSAGE_TOO_LONG" });
    if (d.stream) {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders(); sendEvent({ type: "start" });
    }
    const session = virgoSession(req, d.audience);
    const [products, cart, person] = await Promise.all([
      prisma.product.findMany({ where: { status: "ACTIVE" }, include: { category: true }, orderBy: { createdAt: "desc" }, take: 100 }),
      session?.role === "USER" ? getOrCreateCart(session.userId) : Promise.resolve({ items: [] as any[] }),
      session ? prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, role: true } }) : Promise.resolve(null)
    ]);
    const text = await generateAtelierChat({
      person,
      message: d.message,
      history: d.history,
      attachments: d.attachments,
      developmentMode: d.developmentMode,
      workspaceFiles: d.workspaceFiles,
      onDelta: d.stream ? delta => sendEvent({ type: "delta", delta }) : undefined,
      signal: controller.signal,
      products: products as any,
      cart: cart.items.map((i:any) => ({ productId: i.productId, quantity: i.quantity, size: i.size, color: i.color }))
    });
    if (d.stream) { sendEvent({ type: "done", reply: text }); res.end(); }
    else res.json({ reply: text, cartCount: cart.items.reduce((n:number, i:any) => n + Number(i.quantity || 0), 0) });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (res.headersSent) {
      const safeError = /^(?:CHAT_ATTACHMENT|AI_PROVIDER|GEMINI_NOT_CONFIGURED|INVALID_AI_MESSAGE)[A-Z0-9_]*$/.test(code) ? code : code.startsWith("GEMINI_ERROR:") ? `GEMINI_HTTP_${code.match(/GEMINI_HTTP_(\d+)/)?.[1] || "ERROR"}` : "AI_REPLY_UNAVAILABLE";
      console.error("Streaming AI request failed:", safeError);
      sendEvent({ type: "error", error: safeError }); res.end(); return;
    }
    if (code.startsWith("CHAT_ATTACHMENT_") || code === "CHAT_VIDEO_REQUIRES_GEMINI" || code === "CHAT_ATTACHMENT_PROVIDER_UNSUPPORTED") return res.status(400).json({ error: code });
    next(e);
  } finally { res.off("close", disconnect); }
});

async function requireVirgoWorkspaceSession(req: Request, res: Response, next: NextFunction) {
  const session = readAdminToken(req.cookies?.[adminCookieName]) || currentSession(req);
  if (!session) return res.status(401).json({ error: "AUTH_REQUIRED" });
  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, blockedAt: true, deletedAt: true } });
    if (!user || user.blockedAt || user.deletedAt || user.role !== session.role) return res.status(401).json({ error: "SESSION_REVOKED" });
    req.session = { userId: session.userId, role: session.role };
    next();
  } catch (error) { next(error); }
}
function handleDevelopmentWorkspaceError(error: unknown, res: Response, next: NextFunction) {
  const code = error instanceof Error ? error.message : "";
  if (!/^DEV_WORKSPACE_[A-Z0-9_]+$/.test(code)) return next(error);
  const status = code.includes("LIMIT") ? 413 : code.includes("DOCKER_UNAVAILABLE") ? 503 : 400;
  return res.status(status).json({ error: code });
}

app.post("/api/ai/dev-workspace/import", requireVirgoWorkspaceSession, express.json({ limit: "140mb" }), async (req, res, next) => {
  try {
    const input = z.object({ dataBase64: z.string().min(1).max(140_000_000) }).parse(req.body);
    res.status(201).json(await createDevelopmentWorkspace(req.session!.userId, input.dataBase64));
  } catch (error) { handleDevelopmentWorkspaceError(error, res, next); }
});
app.get("/api/ai/dev-workspace/:id/files", requireVirgoWorkspaceSession, async (req, res, next) => {
  try { res.json({ files: await listDevelopmentWorkspaceFiles(req.session!.userId, routeParam(req, "id")) }); }
  catch (error) { handleDevelopmentWorkspaceError(error, res, next); }
});
app.get("/api/ai/dev-workspace/:id/export", requireVirgoWorkspaceSession, async (req, res, next) => {
  try { res.setHeader("Content-Type", "application/zip"); res.setHeader("Content-Disposition", 'attachment; filename="virgo-project-updated.zip"'); res.send(await exportDevelopmentWorkspace(req.session!.userId, routeParam(req, "id"))); }
  catch (error) { handleDevelopmentWorkspaceError(error, res, next); }
});
app.get("/api/ai/dev-workspace/:id/file", requireVirgoWorkspaceSession, async (req, res, next) => {
  try { res.json({ content: await readDevelopmentWorkspaceFile(req.session!.userId, routeParam(req, "id"), String(req.query.path || "")) }); }
  catch (error) { handleDevelopmentWorkspaceError(error, res, next); }
});
app.put("/api/ai/dev-workspace/:id/file", requireVirgoWorkspaceSession, async (req, res, next) => {
  try {
    const input = z.object({ path: z.string().min(1).max(500), content: z.string().max(2_000_000) }).parse(req.body);
    res.json(await writeDevelopmentWorkspaceFile(req.session!.userId, routeParam(req, "id"), input.path, input.content));
  } catch (error) { handleDevelopmentWorkspaceError(error, res, next); }
});
app.post("/api/ai/dev-workspace/:id/run", requireVirgoWorkspaceSession, async (req, res, next) => {
  try {
    const input = z.object({ command: z.string().min(1).max(1000) }).parse(req.body);
    res.json(await runDevelopmentWorkspaceCommand(req.session!.userId, routeParam(req, "id"), input.command));
  } catch (error) { handleDevelopmentWorkspaceError(error, res, next); }
});

app.post("/api/ai/try-on", aiTryOnRateLimit, requireAuth, async (req, res, next) => {
  try {
    const d = z.object({ photoDataUrl: z.string().min(1000).max(18_000_000), productIds: z.array(z.string().min(1)).min(1).max(5), avatarSex: z.enum(["male", "female"]).optional() }).parse(req.body);
    const ids = [...new Set(d.productIds)];
    if (ids.length > 5) return res.status(400).json({ error: "MAX_5_PRODUCTS" });
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const userLimit = Number(env.AI_TRY_ON_USER_24H_LIMIT || 5);
    const monthlyLimit = Number(env.AI_TRY_ON_MONTHLY_LIMIT || 100);
    const current = await prisma.auditLog.count({ where: { actorId: req.session!.userId, action: "AI_TRY_ON", createdAt: { gt: since } } });
    const monthly = await prisma.auditLog.count({ where: { actorId: req.session!.userId, action: "AI_TRY_ON", createdAt: { gte: monthStart } } });
    const products = await prisma.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, include: { category: true } });
    if (products.length !== ids.length) return res.status(404).json({ error: "TRY_ON_PRODUCT_NOT_FOUND" });
    // Fail before reserving quota/audit rows when the optional provider is not configured.
    const configuredTryOnProvider = await activeAIProvider("tryon");
    if (!configuredTryOnProvider && !String(env.RAPIDAPI_KEY || "").trim() && !isLocalTryOnConfigured()) return res.status(503).json({ error: "TRY_ON_NOT_CONFIGURED" });
    if (current + ids.length > userLimit) return res.status(429).json({ error: "TRY_ON_DAILY_LIMIT", remaining: Math.max(0, userLimit - current) });
    if (monthly + ids.length > monthlyLimit) return res.status(429).json({ error: "TRY_ON_MONTHLY_LIMIT", remaining: Math.max(0, monthlyLimit - monthly) });
    const byId = new Map(products.map((p:any) => [p.id, p]));
    const reservations = await Promise.all(ids.map((productId) => prisma.auditLog.create({ data: { actorId: req.session!.userId, action: "AI_TRY_ON", entity: "TryOn", entityId: productId, details: { status: "STARTED", productId } } })));
    const results = [];
    for (let i = 0; i < ids.length; i++) {
      const product:any = byId.get(ids[i]);
      const log = reservations[i];
      try {
        const clothingPrompt = `${product.name}. ${product.description}. Preserve the ATELIER garment as closely as possible; keep its silhouette, material, colour family and design details. Catalogue colours: ${Array.isArray(product.colors) ? product.colors.join(", ") : ""}.`;
        const description = `${product.name || ""} ${product.type || ""} ${product.category?.name || ""} ${product.slug || ""}`.toLowerCase();
        const category = /dress|gown|jumpsuit|romper|one[- ]?piece|saree|sari/.test(description)
          ? "one-pieces"
          : /trouser|pant|jean|short|skirt|legging|palazzo|bottom/.test(description)
            ? "bottoms"
            : "tops";
        const result = await generateTryOn({ photoDataUrl: d.photoDataUrl, clothingImageUrl: tryOnImageFor(product), clothingPrompt, avatarSex: d.avatarSex, category, seed: Math.floor(Math.random() * 10_000_000) });
        await prisma.auditLog.update({ where: { id: log.id }, data: { details: { status: "SUCCESS", productId: product.id } } });
        results.push({ productId: product.id, name: product.name, price: product.price, currency: product.currency, image: result.dataUrl });
      } catch (e:any) {
        const rawCode = String(e?.message || "TRY_ON_PROVIDER_ERROR").split(":")[0].trim().toUpperCase();
        const knownCodes = new Set(["INVALID_IMAGE_DATA", "IMAGE_TOO_LARGE", "PRODUCT_IMAGE_URL_INVALID", "PRODUCT_IMAGE_NOT_SUPPORTED", "PRODUCT_IMAGE_TOO_LARGE", "TRY_ON_NON_IMAGE_RESPONSE", "TRY_ON_NOT_CONFIGURED", "LOCAL_TRY_ON_ENDPOINT_INVALID", "LOCAL_TRY_ON_UNAVAILABLE", "LOCAL_TRY_ON_TIMEOUT", "LOCAL_TRY_ON_FAILED", "INVALID_GARMENT_CATEGORY"]);
        const safeCode = knownCodes.has(rawCode) || /^PRODUCT_IMAGE_HTTP_[45]\d\d$/.test(rawCode)
          ? rawCode
          : /quota|limit|credit/i.test(rawCode) ? "TRY_ON_PROVIDER_QUOTA"
          : /subscription|rapidapi|api[_ -]?key|unauthori[sz]ed|forbidden|auth/i.test(rawCode) ? "TRY_ON_PROVIDER_AUTH"
          : "TRY_ON_PROVIDER_ERROR";
        await prisma.auditLog.update({ where: { id: log.id }, data: { details: { status: "FAILED", productId: product.id, error: safeCode } } });
        results.push({ productId: product.id, name: product.name, error: safeCode });
      }
    }
    const refreshed = await prisma.auditLog.findMany({ where: { actorId: req.session!.userId, action: "AI_TRY_ON", createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
    const oldest = refreshed[0]?.createdAt;
    res.json({ results, usage: { used: refreshed.length, remaining: Math.max(0, userLimit - refreshed.length), limit: userLimit, monthlyUsed: monthly + ids.length, monthlyRemaining: Math.max(0, monthlyLimit - (monthly + ids.length)), monthlyLimit, resetAt: oldest ? new Date(oldest.getTime() + 24 * 60 * 60 * 1000).toISOString() : null } });
  } catch (e) { next(e); }
});

app.get("/api/products", async (req,res)=>{
  const q=String(req.query.q??"").trim(); const gender=String(req.query.gender??"").trim(); const category=String(req.query.category??"").trim(); const featured=req.query.featured==="true"; const newest=req.query.newest==="true"; const best=req.query.bestSeller==="true";
  const collectionType=String(req.query.collectionType??"").trim();
  const enforcedCollectionGender=collectionType==="MEN"?"Men":collectionType?.startsWith("WOMEN_")?"Women":undefined;
  const products=await prisma.product.findMany({where:{status:"ACTIVE",...(gender?{gender:{equals:gender,mode:"insensitive"}}:{}),...(collectionType?{collectionType}:{}),...(enforcedCollectionGender&&!gender?{gender:enforcedCollectionGender}:{}),...(category?{category:{slug:category}}:{}),...(featured?{featured:true}:{}),...(best?{bestSeller:true}:{}),...(newest?{newArrival:true}:{}),...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{description:{contains:q,mode:"insensitive"}},{gender:{contains:q,mode:"insensitive"}},{type:{contains:q,mode:"insensitive"}}]}:{})},include:{category:true},orderBy:{createdAt:"desc"},take:100});
  res.json(products.map(productPublic));
});
app.get("/api/products/:id", async (req,res)=>{ const p=await prisma.product.findFirst({where:{OR:[{id:routeParam(req,"id")},{slug:routeParam(req,"id")}],status:"ACTIVE"},include:{category:true}}); if(!p)return res.status(404).json({error:"PRODUCT_NOT_FOUND"}); res.json(productPublic(p)); });

app.post("/api/auth/register", authRateLimit, async (req,res,next)=>{ try{
  const data=registerSchema.parse(req.body); const email=data.email.trim().toLowerCase();
  if(email===adminEmailFromEnv())return res.status(409).json({error:"EMAIL_RESERVED"});
  if(await isBlockedIdentity({email,phone:data.phone}))return res.status(403).json({error:"ACCOUNT_BLOCKED"});
  const exists=await prisma.user.findUnique({where:{email}});
  if(exists){ if(exists.emailVerifiedAt) return res.status(409).json({error:"EMAIL_ALREADY_REGISTERED"}); await prisma.user.update({where:{id:exists.id},data:{name:data.name,phone:data.phone,passwordHash:await bcrypt.hash(data.password,12)}}); if(data.address){await prisma.address.deleteMany({where:{userId:exists.id}});await prisma.address.create({data:{...data.address,userId:exists.id,isDefault:true}});} await issueOtp(email,"REGISTER"); return res.status(202).json({pending:true,email}); }
  const passwordHash=await bcrypt.hash(data.password,12);
  const user=await prisma.user.create({data:{name:data.name,email,phone:data.phone,passwordHash,role:"USER",emailVerifiedAt:null,phoneVerifiedAt:null}});
  if(data.address) await prisma.address.create({data:{...data.address,userId:user.id,isDefault:true}});
  await issueOtp(email,"REGISTER");
  res.status(202).json({pending:true,email});
 }catch(e){next(e)}});

app.post("/api/auth/register/verify", authRateLimit, async (req,res,next)=>{try{
  const d=z.object({email:z.string().email(),code:z.string().regex(/^\d{6}$/)}).parse(req.body); const email=d.email.toLowerCase();
  await consumeOtp(email,"REGISTER",d.code); const user=await prisma.user.update({where:{email},data:{emailVerifiedAt:new Date()}});
  setSession(res,{userId:user.id,role:user.role}); res.status(201).json({user:safeUser(user)});
}catch(e){next(e)}});

app.post("/api/auth/otp/request", authRateLimit, async (req,res,next)=>{try{
  const d=z.object({email:z.string().email(),purpose:z.enum(["LOGIN","PASSWORD_RESET","REGISTER"]).default("LOGIN")}).parse(req.body); const email=d.email.toLowerCase(); const user=await prisma.user.findUnique({where:{email}});
  if(user?.role==="ADMIN")return res.status(404).json({error:"EMAIL_NOT_REGISTERED"}); if(await isBlockedIdentity({email,phone:user?.phone}))return res.status(403).json({error:"ACCOUNT_BLOCKED"}); if(d.purpose!=="REGISTER" && !user)return res.status(404).json({error:"EMAIL_NOT_REGISTERED"});
  if(d.purpose!=="PASSWORD_RESET" && !user?.emailVerifiedAt)return res.status(403).json({error:"EMAIL_NOT_VERIFIED"});
  await issueOtp(email,d.purpose); res.json({sent:true,expiresIn:600});
}catch(e){next(e)}});

app.post("/api/auth/otp/login", authRateLimit, async (req,res,next)=>{try{
  const d=z.object({email:z.string().email(),code:z.string().regex(/^\d{6}$/)}).parse(req.body); const email=d.email.toLowerCase(); const user=await prisma.user.findUnique({where:{email}});
  if(user?.role==="ADMIN") return res.status(401).json({error:"INVALID_CREDENTIALS"});
  if(await isBlockedIdentity({email,phone:user?.phone})) return res.status(403).json({error:"ACCOUNT_BLOCKED"});
  if(!user)return res.status(404).json({error:"EMAIL_NOT_REGISTERED"});
  if(!user.emailVerifiedAt)return res.status(403).json({error:"EMAIL_NOT_VERIFIED"});
  await consumeOtp(email,"LOGIN",d.code); setSession(res,{userId:user.id,role:user.role}); res.json({user:safeUser(user)});
}catch(e){next(e)}});

app.post("/api/auth/password-reset/request", authRateLimit, async (req,res,next)=>{try{const d=z.object({email:z.string().email()}).parse(req.body);const email=d.email.toLowerCase();const user=await prisma.user.findUnique({where:{email}});if(user && user.role!=="ADMIN" && !(await isBlockedIdentity({email,phone:user.phone}))) await issueOtp(email,"PASSWORD_RESET");res.json({sent:true,expiresIn:600})}catch(e){next(e)}});
app.post("/api/auth/password-reset/confirm", authRateLimit, async (req,res,next)=>{try{const d=z.object({email:z.string().email(),code:z.string().regex(/^\d{6}$/),password:passwordSchema}).parse(req.body);const email=d.email.toLowerCase();const existing=await prisma.user.findUnique({where:{email}});if(!existing||existing.role==="ADMIN")return res.status(401).json({error:"INVALID_CREDENTIALS"});await consumeOtp(email,"PASSWORD_RESET",d.code);const user=await prisma.user.update({where:{email},data:{passwordHash:await bcrypt.hash(d.password,12),emailVerifiedAt:new Date()}});if(user.role==="ADMIN")return res.status(401).json({error:"INVALID_CREDENTIALS"});clearAdminSession(res);setSession(res,{userId:user.id,role:"USER"});res.json({user:safeUser(user)})}catch(e){next(e)}});

app.post("/api/auth/admin/login", authRateLimit, async (req,res,next)=>{ try{
  const data=loginSchema.parse(req.body); const email=data.email.trim().toLowerCase(); const user=await prisma.user.findUnique({where:{email}});
  if(!user || user.role!=="ADMIN" || !(await bcrypt.compare(data.password,user.passwordHash))) return res.status(401).json({error:"INVALID_CREDENTIALS"});
  if(!user.emailVerifiedAt)return res.status(401).json({error:"INVALID_CREDENTIALS"});
  setSession(res,{userId:user.id,role:"ADMIN"}); res.json({user:safeUser(user)});
 }catch(e){next(e)}});

app.post("/api/auth/login", authRateLimit, async (req,res,next)=>{ try{
  const data=loginSchema.parse(req.body); const email=data.email.trim().toLowerCase();
  let user=await prisma.user.findUnique({where:{email}});
  // Keep the shared sign-in form reliable if backend/.env was changed while the API
  // was running or the first startup happened before PostgreSQL was ready. Only an
  // exact match against the server-side admin email + secret can trigger a resync;
  // the client cannot request an ADMIN role, and the admin session remains HttpOnly.
  const configuredAdminEmail=adminEmailFromEnv();
  const configuredAdminPassword=process.env.ADMIN_PASSWORD??"";
  const configuredAdminMatch=Boolean(configuredAdminEmail && email===configuredAdminEmail && configuredAdminPassword && constantTimeStringEqual(data.password,configuredAdminPassword));
  if(configuredAdminMatch && (!user || user.role!=="ADMIN" || user.blockedAt || user.deletedAt || !user.emailVerifiedAt || !(await bcrypt.compare(data.password,user.passwordHash)))){
    await syncEnvAdmin();
    user=await prisma.user.findUnique({where:{email}});
  }
  if(!user)return (await isBlockedIdentity({email})) ? res.status(403).json({error:"ACCOUNT_BLOCKED"}) : res.status(401).json({error:"INVALID_CREDENTIALS"});
  // One sign-in form supports both roles. The database role is authoritative; an
  // ADMIN session is only issued after the stored password hash and verified status pass.
  // setSession writes the separate HttpOnly admin cookie and clears the customer cookie.
  if(user.role==="ADMIN"){
    if(user.blockedAt||user.deletedAt||!user.emailVerifiedAt||!(await bcrypt.compare(data.password,user.passwordHash)))
      return res.status(401).json({error:"INVALID_CREDENTIALS"});
    setSession(res,{userId:user.id,role:"ADMIN"});
    return res.json({user:safeUser(user)});
  }
  if(await isBlockedIdentity({email,phone:user.phone}))return res.status(403).json({error:"ACCOUNT_BLOCKED"});
  if(!(await bcrypt.compare(data.password,user.passwordHash)))return res.status(401).json({error:"INVALID_CREDENTIALS"});
  if(!user.emailVerifiedAt)return res.status(403).json({error:"EMAIL_NOT_VERIFIED"});
  setSession(res,{userId:user.id,role:"USER"}); res.json({user:safeUser(user)});
 }catch(e){next(e)}});

app.post("/api/auth/logout", (_req,res)=>{clearSession(res);clearAdminSession(res);res.clearCookie("atelier_session",{path:"/"});res.clearCookie("atelier_admin_session",{path:"/"});res.json({ok:true})});
app.post("/api/auth/admin/logout", (_req,res)=>{clearAdminSession(res);res.clearCookie("atelier_admin_session",{path:"/"});res.json({ok:true})});
app.get("/api/auth/admin/me", requireAdmin, async (req,res,next)=>{ try { const user=await prisma.user.findUnique({where:{id:req.session!.userId}}); if(!user||user.role!=="ADMIN"||user.blockedAt||user.deletedAt)return res.status(401).json({error:"SESSION_REVOKED"}); res.json({user:safeUser(user)}); } catch(e) { next(e); } });
app.get("/api/auth/me", requireAuth, async (req,res,next)=>{ try {
  const user=await prisma.user.findUnique({where:{id:req.session!.userId}});
  if(!user||user.blockedAt||user.deletedAt||user.role!=="USER")return res.status(401).json({error:"SESSION_REVOKED"});
  res.json({user:safeUser(user)});
} catch(e) { next(e); } });
app.patch("/api/auth/me", requireAuth, async (req,res,next)=>{try{const data=z.object({name:z.string().trim().min(2).max(80),phone:phoneSchema}).parse(req.body);const u=await prisma.user.update({where:{id:req.session!.userId},data});res.json({user:safeUser(u)})}catch(e){next(e)}});
app.delete("/api/auth/me", requireAuth, async (req,res,next)=>{
  try {
    const userId = req.session!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (user.role === "ADMIN") return res.status(403).json({ error: "ADMIN_ACCOUNT_PROTECTED" });
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        name: "Deleted Account",
        email: `deleted-${userId}@atelier.local`,
        phone: `DELETED-${userId}`
      }
    });
    await prisma.wishlistItem.deleteMany({ where: { userId } }).catch(() => null);
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } }).catch(() => null);
    await prisma.cart.deleteMany({ where: { userId } }).catch(() => null);
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "CUSTOMER_SELF_DELETE",
        entity: "User",
        entityId: userId,
        details: { selfDeleted: true }
      }
    }).catch(() => null);
    clearSession(res);
    clearAdminSession(res);
    res.clearCookie("atelier_session", { path: "/" });
    res.clearCookie("atelier_admin_session", { path: "/" });
    res.json({ ok: true, message: "Account successfully deleted" });
  } catch (e) {
    next(e);
  }
});

app.get("/api/addresses", requireAuth, async(req,res)=>res.json(await prisma.address.findMany({where:{userId:req.session!.userId},orderBy:[{isDefault:"desc"},{createdAt:"desc"}]})));
app.post("/api/addresses", requireAuth, async(req,res,next)=>{try{const d=addressSchema.parse(req.body);const userId=req.session!.userId;const count=await prisma.address.count({where:{userId}});const wantsDefault=Boolean((req.body as any)?.isDefault)||count===0;const a=await prisma.$transaction(async tx=>{if(wantsDefault)await tx.address.updateMany({where:{userId},data:{isDefault:false}});return tx.address.create({data:{...d,userId,isDefault:wantsDefault}})});res.status(201).json(a)}catch(e){next(e)}});
app.patch("/api/addresses/:id",requireAuth,async(req,res,next)=>{try{const d=addressSchema.partial().parse(req.body);const a=await prisma.address.findFirst({where:{id:routeParam(req,"id"),userId:req.session!.userId}});if(!a)return res.status(404).json({error:"ADDRESS_NOT_FOUND"});const wantsDefault=(req.body as any)?.isDefault;const out=await prisma.$transaction(async tx=>{if(wantsDefault===true)await tx.address.updateMany({where:{userId:req.session!.userId,id:{not:a.id}},data:{isDefault:false}});const updated=await tx.address.update({where:{id:a.id},data:{...d,...(wantsDefault===true?{isDefault:true}:{})}});if(wantsDefault===false&&a.isDefault){const replacement=await tx.address.findFirst({where:{userId:req.session!.userId,id:{not:a.id}},orderBy:{createdAt:"asc"}});if(replacement)await tx.address.update({where:{id:replacement.id},data:{isDefault:true}});}return updated});res.json(out)}catch(e){next(e)}});
app.delete("/api/addresses/:id",requireAuth,async(req,res,next)=>{try{const a=await prisma.address.findFirst({where:{id:routeParam(req,"id"),userId:req.session!.userId}});if(!a)return res.status(404).json({error:"ADDRESS_NOT_FOUND"});await prisma.$transaction(async tx=>{await tx.address.delete({where:{id:a.id}});if(a.isDefault){const replacement=await tx.address.findFirst({where:{userId:req.session!.userId},orderBy:{createdAt:"asc"}});if(replacement)await tx.address.update({where:{id:replacement.id},data:{isDefault:true}});}});res.json({ok:true})}catch(e){next(e)}});

app.get("/api/wishlist", requireAuth, async(req,res)=>{const rows=await prisma.wishlistItem.findMany({where:{userId:req.session!.userId},include:{product:{include:{category:true}}},orderBy:{createdAt:"desc"}});res.json(rows.filter(r=>r.product?.status==="ACTIVE").map(r=>productPublic(r.product)))});
app.post("/api/wishlist/:productId", requireAuth, async(req,res,next)=>{try{const p=await prisma.product.findUnique({where:{id:routeParam(req,"productId")}});if(!p||p.status!=="ACTIVE")return res.status(404).json({error:"PRODUCT_NOT_FOUND"});await prisma.wishlistItem.upsert({where:{userId_productId:{userId:req.session!.userId,productId:p.id}},update:{},create:{userId:req.session!.userId,productId:p.id}});res.json({ok:true})}catch(e){next(e)}});
app.delete("/api/wishlist/:productId", requireAuth, async(req,res,next)=>{try{await prisma.wishlistItem.deleteMany({where:{userId:req.session!.userId,productId:routeParam(req,"productId")}});res.json({ok:true})}catch(e){next(e)}});

async function getOrCreateCart(userId:string){
  try {
    let cart=await prisma.cart.findUnique({where:{userId},include:{items:{include:{product:true}}}});
    if(!cart)cart=await prisma.cart.create({data:{userId},include:{items:{include:{product:true}}}});
    return cart;
  } catch (err: any) {
    if (err?.code === "P2002") {
      return await prisma.cart.findUniqueOrThrow({where:{userId},include:{items:{include:{product:true}}}});
    }
    throw err;
  }
}
app.get("/api/cart", requireAuth, async(req,res)=>{const c=await getOrCreateCart(req.session!.userId);res.json(cartPublic(c))});
app.post("/api/cart/items",requireAuth,async(req,res,next)=>{try{const d=cartItemSchema.parse(req.body);const p=await prisma.product.findUnique({where:{id:d.productId}});if(!p||p.status!=="ACTIVE")return res.status(404).json({error:"PRODUCT_NOT_FOUND"});if(!p.sizes.includes(d.size)||!p.colors.includes(d.color))return res.status(400).json({error:"INVALID_VARIANT"});if(p.stock<d.quantity)return res.status(409).json({error:"INSUFFICIENT_STOCK"});const cart=await getOrCreateCart(req.session!.userId);const existing=cart.items.find(i=>i.productId===p.id&&i.size===d.size&&i.color===d.color);const nextQuantity=(existing?.quantity??0)+d.quantity;if(nextQuantity>20||nextQuantity>p.stock)return res.status(409).json({error:"INSUFFICIENT_STOCK"});const item=await prisma.cartItem.upsert({where:{cartId_productId_size_color:{cartId:cart.id,productId:p.id,size:d.size,color:d.color}},update:{quantity:nextQuantity},create:{cartId:cart.id,productId:p.id,size:d.size,color:d.color,quantity:d.quantity}});res.json(item)}catch(e){next(e)}});
app.patch("/api/cart/items/:id",requireAuth,async(req,res,next)=>{try{const q=z.object({quantity:z.number().int().min(1).max(20)}).parse(req.body);const c=await getOrCreateCart(req.session!.userId);const item=await prisma.cartItem.findFirst({where:{id:routeParam(req,"id"),cartId:c.id},include:{product:true}});if(!item)return res.status(404).json({error:"CART_ITEM_NOT_FOUND"});if(item.product.stock<q.quantity)return res.status(409).json({error:"INSUFFICIENT_STOCK"});const out=await prisma.cartItem.update({where:{id:item.id},data:{quantity:q.quantity}});res.json(out)}catch(e){next(e)}});
app.delete("/api/cart/items/:id",requireAuth,async(req,res)=>{const c=await getOrCreateCart(req.session!.userId);await prisma.cartItem.deleteMany({where:{id:routeParam(req,"id"),cartId:c.id}});res.json({ok:true})});
app.post("/api/cart/sync",requireAuth,async(req,res,next)=>{try{const items=z.array(cartItemSchema).max(50).parse(req.body?.items??[]);const cart=await getOrCreateCart(req.session!.userId);const rejected:any[]=[];for(const d of items){const p=await prisma.product.findUnique({where:{id:d.productId}});if(!p||p.status!=="ACTIVE"){rejected.push({productId:d.productId,reason:"PRODUCT_UNAVAILABLE"});continue;}if(!p.sizes.includes(d.size)||!p.colors.includes(d.color)){rejected.push({productId:d.productId,reason:"INVALID_VARIANT"});continue;}const existing=cart.items.find(i=>i.productId===p.id&&i.size===d.size&&i.color===d.color);const nextQuantity=(existing?.quantity??0)+d.quantity;if(nextQuantity>20||nextQuantity>p.stock){rejected.push({productId:d.productId,reason:"INSUFFICIENT_STOCK",available:p.stock});continue;}await prisma.cartItem.upsert({where:{cartId_productId_size_color:{cartId:cart.id,productId:p.id,size:d.size,color:d.color}},update:{quantity:nextQuantity},create:{cartId:cart.id,productId:p.id,size:d.size,color:d.color,quantity:d.quantity}})}res.json({cart:cartPublic(await getOrCreateCart(req.session!.userId)),rejected});}catch(e){next(e)}});

app.get("/api/orders",requireAuth,async(req,res)=>{const orders=await prisma.order.findMany({where:{userId:req.session!.userId},include:{items:true,paymentIntent:{include:{payments:true}}},orderBy:{createdAt:"desc"}});res.json(orders.map(sanitizeCustomerOrder))});
app.get("/api/orders/:id",requireAuth,async(req,res)=>{
  const o=await prisma.order.findFirst({where:{id:routeParam(req,"id"),userId:req.session!.userId},include:{items:true,paymentIntent:{include:{payments:true}}}});
  if(!o)return res.status(404).json({error:"ORDER_NOT_FOUND"});
  res.json(sanitizeCustomerOrder(o));
});

async function makePaymentIntent(userId:string, kind:"qr"|"checkout", shippingMethod:"standard"|"express", address:any){
  const cart=await getOrCreateCart(userId); if(!cart.items.length)throw new Error("CART_EMPTY");
  const bad=cart.items.find(i=>i.quantity>i.product.stock||i.product.status!=="ACTIVE"); if(bad)throw new Error("CART_STOCK_CHANGED");
  const invalidVariant=cart.items.find(i=>!i.product.sizes.includes(i.size)||!i.product.colors.includes(i.color)); if(invalidVariant)throw new Error("CART_VARIANT_CHANGED");
  const subtotal=cartTotal(cart.items); const shipping=shippingFor(subtotal, shippingMethod); const amount=subtotal+shipping;
  const expiresAt=new Date(Date.now()+15*60*1000);
  const snapshot = cart.items.map(i=>({productId:i.productId,productName:i.product.name,imageUrl:canonicalImagesFor(i.product)[0]??"",unitPrice:Number(i.product.price),quantity:i.quantity,size:i.size,color:i.color}));
  const intent=await prisma.paymentIntent.create({data:{userId,amount,currency:"INR",provider:"razorpay",status:"CREATED",expiresAt,metadata:{kind,shippingMethod,address,subtotal,shipping,items:snapshot,snapshotVersion:1}}});
  return {intent,cart,subtotal,shipping};
}

async function finalizePaidOrder(intentId:string,payment:any){
  const intent=await prisma.paymentIntent.findUnique({where:{id:intentId},include:{user:true}}); if(!intent)throw new Error("PAYMENT_INTENT_NOT_FOUND");
  const meta=paymentMeta(intent); const address=addressSchema.parse(meta.address);
  if (intent.currency !== "INR" || !Array.isArray(meta.items) || meta.snapshotVersion !== 1) throw new Error("PAYMENT_SNAPSHOT_MISSING");
  const snapshotSchema = z.array(z.object({
    productId:z.string().min(1), productName:z.string().min(1).max(200), imageUrl:z.string().max(1200).optional(),
    unitPrice:z.number().int().nonnegative(), quantity:z.number().int().min(1).max(20),
    size:z.string().min(1).max(20), color:z.string().min(1).max(50)
  })).min(1).max(50);
  const snapshot = snapshotSchema.parse(meta.items);
  const subtotal = Number(meta.subtotal);
  const shipping = Number(meta.shipping);
  const currentTotal = subtotal + shipping;
  const snapshotSubtotal = snapshot.reduce((sum,item)=>sum+item.unitPrice*item.quantity,0);
  const shippingMethod = z.enum(["standard","express"]).parse(meta.shippingMethod);
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(shipping) || subtotal !== snapshotSubtotal || shipping !== shippingFor(subtotal,shippingMethod) || currentTotal !== intent.amount) throw new Error("PAYMENT_SNAPSHOT_INVALID");
  const existing=await prisma.order.findUnique({where:{paymentIntentId:intent.id},include:{items:true}}); if(existing)return existing;
  const created=await prisma.$transaction(async tx=>{
    const order=await tx.order.create({data:{orderNumber:orderNumber(),userId:intent.userId,paymentIntentId:intent.id,subtotal,shipping,total:currentTotal,currency:intent.currency,status:"PAID",paymentStatus:"CAPTURED",shippingAddress:address,paidAt:new Date(),items:{create:snapshot.map((i:any)=>({productId:i.productId,productName:i.productName,imageUrl:i.imageUrl??"",unitPrice:Number(i.unitPrice),quantity:Number(i.quantity),size:i.size,color:i.color}))}},include:{items:true,user:true}});
    for(const item of snapshot){const changed=await tx.product.updateMany({where:{id:item.productId,stock:{gte:Number(item.quantity)}},data:{stock:{decrement:Number(item.quantity)}}});if(changed.count!==1)throw new Error("INSUFFICIENT_STOCK");}
    const cart=await tx.cart.findUnique({where:{userId:intent.userId}});
    if(cart) await tx.cartItem.deleteMany({where:{cartId:cart.id}});
    await tx.paymentIntent.update({where:{id:intent.id},data:{status:"CAPTURED"}});
    await tx.payment.upsert({where:{providerId:payment.providerId},update:{status:"CAPTURED",raw:payment.raw??undefined,capturedAt:new Date(),utr:payment.utr??undefined},create:{paymentIntentId:intent.id,provider:"razorpay",providerId:payment.providerId,method:payment.method,amount:intent.amount,currency:"INR",status:"CAPTURED",utr:payment.utr,raw:payment.raw,capturedAt:new Date()}});
    return order;
  });
  try{ const whatsappAdminNumber=String(await setting("whatsappAdminNumber",process.env.WHATSAPP_ADMIN_TO??"")); await notifyAdminOrderPaid({orderNumber:created.orderNumber,name:intent.user.name,phone:intent.user.phone,email:intent.user.email,total:created.total,paymentStatus:"Payment complete",address:formatAddress(address),items:created.items.map(i=>`${i.productName} × ${i.quantity} (${i.size}/${i.color})`).join("; "),to:whatsappAdminNumber}); }catch(e){ console.error("WhatsApp notify failed",e); }
  return created;
}

app.post("/api/payments/qr/create",requireAuth,async(req,res,next)=>{try{
  if(!(await razorpayEnabled()))return res.status(503).json({error:"PAYMENT_NOT_CONFIGURED"});
  const shippingMethod=z.enum(["standard","express"]).default("standard").parse(req.body?.shippingMethod??"standard");
  const address=addressSchema.parse(req.body?.address);
  const {intent}=await makePaymentIntent(req.session!.userId,"qr",shippingMethod,address);
  const configuredQrId=String(await setting("paymentRazorpayQrId",process.env.PAYMENT_RAZORPAY_QR_ID??"")).trim();
  if(configuredQrId){
    const configuredImage=String(await setting("paymentQrUrl",process.env.PAYMENT_QR_URL??""));
    await prisma.paymentIntent.update({where:{id:intent.id},data:{razorpayQrId:configuredQrId,qrImageUrl:configuredImage||null,metadata:{...paymentMeta(intent),configuredQr:true}}});
    return res.json({intentId:intent.id,amount:intent.amount,qrId:configuredQrId,imageUrl:configuredImage,staticQrUrl:configuredImage,requiresUtr:true});
  }
  try {
    const qr=await createQr(intent.amount,intent.id,intent.expiresAt);
    await prisma.paymentIntent.update({where:{id:intent.id},data:{razorpayQrId:qr.id,qrImageUrl:qr.image_url,metadata:{...paymentMeta(intent),configuredQr:false}}});
    return res.json({intentId:intent.id,amount:intent.amount,qrId:qr.id,imageUrl:qr.image_url,staticQrUrl:await setting("paymentQrUrl","")});
  }catch(qrErr:any){
    const configuredImage=String(await setting("paymentQrUrl",process.env.PAYMENT_QR_URL??""));
    if(configuredImage){
      return res.json({intentId:intent.id,amount:intent.amount,qrId:"manual_upi_ref",imageUrl:configuredImage,staticQrUrl:configuredImage,requiresUtr:true});
    }
    return res.status(502).json({error:"QR_GENERATION_FAILED",message:"Gateway QR generation failed. Please use Card / UPI / Razorpay checkout."});
  }
}catch(e){next(e)}});

app.post("/api/payments/qr/verify",requireAuth,async(req,res,next)=>{try{
  const data=z.object({intentId:z.string(),utr:z.string().trim().min(4).max(40).optional()}).parse(req.body);
  const intent=await prisma.paymentIntent.findFirst({where:{id:data.intentId,userId:req.session!.userId,razorpayQrId:{not:null}}});
  if(!intent)return res.status(404).json({error:"PAYMENT_INTENT_NOT_FOUND"});
  if(intent.expiresAt.getTime()<Date.now())return res.status(410).json({error:"PAYMENT_INTENT_EXPIRED"});
  if(!intent.razorpayQrId)return res.status(400).json({error:"QR_NOT_READY"});
  const collection=await fetchQrPayments(intent.razorpayQrId,intent.createdAt);
  const match=(collection.items??[]).find((p:any)=>p.status==="captured"&&Number(p.amount)===intent.amount*100&&(!data.utr||String(p?.acquirer_data?.rrn??p?.upi?.utr??"")===data.utr));
  if(!match)return res.json({paid:false,waiting:true,message:"Payment not verified yet. Complete the UPI payment and try again."});
  const utr=String(match?.acquirer_data?.rrn??match?.upi?.utr??"")||undefined;
  const order=await finalizePaidOrder(intent.id,{providerId:match.id,method:match.method,utr,raw:match});
  res.json({paid:true,order});
}catch(e){next(e)}});

app.post("/api/payments/checkout/order",requireAuth,async(req,res,next)=>{try{
  if(!(await razorpayEnabled()))return res.status(503).json({error:"PAYMENT_NOT_CONFIGURED"});
  const address=addressSchema.parse(req.body?.address);
  const shippingMethod=z.enum(["standard","express"]).default("standard").parse(req.body?.shippingMethod??"standard");
  const {intent}=await makePaymentIntent(req.session!.userId,"checkout",shippingMethod,address);
  const r=await razorpayCreateOrder(intent.amount,intent.id,{paymentIntentId:intent.id});
  await prisma.paymentIntent.update({where:{id:intent.id},data:{razorpayOrderId:r.id,metadata:{...paymentMeta(intent),kind:"checkout",address,shippingMethod}}});
  res.json({keyId:await publicKey(),orderId:r.id,amount:intent.amount*100,currency:"INR",intentId:intent.id,name:(await prisma.user.findUnique({where:{id:req.session!.userId}}))?.name});
}catch(e){next(e)}});

app.post("/api/payments/checkout/verify",requireAuth,async(req,res,next)=>{try{
  const d=z.object({intentId:z.string(),razorpayOrderId:z.string(),razorpayPaymentId:z.string(),razorpaySignature:z.string()}).parse(req.body);
  const intent=await prisma.paymentIntent.findFirst({where:{id:d.intentId,userId:req.session!.userId,razorpayOrderId:d.razorpayOrderId}});
  if(!intent)return res.status(404).json({error:"PAYMENT_INTENT_NOT_FOUND"});
  if(!(await verifySignature(d.razorpayOrderId,d.razorpayPaymentId,d.razorpaySignature)))return res.status(400).json({error:"INVALID_PAYMENT_SIGNATURE"});
  let p=await fetchPayment(d.razorpayPaymentId);
  if(p.status==="authorized"){
    try {
      p=await capturePayment(d.razorpayPaymentId, intent.amount);
    } catch(err) {
      console.warn("Auto-capture failed, checking status:", err);
    }
  }
  if(p.status!=="captured"&&p.status!=="authorized")return res.status(400).json({error:"PAYMENT_NOT_CAPTURED"});
  const order=await finalizePaidOrder(intent.id,{providerId:p.id,method:p.method||"card",utr:p?.acquirer_data?.rrn,raw:p});
  res.json({paid:true,order});
}catch(e){next(e)}});

app.post("/api/payments/checkout/demo-pay", requireAuth, async (req,res,next)=>{try{
  if (process.env.NODE_ENV === "production") return res.status(403).json({error:"DEMO_PAYMENT_DISABLED"});
  const d=z.object({intentId:z.string()}).parse(req.body);
  const intent=await prisma.paymentIntent.findFirst({where:{id:d.intentId,userId:req.session!.userId}});
  if(!intent)return res.status(404).json({error:"PAYMENT_INTENT_NOT_FOUND"});
  const demoPaymentId=`pay_demo_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const order=await finalizePaidOrder(intent.id,{
    providerId:demoPaymentId,
    method:"demo_test",
    utr:`DEMO${Date.now()}`,
    raw:{id:demoPaymentId,status:"captured",amount:intent.amount*100,mode:"test"}
  });
  res.json({paid:true,order});
}catch(e){next(e)}});

app.get("/api/pages/:slug", async (req,res)=>{
  const slug=routeParam(req,"slug").replace(/^\/+/,"");
  const page=await prisma.sitePage.findFirst({where:{slug,status:"PUBLISHED"},include:{sections:{where:{visible:true},orderBy:{sortOrder:"asc"}}}});
  if(!page)return res.status(404).json({error:"PAGE_NOT_FOUND"});
  res.json(page);
});
app.delete("/api/admin/audit/:id",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const existing=await prisma.auditLog.findUnique({where:{id}});if(!existing)return res.status(404).json({error:"AUDIT_NOT_FOUND"});await prisma.auditLog.delete({where:{id}});res.json({ok:true,id});}catch(e){next(e)}});
app.delete("/api/admin/audit",requireAdmin,async(req,res,next)=>{try{const ids=z.array(z.string().min(1)).max(5000).optional().parse(req.body?.ids);if(ids?.length){const out=await prisma.auditLog.deleteMany({where:{id:{in:ids}}});return res.json({ok:true,deleted:out.count});}const out=await prisma.auditLog.deleteMany({});res.json({ok:true,deleted:out.count});}catch(e){next(e)}});
app.get("/api/admin/pages",requireAdmin,async(_req,res)=>res.json(await prisma.sitePage.findMany({include:{sections:{orderBy:{sortOrder:"asc"}}},orderBy:[{isSystem:"desc"},{updatedAt:"desc"}]})));
app.put("/api/admin/pages/:id/design", requireAdmin, async (req, res, next) => {
  try {
    const data = z.object({ title: z.string().trim().min(2).max(120), status: z.enum(["PUBLISHED", "DRAFT", "ARCHIVED"]), seoTitle: z.string().max(180).nullable(), seoDescription: z.string().max(320).nullable(), sections: z.array(z.object({ id: z.string().min(1), content: z.record(z.string(), z.any()), visible: z.boolean(), sortOrder: z.number().int() })).max(200) }).parse(req.body);
    const id = routeParam(req, "id");
    const { sections, ...metadata } = data;
    const page = await prisma.$transaction(async tx => {
      const existing = await tx.siteSection.findMany({ where: { pageId: id }, select: { id: true } });
      const ids = new Set(existing.map(s => s.id));
      if (sections.some(s => !ids.has(s.id)) || new Set(sections.map(s => s.id)).size !== sections.length) throw new Error("PAGE_SECTION_MISMATCH");
      await tx.sitePage.update({ where: { id }, data: metadata });
      for (const section of sections) { const { id: sectionId, ...patch } = section; await tx.siteSection.update({ where: { id: sectionId }, data: patch }); }
      await tx.auditLog.create({ data: { actorId: req.session!.userId, action: "SAVE_PAGE_DESIGN", entity: "SitePage", entityId: id, details: { sections: sections.length } } });
      return tx.sitePage.findUniqueOrThrow({ where: { id }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
    });
    res.json(page);
  } catch (error) { next(error); }
});
app.post("/api/admin/pages",requireAdmin,async(req,res,next)=>{try{const d=z.object({slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),title:z.string().trim().min(2).max(120),status:z.enum(["PUBLISHED","DRAFT","ARCHIVED"]).default("DRAFT"),seoTitle:z.string().trim().max(180).optional(),seoDescription:z.string().trim().max(320).optional()}).parse(req.body);const page=await prisma.sitePage.create({data:{...d,isSystem:false}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"CREATE_PAGE",entity:"SitePage",entityId:page.id,details:{slug:d.slug}}});res.status(201).json({...page,sections:[]});}catch(e){next(e)}});
app.patch("/api/admin/pages/:id",requireAdmin,async(req,res,next)=>{try{const d=z.object({slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),title:z.string().trim().min(2).max(120).optional(),status:z.enum(["PUBLISHED","DRAFT","ARCHIVED"]).optional(),seoTitle:z.string().trim().max(180).nullable().optional(),seoDescription:z.string().trim().max(320).nullable().optional()}).parse(req.body);const page=await prisma.sitePage.update({where:{id:routeParam(req,"id")},data:d,include:{sections:{orderBy:{sortOrder:"asc"}}}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UPDATE_PAGE",entity:"SitePage",entityId:page.id,details:d}});res.json(page);}catch(e){next(e)}});
app.delete("/api/admin/pages/:id",requireAdmin,async(req,res,next)=>{try{const page=await prisma.sitePage.findUnique({where:{id:routeParam(req,"id")}});if(!page)return res.status(404).json({error:"PAGE_NOT_FOUND"});if(CORE_SLUGS.includes(page.slug)||cmsDefaultPages.some(d=>d.slug===page.slug))return res.status(409).json({error:"CORE_PAGE_CANNOT_BE_DELETED"});await prisma.sitePage.delete({where:{id:page.id}});try{const row=await prisma.siteSetting.findUnique({where:{key:"navLinks"}});if(row){const nav=JSON.parse(String(row.value||"[]"));if(Array.isArray(nav)){const kept=nav.filter((x:any)=>x&&x.route!==`/${page.slug}`&&x.route!==`/custom-pages/${page.slug}`);if(kept.length!==nav.length)await prisma.siteSetting.update({where:{key:"navLinks"},data:{value:JSON.stringify(kept)}})}}}catch{}await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DELETE_PAGE",entity:"SitePage",entityId:page.id,details:{slug:page.slug}}});res.json({ok:true});}catch(e){next(e)}});
app.post("/api/admin/pages/:id/sections",requireAdmin,async(req,res,next)=>{try{const d=z.object({type:z.enum([...CIN_TYPES,"HERO","IMAGE_TEXT","IMAGE_GRID","PRODUCT_GRID","COLLECTION_GRID","RICH_TEXT","BANNER","VIDEO","NEWSLETTER","FAQ","SPACER","NATIVE","AUTH","HERO_SLIDER","BENEFITS","FREEFORM"]),sortOrder:z.number().int().default(0),visible:z.boolean().default(true),content:z.record(z.string(),z.any()).default({})}).parse(req.body);const section=await prisma.siteSection.create({data:{...d,pageId:routeParam(req,"id")}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"CREATE_SECTION",entity:"SiteSection",entityId:section.id,details:{pageId:section.pageId,type:d.type}}});res.status(201).json(section);}catch(e){next(e)}});
app.patch("/api/admin/sections/:id",requireAdmin,async(req,res,next)=>{try{const d=z.object({type:z.enum([...CIN_TYPES,"HERO","IMAGE_TEXT","IMAGE_GRID","PRODUCT_GRID","COLLECTION_GRID","RICH_TEXT","BANNER","VIDEO","NEWSLETTER","FAQ","SPACER","NATIVE","AUTH","HERO_SLIDER","BENEFITS","FREEFORM"]).optional(),sortOrder:z.number().int().optional(),visible:z.boolean().optional(),content:z.record(z.string(),z.any()).optional()}).parse(req.body);
    if(d.content && Array.isArray(d.content.rotationImages) && d.content.rotationImages.length){
      const wanted=d.content.rotationImages.map((x:any)=>String(x).trim()).filter(Boolean);
      const products=await prisma.product.findMany({where:{status:{not:"ARCHIVED"}},select:{images:true}});
      const allowed=new Set(products.flatMap(p=>Array.isArray(p.images)?p.images.map(String):[]));
      const invalid=wanted.filter((x:string)=>!allowed.has(x));
      if(invalid.length)return res.status(400).json({error:"ROTATION_IMAGES_MUST_BE_REAL_PRODUCT_IMAGES",invalid});
      d.content={...d.content,rotationImages:wanted};
    }
    const section=await prisma.siteSection.update({where:{id:routeParam(req,"id")},data:d});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UPDATE_SECTION",entity:"SiteSection",entityId:section.id,details:d}});res.json(section);}catch(e){next(e)}});
app.delete("/api/admin/sections/:id",requireAdmin,async(req,res,next)=>{try{await prisma.siteSection.delete({where:{id:routeParam(req,"id")}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DELETE_SECTION",entity:"SiteSection",entityId:routeParam(req,"id")}});res.json({ok:true});}catch(e){next(e)}});
app.post("/api/admin/sections/:id/duplicate",requireAdmin,async(req,res,next)=>{try{const source=await prisma.siteSection.findUnique({where:{id:routeParam(req,"id")}});if(!source)return res.status(404).json({error:"SECTION_NOT_FOUND"});const section=await prisma.siteSection.create({data:{pageId:source.pageId,type:source.type,sortOrder:source.sortOrder+1,visible:source.visible,content:source.content as any}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DUPLICATE_SECTION",entity:"SiteSection",entityId:section.id,details:{sourceId:source.id,type:source.type,pageId:source.pageId}}});res.status(201).json(section);}catch(e){next(e)}});

app.get("/api/admin/stats",requireAdmin,async(_req,res)=>{const [users,products,categories,orders,revenue,lowStock]=await Promise.all([prisma.user.count({where:{role:"USER",deletedAt:null}}),prisma.product.count({where:{status:{not:"ARCHIVED"}}}),prisma.category.count(),prisma.order.count(),prisma.order.aggregate({where:{paymentStatus:"CAPTURED"},_sum:{total:true}}),prisma.product.count({where:{status:"ACTIVE",stock:{lt:6}}})]);res.json({users,products,categories,orders,revenue:revenue._sum.total??0,lowStock})});
app.get("/api/admin/users",requireAdmin,async(req,res)=>{const q=String(req.query.q??"");const users=await prisma.user.findMany({where:{deletedAt:null,...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}},{phone:{contains:q}}]}:{})},select:{id:true,name:true,email:true,phone:true,role:true,createdAt:true,blockedAt:true},orderBy:{createdAt:"desc"},take:250});res.json(users)});
app.get("/api/admin/users/:id",requireAdmin,async(req,res)=>{const u=await prisma.user.findUnique({where:{id:routeParam(req,"id")},include:{addresses:true,orders:{include:{items:true},orderBy:{createdAt:"desc"}},wishlist:{include:{product:true}},cart:{include:{items:{include:{product:true}}}},paymentIntents:{include:{payments:true,order:{select:{orderNumber:true,status:true,total:true}}},orderBy:{createdAt:"desc"}}}});if(!u)return res.status(404).json({error:"USER_NOT_FOUND"});res.json({user:safeUser(u),addresses:u.addresses,orders:u.orders,wishlist:u.wishlist.map(w=>w.product),cart:u.cart?.items??[],paymentIntents:u.paymentIntents});});
app.patch("/api/admin/users/:id",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const u=await prisma.user.findUnique({where:{id}});if(!u)return res.status(404).json({error:"USER_NOT_FOUND"});if(u.role==="ADMIN")return res.status(403).json({error:"ADMIN_ACCOUNT_PROTECTED"});const d=z.object({name:z.string().trim().min(2).max(80).optional(),phone:phoneSchema.optional()}).parse(req.body);const updated=await prisma.user.update({where:{id},data:d,select:{id:true,name:true,email:true,phone:true,role:true,createdAt:true,blockedAt:true}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UPDATE_USER",entity:"User",entityId:id,details:d}});res.json(updated);}catch(e){next(e)}});
app.post("/api/admin/users/:id/unblock",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const u=await prisma.user.findUnique({where:{id},include:{addresses:true}});if(!u)return res.status(404).json({error:"USER_NOT_FOUND"});await prisma.blockedIdentity.deleteMany({where:{OR:[{emailHash:hashEmail(u.email)},{phoneHash:hashIdentity(normalizePhone(u.phone))},...u.addresses.map(a=>({addressHash:hashAddress(a)}))]}});await prisma.user.update({where:{id},data:{blockedAt:null}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UNBLOCK_USER",entity:"User",entityId:id,details:{emailDomain:u.email.split("@")[1]}}});res.json({ok:true});}catch(e){next(e)}});
app.post("/api/admin/users/:id/block",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const u=await prisma.user.findUnique({where:{id},include:{addresses:true}});if(!u)return res.status(404).json({error:"USER_NOT_FOUND"});if(u.role==="ADMIN")return res.status(403).json({error:"ADMIN_ACCOUNT_PROTECTED"});const reason=z.string().trim().max(300).optional().parse(req.body?.reason);const existing=await prisma.blockedIdentity.findFirst({where:{OR:[{emailHash:hashEmail(u.email)},{phoneHash:hashIdentity(normalizePhone(u.phone))},...u.addresses.map(a=>({addressHash:hashAddress(a)}))]}});if(!existing){await prisma.blockedIdentity.create({data:{emailHash:hashEmail(u.email),phoneHash:hashIdentity(normalizePhone(u.phone)),reason,blockedBy:req.session!.userId}});for(const a of u.addresses){await prisma.blockedIdentity.create({data:{addressHash:hashAddress(a),reason,blockedBy:req.session!.userId}});}}await prisma.user.update({where:{id},data:{blockedAt:new Date()}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"BLOCK_USER",entity:"User",entityId:id,details:{emailDomain:u.email.split("@")[1],reason}}});res.json({ok:true});}catch(e){next(e)}});
app.delete("/api/admin/users/:id",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const u=await prisma.user.findUnique({where:{id},include:{addresses:true}});if(!u)return res.status(404).json({error:"USER_NOT_FOUND"});if(u.role==="ADMIN")return res.status(403).json({error:"ADMIN_ACCOUNT_PROTECTED"});await prisma.blockedIdentity.create({data:{emailHash:hashEmail(u.email),phoneHash:hashIdentity(normalizePhone(u.phone)),reason:"ADMIN_DELETE",blockedBy:req.session!.userId}});for(const a of u.addresses){await prisma.blockedIdentity.create({data:{addressHash:hashAddress(a),reason:"ADMIN_DELETE",blockedBy:req.session!.userId}});}await prisma.$transaction([prisma.address.deleteMany({where:{userId:id}}),prisma.wishlistItem.deleteMany({where:{userId:id}}),prisma.cartItem.deleteMany({where:{cart:{userId:id}}}),prisma.cart.deleteMany({where:{userId:id}}),prisma.user.update({where:{id},data:{name:"Deleted Customer",email:`deleted-${crypto.randomUUID()}@invalid.local`,phone:`DELETED-${crypto.randomUUID()}`,passwordHash:await bcrypt.hash(crypto.randomUUID(),12),emailVerifiedAt:null,phoneVerifiedAt:null,deletedAt:new Date()}})]);await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DELETE_USER",entity:"User",entityId:id,details:{emailDomain:u.email.split("@")[1],retainedForOrderHistory:true}}});res.json({ok:true});}catch(e){next(e)}});

app.get("/api/admin/orders",requireAdmin,async(req,res)=>{const orders=await prisma.order.findMany({include:{user:{select:{id:true,name:true,email:true,phone:true}},items:true,paymentIntent:{include:{payments:true}}},orderBy:{createdAt:"desc"},take:250});res.json(orders)});
app.get("/api/admin/payments",requireAdmin,async(_req,res)=>{const rows=await prisma.paymentIntent.findMany({include:{user:{select:{id:true,name:true,email:true,phone:true}},payments:true,order:{select:{id:true,orderNumber:true,status:true,total:true}}},orderBy:{createdAt:"desc"},take:250});res.json(rows)});

// Manual recovery for captured payments whose order could not be created (e.g. stock changed after capture).
app.post("/api/admin/payments/:id/refund",requireAdmin,async(req,res,next)=>{
  let claimedPaymentId:string|undefined;
  try {
    const id=routeParam(req,"id");
    const intent=await prisma.paymentIntent.findUnique({where:{id},include:{payments:true,order:true}});
    if(!intent)return res.status(404).json({error:"PAYMENT_INTENT_NOT_FOUND"});
    if(intent.order)return res.status(409).json({error:"ORDER_REFUND_ROUTE_REQUIRED"});
    const captured=intent.payments.find((p:any)=>p.status==="CAPTURED");
    if(!captured){
      if(intent.status==="REFUNDED"&&intent.payments.some((p:any)=>p.status==="REFUNDED"))return res.json({ok:true,alreadyRefunded:true,status:"REFUNDED"});
      if(intent.payments.some((p:any)=>p.status==="PENDING"))return res.status(409).json({error:"PAYMENT_ACTION_IN_PROGRESS"});
      return res.status(409).json({error:"CAPTURED_PAYMENT_NOT_FOUND"});
    }
    if(captured.amount!==intent.amount||captured.currency.toUpperCase()!==intent.currency.toUpperCase())return res.status(409).json({error:"PAYMENT_INTENT_MISMATCH"});
    const claim=await prisma.payment.updateMany({where:{id:captured.id,status:"CAPTURED"},data:{status:"PENDING"}});
    if(claim.count!==1)return res.status(409).json({error:"PAYMENT_ACTION_IN_PROGRESS"});
    claimedPaymentId=captured.id;
    let providerRefund:any;
    try { providerRefund=await refundPayment(captured.providerId,{amountMinor:intent.amount*100,currency:intent.currency}); }
    catch(error){await prisma.payment.updateMany({where:{id:captured.id,status:"PENDING"},data:{status:"CAPTURED"}});claimedPaymentId=undefined;throw error;}
    try {
      await prisma.$transaction(async tx=>{
        const originalRaw=captured.raw&&typeof captured.raw==="object"&&!Array.isArray(captured.raw)?captured.raw as Record<string,any>:{providerPaymentRaw:captured.raw??null};
        await tx.payment.update({where:{id:captured.id},data:{status:"REFUNDED",raw:{...originalRaw,atelierRefund:{status:"REFUNDED",providerResult:providerRefund,recordedAt:new Date().toISOString(),reason:"CAPTURED_PAYMENT_WITHOUT_ORDER"}}}});
        await tx.paymentIntent.update({where:{id:intent.id},data:{status:"REFUNDED"}});
      });
      claimedPaymentId=undefined;
    } catch(error) {
      // Keep the claim retryable. A retry re-checks the provider's amount_refunded before issuing a new refund.
      await prisma.payment.updateMany({where:{id:captured.id,status:"PENDING"},data:{status:"CAPTURED"}});
      claimedPaymentId=undefined;
      throw error;
    }
    await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"REFUND_UNMATCHED_PAYMENT",entity:"PaymentIntent",entityId:intent.id,details:{providerPaymentId:captured.providerId,amount:intent.amount,currency:intent.currency,reason:"CAPTURED_PAYMENT_WITHOUT_ORDER",providerRefund}}});
    res.json({ok:true,status:"REFUNDED",paymentIntentId:intent.id,providerPaymentId:captured.providerId});
  } catch(e){if(claimedPaymentId)await prisma.payment.updateMany({where:{id:claimedPaymentId,status:"PENDING"},data:{status:"CAPTURED"}});next(e)}
});
app.patch("/api/admin/orders/:id",requireAdmin,async(req,res,next)=>{
  let claimedPaymentId:string|undefined;
  try {
    const status=z.enum(["PAID","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"]).parse(req.body.status);
    const id=routeParam(req,"id");
    const current=await prisma.order.findUnique({where:{id},include:{items:true,paymentIntent:{include:{payments:true}}}});
    if(!current)return res.status(404).json({error:"ORDER_NOT_FOUND"});
    if(!(ORDER_TRANSITIONS[current.status]||[]).includes(status))return res.status(409).json({error:"INVALID_ORDER_TRANSITION",from:current.status,to:status});
    const isRefundAction=status==="REFUNDED"||status==="CANCELLED";
    if(isRefundAction && current.paymentStatus==="PENDING")return res.status(409).json({error:"PAYMENT_ACTION_IN_PROGRESS"});
    const needsProviderRefund=isRefundAction && current.paymentStatus==="CAPTURED";
    let refundResult:any=null;
    let paymentRecord:any=null;
    if(needsProviderRefund){
      paymentRecord=current.paymentIntent?.payments.find((p:any)=>p.status==="CAPTURED");
      if(!paymentRecord)return res.status(409).json({error:"CAPTURED_PAYMENT_RECORD_MISSING"});
      const claim=await prisma.payment.updateMany({where:{id:paymentRecord.id,status:"CAPTURED"},data:{status:"PENDING"}});
      if(claim.count!==1)return res.status(409).json({error:"PAYMENT_ACTION_IN_PROGRESS"});
      claimedPaymentId=paymentRecord.id;
      try { refundResult=await refundPayment(paymentRecord.providerId,{amountMinor:current.paymentIntent.amount*100,currency:current.paymentIntent.currency}); }
      catch(error) {
        await prisma.payment.updateMany({where:{id:paymentRecord.id,status:"PENDING"},data:{status:"CAPTURED"}});
        claimedPaymentId=undefined;
        throw error;
      }
    } else if(isRefundAction && current.paymentStatus!=="REFUNDED") {
      return res.status(409).json({error:"PAYMENT_NOT_CAPTURED"});
    }
    let o:any;
    try {
      o=await prisma.$transaction(async tx=>{
        const updated=await tx.order.update({where:{id},data:{status,paymentStatus:(needsProviderRefund||current.paymentStatus==="REFUNDED"?"REFUNDED":current.paymentStatus)},include:{items:true,user:true}});
        if(needsProviderRefund && paymentRecord){
          const originalRaw=paymentRecord.raw&&typeof paymentRecord.raw==="object"&&!Array.isArray(paymentRecord.raw)?paymentRecord.raw as Record<string,any>: {providerPaymentRaw:paymentRecord.raw??null};
          await tx.payment.update({where:{id:paymentRecord.id},data:{status:"REFUNDED",raw:{...originalRaw,atelierRefund:{status:"REFUNDED",providerResult:refundResult,recordedAt:new Date().toISOString()}}}});
          await tx.paymentIntent.update({where:{id:current.paymentIntent.id},data:{status:"REFUNDED"}});
        }
        if(status==="CANCELLED" && ["PAID","PROCESSING"].includes(current.status)){
          for(const item of current.items)await tx.product.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
        }
        return updated;
      });
      claimedPaymentId=undefined;
    } catch(error) {
      if(claimedPaymentId)await prisma.payment.updateMany({where:{id:claimedPaymentId,status:"PENDING"},data:{status:"CAPTURED"}});
      throw error;
    }
    await prisma.auditLog.create({data:{actorId:req.session!.userId,action:needsProviderRefund?"REFUND_ORDER":"UPDATE_STATUS",entity:"Order",entityId:o.id,details:{from:current.status,status,providerRefund:needsProviderRefund?refundResult:null}}});
    res.json(o);
  } catch(e){next(e)}
});
function validateProductCollection(gender:string, collectionType:string){ if(gender==="Men" && collectionType!=="MEN") throw new Error("MEN_PRODUCTS_MUST_USE_MEN_COLLECTION"); if(gender==="Women" && collectionType==="MEN") throw new Error("WOMEN_PRODUCTS_CANNOT_USE_MEN_COLLECTION"); return collectionType; }

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const uploadDir=path.resolve(__dirname,"../../frontend/public/images/uploads");

app.post("/api/admin/pages/:id/reset",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const pg0=await prisma.sitePage.findUnique({where:{id}});if(pg0)await saveSnapshot(prisma,{kind:"PRE_RESET",label:`Automatic backup before resetting page "${pg0.title}"`,actorId:req.session!.userId});const out=await resetPageToDefaults(prisma,id);if(!out)return res.status(404).json({error:"NO_DEFAULT_FOR_PAGE"});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"RESET_PAGE",entity:"SitePage",entityId:id,details:{resetToDefault:true}}});res.json(out)}catch(e){next(e)}});

app.post("/api/admin/site/reset", requireAdmin, express.json({ limit: "1kb" }), async (req,res,next) => {
  try {
    z.object({ confirmation: z.literal("RESET WEBSITE") }).parse(req.body);
    const out = await factoryReset(prisma, req.session!.userId);
    await prisma.auditLog.create({ data: { actorId: req.session!.userId, action: "RESET_WEBSITE_DESIGN", entity: "SitePage", details: { removedCustomPages: out.removedCustomPages, backupSnapshotId: out.backupId, operationalDataPreserved: true } } });
    const pages = await prisma.sitePage.findMany({ include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }] });
    const settings = await settingsMap();
    for (const [k,v] of Object.entries(DESIGN_DEFAULT_SETTINGS)) if (settings[k]===undefined||settings[k]===null) settings[k]=v;
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, pages, settings, removedCustomPages: out.removedCustomPages, backupSnapshotId: out.backupId });
  } catch (e:any) {
    if (e?.name === "ZodError") return res.status(400).json({ error: "RESET_CONFIRMATION_REQUIRED" });
    next(e);
  }
});

// ---- Website history: one end-of-day snapshot per date + manual checkpoints ----
const snapshotMeta = (r:any)=>({ id:r.id, kind:r.kind, dateKey:r.dateKey, label:r.label, pageCount:r.pageCount, sectionCount:r.sectionCount, createdAt:r.createdAt, updatedAt:r.updatedAt });
app.get("/api/admin/site/snapshots", requireAdmin, async (_req,res,next) => { try {
  const rows = await prisma.siteDesignSnapshot.findMany({ orderBy: { updatedAt: "desc" }, take: 400, select: { id:true, kind:true, dateKey:true, label:true, pageCount:true, sectionCount:true, createdAt:true, updatedAt:true } });
  res.setHeader("Cache-Control","no-store"); res.json({ today: dayKey(), snapshots: rows.map(snapshotMeta) });
} catch(e){ next(e) } });
app.post("/api/admin/site/snapshots", requireAdmin, express.json({ limit:"4kb" }), async (req,res,next) => { try {
  const d = z.object({ label: z.string().trim().max(120).optional() }).parse(req.body ?? {});
  const row = await saveSnapshot(prisma, { kind:"MANUAL", label: d.label || "Manual checkpoint", actorId:req.session!.userId });
  await prisma.auditLog.create({ data:{ actorId:req.session!.userId, action:"SAVE_SITE_CHECKPOINT", entity:"SiteDesignSnapshot", entityId:row.id, details:{ label:row.label } } });
  res.status(201).json(snapshotMeta(row));
} catch(e){ next(e) } });
app.post("/api/admin/site/snapshots/:id/restore", requireAdmin, express.json({ limit:"1kb" }), async (req,res,next) => { try {
  z.object({ confirmation: z.literal("RESTORE") }).parse(req.body);
  const out = await restoreSnapshot(prisma, routeParam(req,"id"), req.session!.userId);
  if (!out) return res.status(404).json({ error:"SNAPSHOT_NOT_FOUND" });
  await prisma.auditLog.create({ data:{ actorId:req.session!.userId, action:"RESTORE_SITE_SNAPSHOT", entity:"SiteDesignSnapshot", entityId:out.snapshot.id, details:{ dateKey:out.snapshot.dateKey, backupSnapshotId:out.backupId } } });
  const pages = await prisma.sitePage.findMany({ include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }] });
  const settings = await settingsMap();
  for (const [k,v] of Object.entries(DESIGN_DEFAULT_SETTINGS)) if (settings[k]===undefined||settings[k]===null) settings[k]=v;
  res.setHeader("Cache-Control","no-store"); res.json({ ok:true, pages, settings, restored:snapshotMeta(out.snapshot), backupSnapshotId:out.backupId });
} catch(e:any){ if (e?.name==="ZodError") return res.status(400).json({ error:"RESTORE_CONFIRMATION_REQUIRED" }); next(e) } });
app.delete("/api/admin/site/snapshots/:id", requireAdmin, async (req,res,next) => { try {
  const id = routeParam(req,"id"); const row = await prisma.siteDesignSnapshot.findUnique({ where:{ id } });
  if (!row) return res.status(404).json({ error:"SNAPSHOT_NOT_FOUND" });
  await prisma.siteDesignSnapshot.delete({ where:{ id } }); res.json({ ok:true });
} catch(e){ next(e) } });

// ---- Payment configuration (Razorpay) ----
app.get("/api/admin/payment-config", requireAdmin, async (req,res,next) => { try {
  res.setHeader("Cache-Control","no-store");
  res.json({ ...(await describeConfig()), webhookUrl: `${req.protocol}://${req.get("host")}/api/webhooks/razorpay`, webhookEvents:["payment.captured"] });
} catch(e){ next(e) } });
app.put("/api/admin/payment-config", requireAdmin, express.json({ limit:"8kb" }), async (req,res,next) => { try {
  const d = z.object({ keyId: z.string().trim().max(80).optional(), keySecret: z.string().trim().max(120).optional(), webhookSecret: z.string().trim().max(160).optional(), clearWebhookSecret: z.boolean().optional(), enabled: z.boolean().default(true) }).parse(req.body);
  const prev = await readStored();
  const keyId = (d.keyId || prev?.keyId || "").trim(); const keySecret = (d.keySecret || prev?.keySecret || "").trim();
  if (!validateKeyId(keyId)) return res.status(400).json({ error:"INVALID_RAZORPAY_KEY_ID", message:"Key ID must look like rzp_test_xxxxxxxx or rzp_live_xxxxxxxx" });
  if (keySecret.length < 10) return res.status(400).json({ error:"RAZORPAY_KEY_SECRET_REQUIRED" });
  const webhookSecret = d.clearWebhookSecret ? "" : (d.webhookSecret || prev?.webhookSecret || "");
  await writeStored({ keyId, keySecret, webhookSecret, enabled: d.enabled, updatedAt: new Date().toISOString() });
  await prisma.auditLog.create({ data:{ actorId:req.session!.userId, action:"SAVE_PAYMENT_CONFIG", entity:"PaymentConfig", details:{ keyId, mode:modeOf(keyId), enabled:d.enabled, webhookSecretSet:Boolean(webhookSecret) } } });
  res.json(await describeConfig());
} catch(e:any){ if (e?.name==="ZodError") return res.status(400).json({ error:"INVALID_PAYMENT_CONFIG" }); next(e) } });
app.post("/api/admin/payment-config/test", requireAdmin, express.json({ limit:"8kb" }), async (req,res,next) => { try {
  const d = z.object({ keyId: z.string().trim().max(80).optional(), keySecret: z.string().trim().max(120).optional() }).parse(req.body ?? {});
  const prev = await readStored();
  const keyId = d.keyId || prev?.keyId || process.env.RAZORPAY_KEY_ID || ""; const keySecret = d.keySecret || prev?.keySecret || process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) return res.status(400).json({ ok:false, message:"Enter a Key ID and Key Secret first." });
  res.json({ ...(await testCreds(keyId, keySecret)), mode: modeOf(keyId) });
} catch(e:any){ res.status(502).json({ ok:false, message:`Could not reach Razorpay: ${e?.message||e}` }) } });
app.delete("/api/admin/payment-config", requireAdmin, async (req,res,next) => { try {
  await clearStored(); await prisma.auditLog.create({ data:{ actorId:req.session!.userId, action:"CLEAR_PAYMENT_CONFIG", entity:"PaymentConfig" } });
  res.json(await describeConfig());
} catch(e){ next(e) } });

app.get("/api/pages",async(_req,res)=>res.json(await prisma.sitePage.findMany({where:{status:"PUBLISHED"},select:{slug:true,title:true,isSystem:true},orderBy:{title:"asc"}})));
app.use("/uploads",express.static(uploadDir,{maxAge:"7d"}));
app.get("/api/admin/media",requireAdmin,async(_req,res,next)=>{
  try{
    await fs.mkdir(uploadDir,{recursive:true});
    const names=await fs.readdir(uploadDir);
    const allowed=/\.(?:jpe?g|png|webp)$/i;
    const rows=[];
    for(const name of names){
      if(!allowed.test(name))continue;
      const st=await fs.stat(path.join(uploadDir,name));
      if(!st.isFile())continue;
      rows.push({name,bytes:st.size,updatedAt:st.mtime.toISOString(),url:`/uploads/${encodeURIComponent(name)}`});
    }
    rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.json(rows.slice(0,500));
  }catch(e){next(e)}
});
const adminAIProviderSchema = z.object({
  id: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(80),
  preset: z.enum(["openai","gemini","anthropic","groq","openrouter","deepseek","mistral","custom_openai","custom_json"]),
  mode: z.enum(["url","json"]),
  apiKey: z.string().max(2000).optional(),
  clearApiKey: z.boolean().optional(),
  endpoint: z.string().max(1600).optional().default(""),
  imageEndpoint: z.string().max(1600).optional().default(""),
  model: z.string().max(200).optional().default(""),
  imageModel: z.string().max(200).optional().default(""),
  tryOnModel: z.string().max(200).optional().default(""),
  enabled: z.boolean().optional().default(true),
  supportsChat: z.boolean().optional().default(false),
  supportsImage: z.boolean().optional().default(false),
  supportsTryOn: z.boolean().optional().default(false),
  defaultChat: z.boolean().optional().default(false),
  defaultImage: z.boolean().optional().default(false),
  defaultTryOn: z.boolean().optional().default(false),
  chatHeadersJson: z.string().max(10000).optional().default("{}"),
  chatBodyTemplate: z.string().max(30000).optional().default(""),
  chatResponsePath: z.string().max(200).optional().default("choices.0.message.content"),
  imageHeadersJson: z.string().max(10000).optional().default("{}"),
  imageBodyTemplate: z.string().max(30000).optional().default(""),
  imageResponsePath: z.string().max(200).optional().default("data.0.b64_json"),
  tryOnMode: z.enum(["url","json"]).optional().default("json"),
  tryOnEndpoint: z.string().max(1600).optional().default(""),
  tryOnHeadersJson: z.string().max(10000).optional().default("{}"),
  tryOnBodyTemplate: z.string().max(30000).optional().default(""),
  tryOnResponsePath: z.string().max(200).optional().default("image_url")
});
app.get("/api/admin/ai/providers",requireAdmin,async(_req,res,next)=>{try{res.setHeader("Cache-Control","no-store");res.json({providers:await listAIProviders()})}catch(e){next(e)}});
app.post("/api/admin/ai/providers",requireAdmin,async(req,res,next)=>{
  try{
    const payload=adminAIProviderSchema.parse(req.body);
    const providers=await saveAIProvider(payload);
    await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"SAVE_AI_PROVIDER",entity:"AIProvider",entityId:payload.id||undefined,details:{name:payload.name,preset:payload.preset,supportsChat:payload.supportsChat,supportsImage:payload.supportsImage,defaultChat:payload.defaultChat,defaultImage:payload.defaultImage}}});
    res.setHeader("Cache-Control","no-store");res.json({providers});
  }catch(e:any){
    const message=String(e?.message||"AI_PROVIDER_SAVE_FAILED");
    if(message.startsWith("AI_PROVIDER_") && !message.includes("\n")) return res.status(400).json({error:message.split(":")[0]});
    next(e);
  }
});
app.delete("/api/admin/ai/providers/:id",requireAdmin,async(req,res,next)=>{
  try{const id=routeParam(req,"id");const providers=await deleteAIProvider(id);await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DELETE_AI_PROVIDER",entity:"AIProvider",entityId:id,details:{deleted:true}}});res.json({providers})}catch(e){next(e)}
});
app.post("/api/admin/ai/providers/:id/test",aiImageGenerationRateLimit,requireAdmin,async(req,res,next)=>{
  try{
    const d=z.object({capability:z.enum(["chat","image"])}).parse(req.body);
    if(d.capability==="chat"){
      const out=await testAIProvider(routeParam(req,"id"),"chat");
      await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"TEST_AI_PROVIDER",entity:"AIProvider",entityId:routeParam(req,"id"),details:{capability:"chat",ok:true}}});
      return res.json(out);
    }
    const out=await testAIProvider(routeParam(req,"id"),"image");
    await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"TEST_AI_PROVIDER",entity:"AIProvider",entityId:routeParam(req,"id"),details:{capability:"image",ok:true}}});
    return res.json(out);
  }catch(e:any){
    const message=String(e?.message||"AI_PROVIDER_TEST_FAILED");
    const code=message.split(":")[0];
    const status=code.includes("AUTH_FAILED")?401:code.includes("RATE_LIMITED")?429:code.includes("TIMEOUT")?504:code.includes("NOT_FOUND")?404:400;
    return res.status(status).json({error:/^AI_PROVIDER_[A-Z0-9_]+$/.test(code)?code:"AI_PROVIDER_TEST_FAILED"});
  }
});

app.post("/api/admin/images/upload",requireAdmin,express.json({limit:"12mb"}),async(req,res,next)=>{
  try{
    const d=z.object({filename:z.string().trim().min(1).max(180),dataUrl:z.string().min(1).max(11_000_000)}).parse(req.body);
    const m=d.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if(!m)return res.status(400).json({error:"INVALID_IMAGE_DATA"});
    const ext=m[1].toLowerCase().replace("jpeg","jpg").split("/")[1];
    const original=d.filename.replace(/[^A-Za-z0-9._-]+/g,"-").replace(/\.{2,}/g,".").slice(0,100);
    const stem=original.replace(/\.[^.]+$/i,"").replace(/-+$/g,"")||"product-image";
    const filename=`${stem}-${crypto.randomUUID()}.${ext}`;
    const buffer=Buffer.from(m[2],"base64");
    if(buffer.byteLength>8*1024*1024)return res.status(413).json({error:"IMAGE_TOO_LARGE"});
    await fs.mkdir(uploadDir,{recursive:true});
    await fs.writeFile(path.join(uploadDir,filename),buffer,{flag:"wx"});
    res.status(201).json({url:`/images/uploads/${filename}`});
  }catch(e){next(e)}
});

app.post("/api/admin/ai/generate-image",aiImageGenerationRateLimit,requireAdmin,async(req,res,next)=>{
  try{
    const d=z.object({prompt:z.string().trim().min(5).max(1200),referenceImage:z.string().max(11_500_000).optional()}).parse(req.body);
    if(!await hasConfiguredImageGenerator())return res.status(503).json({error:"IMAGE_GENERATION_NOT_CONFIGURED"});
    let generated: Awaited<ReturnType<typeof generateConfiguredImage>>;
    try { generated=await generateConfiguredImage(d.prompt, d.referenceImage); }
    catch(e:any){
      const code=String(e?.message||"IMAGE_GENERATION_FAILED");
      const status=code==="IMAGE_GENERATION_NOT_CONFIGURED"?503:code==="IMAGE_GENERATION_RATE_LIMITED"?429:code==="IMAGE_GENERATION_TIMEOUT"?504:502;
      const safeCode=/^(?:AI_HORDE|AI_PROVIDER|IMAGE_GENERATION|IMAGE_API|GEMINI)_[A-Z0-9_]+$/.test(code)?code:"IMAGE_GENERATION_FAILED";
      return res.status(status).json({error:safeCode});
    }
    const filename=`ai-fashion-${crypto.randomUUID()}.${generated.extension}`;
    await fs.mkdir(uploadDir,{recursive:true});
    await fs.writeFile(path.join(uploadDir,filename),generated.buffer,{flag:"wx"});
    await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"AI_IMAGE_GENERATION",entity:"MediaAsset",entityId:filename,details:{provider:generated.provider,prompt:d.prompt.slice(0,240),bytes:generated.buffer.byteLength,seed:generated.seed??null,model:generated.model??null}}});
    res.status(201).json({url:`/images/uploads/${filename}`,name:filename,bytes:generated.buffer.byteLength,provider:generated.provider,seed:generated.seed??null});
  }catch(e){next(e)}
});

app.get("/api/admin/products",requireAdmin,async(_req,res)=>res.json(await prisma.product.findMany({include:{category:true},orderBy:{createdAt:"desc"}})));
app.post("/api/admin/products",requireAdmin,async(req,res,next)=>{try{const d=z.object({sku:z.string().min(2),name:z.string().min(2),slug:z.string().min(2),price:z.number().int().nonnegative(),categoryId:z.string(),gender:z.enum(["Men","Women"]),type:z.string(),description:z.string(),colors:z.array(z.string()).min(1),sizes:z.array(z.string()).min(1),images:z.array(imageRefSchema).min(1).max(12),stock:z.number().int().nonnegative(),collectionType:z.enum(["MEN","WOMEN_INDO_WESTERN","WOMEN_WESTERN"]).optional(),featured:z.boolean().default(false),newArrival:z.boolean().default(false),bestSeller:z.boolean().default(false),status:z.enum(["ACTIVE","DRAFT","ARCHIVED"]).default("ACTIVE")}).parse(req.body);const normalizedCollection=validateProductCollection(d.gender,d.collectionType??collectionTypeFor(d)); const p=await prisma.product.create({data:{...d,collectionType:normalizedCollection}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"CREATE",entity:"Product",entityId:p.id,details:d}});res.status(201).json(p)}catch(e){next(e)}});
app.patch("/api/admin/products/:id",requireAdmin,async(req,res,next)=>{try{const d=z.object({name:z.string().min(2).optional(),slug:z.string().min(2).optional(),price:z.number().int().nonnegative().optional(),categoryId:z.string().optional(),gender:z.enum(["Men","Women"]).optional(),type:z.string().optional(),description:z.string().optional(),colors:z.array(z.string()).min(1).optional(),sizes:z.array(z.string()).min(1).optional(),images:z.array(imageRefSchema).min(1).max(12).optional(),stock:z.number().int().nonnegative().optional(),collectionType:z.enum(["MEN","WOMEN_INDO_WESTERN","WOMEN_WESTERN"]).optional(),featured:z.boolean().optional(),newArrival:z.boolean().optional(),bestSeller:z.boolean().optional(),status:z.enum(["ACTIVE","DRAFT","ARCHIVED"]).optional()}).parse(req.body);const current=await prisma.product.findUnique({where:{id:routeParam(req,"id")}}); if(!current)return res.status(404).json({error:"PRODUCT_NOT_FOUND"}); const normalizedCollection=validateProductCollection(d.gender??current.gender,d.collectionType??current.collectionType??collectionTypeFor(current)); const p=await prisma.product.update({where:{id:routeParam(req,"id")},data:{...d,collectionType:normalizedCollection}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UPDATE",entity:"Product",entityId:p.id,details:d}});res.json(p)}catch(e){next(e)}});
app.delete("/api/admin/products/:id",requireAdmin,async(req,res)=>{await prisma.product.update({where:{id:routeParam(req,"id")},data:{status:"ARCHIVED"}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"ARCHIVE",entity:"Product",entityId:routeParam(req,"id")}});res.json({ok:true})});
app.get("/api/admin/categories",requireAdmin,async(_req,res)=>res.json(await prisma.category.findMany({include:{_count:{select:{products:true}}},orderBy:{sortOrder:"asc"}})));
app.post("/api/admin/categories",requireAdmin,async(req,res,next)=>{try{const d=z.object({name:z.string().trim().min(2),slug:z.string().trim().min(2),description:z.string().optional(),imageUrl:imageRefSchema.optional().or(z.literal("")),imageMode:z.enum(["contain","cover","full"]).default("contain"),imageRatio:z.string().trim().max(30).default("original"),imageHeight:z.number().int().min(0).max(2000).nullable().optional(),sortOrder:z.number().int().default(0),active:z.boolean().default(true)}).parse(req.body);const c=await prisma.category.create({data:d});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"CREATE_CATEGORY",entity:"Category",entityId:c.id,details:{slug:c.slug,name:c.name}}});res.status(201).json(c)}catch(e){next(e)}});
app.patch("/api/admin/categories/:id",requireAdmin,async(req,res,next)=>{try{const d=z.object({name:z.string().trim().min(2).optional(),slug:z.string().trim().min(2).optional(),description:z.string().optional(),imageUrl:imageRefSchema.optional().or(z.literal("")),imageMode:z.enum(["contain","cover","full"]).optional(),imageRatio:z.string().trim().max(30).optional(),imageHeight:z.number().int().min(0).max(2000).nullable().optional(),sortOrder:z.number().int().optional(),active:z.boolean().optional()}).parse(req.body);const c=await prisma.category.update({where:{id:routeParam(req,"id")},data:d});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UPDATE_CATEGORY",entity:"Category",entityId:c.id,details:d}});res.json(c)}catch(e){next(e)}});
app.delete("/api/admin/categories/:id",requireAdmin,async(req,res)=>{const id=routeParam(req,"id");const count=await prisma.product.count({where:{categoryId:id}});if(count)return res.status(409).json({error:"CATEGORY_IN_USE"});const c=await prisma.category.findUnique({where:{id}});if(!c)return res.status(404).json({error:"CATEGORY_NOT_FOUND"});await prisma.category.delete({where:{id}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DELETE_CATEGORY",entity:"Category",entityId:id,details:{slug:c.slug,name:c.name}}});res.json({ok:true})});
app.get("/api/admin/settings",requireAdmin,async(_req,res)=>{const all=await settingsMap();for(const [k,v] of Object.entries(DESIGN_DEFAULT_SETTINGS)) if(all[k]===undefined||all[k]===null) all[k]=v;res.setHeader("Cache-Control","no-store");res.json(all)});
app.put("/api/admin/settings",requireAdmin,express.json({limit:"3mb"}),async(req,res,next)=>{try{const data=z.record(z.string().trim().min(1).max(120),siteSettingValueSchema).parse(req.body);for(const k of Object.keys(data)) if(k.startsWith("__atelier_")) delete (data as Record<string, unknown>)[k];for(const [key,value] of Object.entries(data))await prisma.siteSetting.upsert({where:{key},update:{value},create:{key,value}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UPDATE_SETTINGS",entity:"SiteSetting",details:data}});const saved=await settingsMap();delete saved.__atelier_ai_provider_registry_v1;res.json(saved)}catch(e){next(e)}});
app.get("/api/admin/audit",requireAdmin,async(_req,res)=>res.json(await prisma.auditLog.findMany({include:{actor:{select:{name:true,email:true}}},orderBy:{createdAt:"desc"},take:200})));
app.get("/api/admin/security/events",requireAdmin,async(_req,res,next)=>{try{const events=await prisma.securityEvent.findMany({orderBy:{createdAt:"desc"},take:500});const ips=[...new Set(events.map(e=>e.ipAddress))];const blocks=ips.length?await prisma.ipBlock.findMany({where:{ipAddress:{in:ips}}}):[];const byIp=new Map(blocks.map(b=>[b.ipAddress,b]));res.json(events.map(e=>({...e,block:byIp.get(e.ipAddress)||null})));}catch(e){next(e)}});
app.get("/api/admin/security/blocks",requireAdmin,async(_req,res,next)=>{try{const now=new Date();await prisma.ipBlock.deleteMany({where:{isPermanent:false,OR:[{expiresAt:null},{expiresAt:{lte:now}}]}});const active=await prisma.ipBlock.findMany({where:{OR:[{isPermanent:true},{isPermanent:false,expiresAt:{gt:now}}]},orderBy:[{isPermanent:"desc"},{createdAt:"desc"}],take:1000});res.json(active.filter(b=>!isProtectedIp(b.ipAddress)));}catch(e){next(e)}});
app.post("/api/admin/security/blocks",requireAdmin,async(req,res,next)=>{try{const d=z.object({ipAddress:z.string().trim().min(1).max(64),reason:z.string().trim().min(3).max(240).default("Manual administrator security block"),isPermanent:z.boolean().default(true),hours:z.number().int().min(1).max(720).optional()}).parse(req.body);const ip=normalizeIp(d.ipAddress);if(!isIP(ip))return res.status(400).json({error:"INVALID_IP_ADDRESS"});if(isProtectedIp(ip))return res.status(400).json({error:"IP_IS_ALLOWLISTED_OR_LOCALHOST"});if(!d.isPermanent&&!d.hours)return res.status(400).json({error:"BLOCK_DURATION_REQUIRED"});const expiresAt=d.isPermanent?null:new Date(Date.now()+Number(d.hours)*60*60*1000);const row=await prisma.ipBlock.upsert({where:{ipAddress:ip},update:{reason:d.reason,isPermanent:d.isPermanent,expiresAt,blockedBy:req.session!.userId},create:{ipAddress:ip,reason:d.reason,isPermanent:d.isPermanent,expiresAt,blockedBy:req.session!.userId}});await prisma.securityEvent.create({data:{ipAddress:ip,path:"/admin/security/blocks",method:"ADMIN",reason:d.reason,action:d.isPermanent?"ADMIN_PERMANENT_BLOCK":"ADMIN_TEMPORARY_BLOCK"}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:d.isPermanent?"IP_BLOCK_PERMANENT":"IP_BLOCK_TEMPORARY",entity:"IpBlock",entityId:row.id,details:{ipAddress:ip,reason:d.reason,isPermanent:d.isPermanent,expiresAt:expiresAt?.toISOString()??null}}});res.status(201).json(row);}catch(e){next(e)}});
app.delete("/api/admin/security/blocks/:id",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");const block=await prisma.ipBlock.findUnique({where:{id}});if(!block)return res.status(404).json({error:"IP_BLOCK_NOT_FOUND"});await prisma.ipBlock.delete({where:{id}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"IP_BLOCK_REMOVED",entity:"IpBlock",entityId:id,details:{ipAddress:block.ipAddress,wasPermanent:block.isPermanent,reason:block.reason}}});await prisma.securityEvent.create({data:{ipAddress:block.ipAddress,path:"/admin/security/blocks",method:"ADMIN",reason:"Block removed by administrator",action:"ADMIN_UNBLOCK"}});res.json({ok:true,ipAddress:block.ipAddress});}catch(e){next(e)}});
app.get("/api/admin/blocked-identities",requireAdmin,async(_req,res)=>res.json(await prisma.blockedIdentity.findMany({orderBy:{createdAt:"desc"},take:200})));
app.post("/api/admin/blocked-identities/unblock",requireAdmin,async(req,res,next)=>{try{
  const d=z.object({email:z.string().trim().toLowerCase().email().optional().or(z.literal("")),phone:phoneSchema.optional().or(z.literal(""))}).refine(v=>Boolean(v.email||v.phone),{message:"Enter an email address or mobile number"}).parse(req.body);
  const clauses:Record<string,string>[]=[];
  if(d.email)clauses.push({emailHash:hashEmail(d.email)});
  if(d.phone)clauses.push({phoneHash:hashIdentity(normalizePhone(d.phone))});
  const result=await prisma.blockedIdentity.deleteMany({where:{OR:clauses}});
  await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"UNBLOCK_IDENTITY",entity:"BlockedIdentity",details:{matchedEmail:Boolean(d.email),matchedPhone:Boolean(d.phone),deleted:result.count}}});
  res.json({ok:true,deleted:result.count});
}catch(e){next(e)}});
app.delete("/api/admin/blocked-identities",requireAdmin,async(req,res,next)=>{try{const result=await prisma.blockedIdentity.deleteMany({});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"CLEAR_BLOCKED_IDENTITIES",entity:"BlockedIdentity",details:{deleted:result.count}}});res.json({ok:true,deleted:result.count})}catch(e){next(e)}});
app.delete("/api/admin/blocked-identities/:id",requireAdmin,async(req,res,next)=>{try{const id=routeParam(req,"id");await prisma.blockedIdentity.delete({where:{id}});await prisma.auditLog.create({data:{actorId:req.session!.userId,action:"DELETE_BLOCKED_IDENTITY",entity:"BlockedIdentity",entityId:id,details:{}}});res.json({ok:true})}catch(e){next(e)}});


app.use((err:any,req:Request,res:Response,_next:NextFunction)=>{
  // Malformed/oversized structured bodies are common parser-probing signals.
  // Record them and use the same warning response, rather than exposing parser details.
  if(err?.type==="entity.parse.failed" || err?.type==="entity.too.large") {
    void flagRequest(req,res,err?.type==="entity.too.large"?"OVERSIZED_REQUEST_BODY":"MALFORMED_JSON_BODY");
    return;
  }
  if(err?.code==="P2002")return res.status(409).json({error:"ALREADY_EXISTS"});if(err?.code==="P2025")return res.status(404).json({error:"NOT_FOUND"});
  if(err instanceof z.ZodError)return res.status(400).json({error:"VALIDATION_ERROR",issues:err.issues});
  const message=typeof err?.message==="string"?err.message:"";
  let dbCode=String(err?.code??"");
  let dbCause=err?.cause;
  for(let depth=0;!dbCode && dbCause && depth<3;depth++,dbCause=dbCause?.cause) dbCode=String(dbCause?.code??"");
  // Translate common PostgreSQL/Prisma availability and migration failures into
  // safe diagnostics. Never send a database URL, SQL, or stack trace to the client.
  if(["P1000","28P01"].includes(dbCode)) { console.error("Database authentication failed.", message); return res.status(503).json({error:"DATABASE_AUTH_FAILED"}); }
  if(["P1001","P1002","P1017","ECONNREFUSED","ENOTFOUND","ETIMEDOUT","ECONNRESET","08000","08001","08006"].includes(dbCode)) { console.error("Database is unavailable.", message); return res.status(503).json({error:"DATABASE_UNAVAILABLE"}); }
  if(["P2021","P2022","42P01","42703"].includes(dbCode)) { console.error("Database schema is out of date.", message); return res.status(503).json({error:"DATABASE_SCHEMA_OUTDATED"}); }
  if(dbCode==="3D000") { console.error("Configured PostgreSQL database does not exist.", message); return res.status(503).json({error:"DATABASE_NOT_FOUND"}); }
  console.error(err);
  // Only expose deliberate application error codes (e.g. CART_EMPTY). Never leak Prisma/SQL/stack text to clients.
  res.status(500).json({error:/^[A-Z][A-Z0-9_]{2,63}$/.test(message)?message:"SERVER_ERROR"})});

async function syncEnvAdmin(){
  const email=(process.env.ADMIN_EMAIL??"").trim().toLowerCase();
  const pw=process.env.ADMIN_PASSWORD??"";
  if(!email || !z.string().email().safeParse(email).success) {
    console.warn("Admin sync skipped: ADMIN_EMAIL is missing or invalid.");
    return;
  }
  if(!pw) {
    console.warn("Admin sync skipped: ADMIN_PASSWORD is not configured. Existing admin accounts are preserved.");
    return;
  }
  // The administrator credential is controlled by backend/.env.
  // Do not impose the customer password-complexity policy on this env-managed secret.
  if(!pw) return;
  const existing=await prisma.user.findUnique({where:{email}});
  if(!existing||!(await bcrypt.compare(pw,existing.passwordHash))){
    const passwordHash=await bcrypt.hash(pw,12);
    await prisma.user.upsert({where:{email},update:{passwordHash,role:"ADMIN",emailVerifiedAt:new Date(),phoneVerifiedAt:null,blockedAt:null,deletedAt:null},create:{email,name:"ATELIER Admin",phone:process.env.WHATSAPP_ADMIN_TO??"",passwordHash,role:"ADMIN",emailVerifiedAt:new Date(),phoneVerifiedAt:null}});
  } else if(existing.role!=="ADMIN" || !existing.emailVerifiedAt || existing.blockedAt || existing.deletedAt) await prisma.user.update({where:{email},data:{role:"ADMIN",emailVerifiedAt:new Date(),phoneVerifiedAt:null,blockedAt:null,deletedAt:null}});
  console.log(`Admin account synced from backend/.env: ${email}`);
}
async function startServer(){
  let databaseReady=false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReady=true;
    console.log("PostgreSQL connection: OK");
  } catch (e:any) {
    console.error("PostgreSQL connection: FAILED", e?.message || e);
  }
  if(databaseReady){
    try {
      try{await ensureCmsDefaults(prisma);console.log("CMS default pages verified.")}catch(e:any){console.error("CMS defaults skipped:",e?.message||e)}
      try{
        const marker=await prisma.siteSetting.findUnique({where:{key:"__atelier_about_layout"}});
        if(!marker||marker.value!=="v3"){
          const about=cmsDefaultPages.find(p=>p.slug==="about");
          const page=about?await prisma.sitePage.findUnique({where:{slug:"about"}}):null;
          if(about&&page){
            await saveSnapshot(prisma,{kind:"PRE_UPGRADE",label:"Backup before About page rebuild"});
            await resetPageToDefaults(prisma,page.id);
            console.log("About page rebuilt (previous version saved in Website history).");
          }
          await prisma.siteSetting.upsert({where:{key:"__atelier_about_layout"},update:{value:"v3"},create:{key:"__atelier_about_layout",value:"v3"}});
        }
        // v4: About "Image + Text" photos were framed as a fixed 560px landscape box, which cropped portraits to the face.
        // Only sections still on those untouched old defaults are switched to a portrait 4:5 frame; edited ones are left alone.
        const mediaMarker=await prisma.siteSetting.findUnique({where:{key:"__atelier_about_media"}});
        if(!mediaMarker||mediaMarker.value!=="v4"){
          const aboutPage=await prisma.sitePage.findUnique({where:{slug:"about"},include:{sections:true}});
          const stale=(aboutPage?.sections||[]).filter(sec=>{const c:any=sec.content||{};return sec.type==="IMAGE_TEXT"&&c.ratio==="1:1"&&Number(c.height)===560});
          if(stale.length){
            await saveSnapshot(prisma,{kind:"PRE_UPGRADE",label:"Backup before About image framing fix"});
            for(const sec of stale)await prisma.siteSection.update({where:{id:sec.id},data:{content:{...(sec.content as any),ratio:"4:5",height:0}}});
            console.log(`About page: ${stale.length} Image + Text photo frame(s) updated to 4:5 (backup saved in Website history).`);
          }
          await prisma.siteSetting.upsert({where:{key:"__atelier_about_media"},update:{value:"v4"},create:{key:"__atelier_about_media",value:"v4"}});
        }
        // Cinematic home (V20): replace the old home layout once, with a restorable backup in Website history.
        const cinMarker=await prisma.siteSetting.findUnique({where:{key:"__atelier_home_cinematic"}});
        if(!cinMarker||cinMarker.value!=="v1"){
          const homePage=await prisma.sitePage.findUnique({where:{slug:"home"},include:{sections:true}});
          if(homePage&&!(homePage.sections||[]).some(sec=>String(sec.type).startsWith("CIN_"))){
            await saveSnapshot(prisma,{kind:"PRE_UPGRADE",label:"Backup before cinematic home upgrade"});
            await resetPageToDefaults(prisma,homePage.id);
            console.log("Home page upgraded to the cinematic layout (previous version saved in Website history).");
          }
          await prisma.siteSetting.upsert({where:{key:"__atelier_home_cinematic"},update:{value:"v1"},create:{key:"__atelier_home_cinematic",value:"v1"}});
        }
        await ensureInitialSnapshot(prisma);
      }catch(e:any){console.error("History setup skipped:",e?.message||e)}
      await syncEnvAdmin();
    } catch (e:any) {
      console.error("Admin sync skipped:", e?.message || e);
    }
  } else {
    console.warn("API will still listen on port %s; /api/health will report the database as unavailable until PostgreSQL is reachable.", port);
  }
  app.listen(port,()=>console.log(`ATELIER API listening on http://localhost:${port}`));
}

startServer().catch(e=>{
  console.error("API startup failed:", e);
  process.exitCode=1;
});
