import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(backendDir, "..");
const frontendDir = path.join(projectRoot, "frontend");
const rootEnvPath = path.join(projectRoot, ".env");
const backendEnvPath = path.join(backendDir, ".env");
const frontendEnvPath = path.join(frontendDir, ".env.local");
const rootFileEnv = existsSync(rootEnvPath) ? dotenv.parse(readFileSync(rootEnvPath)) : {};
const backendFileEnv = existsSync(backendEnvPath) ? dotenv.parse(readFileSync(backendEnvPath)) : {};
const frontendFileEnv = existsSync(frontendEnvPath) ? dotenv.parse(readFileSync(frontendEnvPath)) : {};

// Mirror backend/src/lib/env.ts: OS env wins over root .env, backend/.env overrides both.
const env = { ...process.env };
for (const [key, value] of Object.entries(rootFileEnv)) {
  if (env[key] === undefined) env[key] = value;
}
Object.assign(env, backendFileEnv);
// Next.js environment variables supplied by the process take precedence over frontend/.env.local.
const frontendEnv = { ...frontendFileEnv };
for (const key of Object.keys(frontendFileEnv)) {
  if (process.env[key] !== undefined) frontendEnv[key] = process.env[key];
}

let errors = 0;
let warnings = 0;
function pass(label, detail) { console.log(`[PASS] ${label} — ${detail}`); }
function warn(label, detail) { warnings++; console.log(`[WARN] ${label} — ${detail}`); }
function fail(label, detail) { errors++; console.log(`[FAIL] ${label} — ${detail}`); }
function placeholder(value) { return !value || /^(?:REPLACE|CHANGE_ME|PASTE|YOUR_)/i.test(String(value).trim()); }
function configured(value) { return Boolean(String(value ?? "").trim()); }

function checkRawEnvSyntax(filePath, label) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  let bad = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(?:#|$)/.test(line)) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      fail(`${label} syntax line ${i + 1}`, "environment variable names may use only letters, numbers, and underscores; remove spaces from the key name");
      bad = true;
    }
    if (/^\s*[A-Z][A-Z0-9_]*=\s*\[(?:https?:\/\/)[^\]]+\]\(https?:\/\//i.test(line)) {
      fail(`${label} syntax line ${i + 1}`, "use a plain URL value, not Markdown link syntax");
      bad = true;
    }
    if (key === "DATABASE_URL" && /\\@/.test(line)) {
      fail(`${label} syntax line ${i + 1}`, "do not escape @ with a backslash in DATABASE_URL; percent-encode it as %40 when it is part of the password");
      bad = true;
    }
  }
  if (!bad) pass(`${label} syntax`, "variable names and assignment format look valid");
}

console.log("ATELIER environment configuration check (presence/shape only; provider credentials are not tested online)\n");
checkRawEnvSyntax(backendEnvPath, "backend/.env");
checkRawEnvSyntax(frontendEnvPath, "frontend/.env.local");

if (existsSync(backendEnvPath)) pass("backend/.env", "found");
else warn("backend/.env", "not found; copy backend/.env.example to backend/.env unless supplying values through your deployment environment");

const databaseUrl = String(env.DATABASE_URL ?? "").trim();
let databaseOkay = false;
try {
  const parsed = new URL(databaseUrl);
  databaseOkay = ["postgres:", "postgresql:"].includes(parsed.protocol) && Boolean(parsed.hostname) && !/(?:CHANGE_ME|REPLACE|YOUR_)/i.test(databaseUrl);
} catch {}
if (databaseOkay) pass("DATABASE_URL", "PostgreSQL connection string shape looks valid; database reachability is not tested");
else fail("DATABASE_URL", "set a valid PostgreSQL URL; percent-encode reserved characters in the password (for example, @ as %40)");

const jwt = String(env.JWT_SECRET ?? "").trim();
if (!placeholder(jwt) && jwt.length >= 32) pass("JWT_SECRET", "present, non-placeholder, and at least 32 characters");
else fail("JWT_SECRET", "use a unique random secret of at least 32 characters");
const aiEncryptionKey = String(env.AI_PROVIDER_ENCRYPTION_KEY ?? "").trim();
if (!placeholder(aiEncryptionKey) && aiEncryptionKey.length >= 64) pass("AI_PROVIDER_ENCRYPTION_KEY", "present and long enough to encrypt AI API credentials stored from the admin dashboard");
else warn("AI_PROVIDER_ENCRYPTION_KEY", "generate a separate stable key before saving API credentials in Admin → AI API Studio; changing or losing this key makes saved provider credentials unreadable");

const adminEmail = String(env.ADMIN_EMAIL ?? "").trim();
if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) && !/@example\.(?:com|org|net)$/i.test(adminEmail)) pass("ADMIN_EMAIL", "looks like a real configured email address");
else fail("ADMIN_EMAIL", "set the actual admin email address in backend/.env");

const adminPassword = String(env.ADMIN_PASSWORD ?? "");
if (!placeholder(adminPassword) && adminPassword.length >= 12) pass("ADMIN_PASSWORD", "present and at least 12 characters");
else fail("ADMIN_PASSWORD", "replace the sample value with a unique password of at least 12 characters");

const pepper = String(env.OTP_PEPPER ?? "").trim();
if (!placeholder(pepper) && pepper.length >= 32) pass("OTP_PEPPER", "present, non-placeholder, and at least 32 characters");
else fail("OTP_PEPPER", "set a unique random value of at least 32 characters before using OTP flows");

const port = Number(env.API_PORT ?? 4000);
if (Number.isInteger(port) && port >= 1 && port <= 65535) pass("API_PORT", `valid port ${port}; the local launcher reads backend/.env`);
else fail("API_PORT", "must be an integer from 1 to 65535");
if (configured(env.WEB_ORIGIN)) pass("WEB_ORIGIN", "configured for CORS");
else fail("WEB_ORIGIN", "set the storefront origin, usually http://localhost:3000");

const apiBase = String(frontendEnv.NEXT_PUBLIC_API_BASE ?? "").trim();
if (apiBase) {
  let apiUrl;
  try { apiUrl = new URL(apiBase); } catch {}
  if (!apiUrl || !["http:", "https:"].includes(apiUrl.protocol) || !apiUrl.pathname.replace(/\/$/, "").endsWith("/api")) {
    fail("NEXT_PUBLIC_API_BASE", "use a valid API base URL ending with /api");
  } else {
    pass("NEXT_PUBLIC_API_BASE", `${apiBase} (format only; API reachability is not tested)`);
    if ((apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1") && apiUrl.port && Number(apiUrl.port) !== port) {
      warn("API port alignment", `frontend targets port ${apiUrl.port}, but backend API_PORT is ${port}; update both if intentional`);
    }
  }
} else if (String(env.NODE_ENV) === "production") {
  fail("NEXT_PUBLIC_API_BASE", "required for a production build; set it in frontend/.env.local or deployment configuration");
} else {
  warn("NEXT_PUBLIC_API_BASE", "not explicit; local frontend code falls back to http://localhost:4000/api");
}

const backendSecurityToken = String(env.SECURITY_INTERNAL_TOKEN ?? "").trim();
const frontendSecurityToken = String(frontendEnv.ATELIER_SECURITY_INTERNAL_TOKEN ?? "").trim();
const tokenLooksStrong = (value) => configured(value) && value.length >= 32 && !placeholder(value);
if (tokenLooksStrong(backendSecurityToken) && tokenLooksStrong(frontendSecurityToken) && backendSecurityToken === frontendSecurityToken) {
  pass("Security monitor shared token", "frontend and backend token match; the secret value is not printed");
} else {
  fail("Security monitor shared token", "set the same unique random secret (at least 32 characters) as SECURITY_INTERNAL_TOKEN in backend/.env and ATELIER_SECURITY_INTERNAL_TOKEN in frontend/.env.local; do not use the example placeholder");
}
const trustProxySetting = String(env.TRUST_PROXY ?? "").trim();
if (trustProxySetting) pass("TRUST_PROXY", `configured as ${trustProxySetting}; verify only trusted proxy hops are accepted`);
else warn("TRUST_PROXY", "API trusts no forwarding headers by default. If deployed behind a reverse proxy, configure TRUST_PROXY to the exact trusted hop count and ensure the proxy overwrites client-supplied forwarding headers.");
const frontendTrustedProxy = String(frontendEnv.FRONTEND_TRUSTED_PROXY ?? "false").trim().toLowerCase() === "true";
if (frontendTrustedProxy) pass("FRONTEND_TRUSTED_PROXY", "frontend will trust forwarding IP headers; ensure the origin is not directly exposed and the proxy overwrites spoofable headers");
else if (String(env.NODE_ENV) === "production") fail("FRONTEND_TRUSTED_PROXY", "set true only when production hosting uses a trusted proxy that overwrites client-IP headers; otherwise the full-site gate cannot identify visitor IPs");
else warn("FRONTEND_TRUSTED_PROXY", "false is suitable for local development; set true in production only behind a trusted proxy that overwrites client-IP headers");

const from = String(env.EMAIL_FROM ?? "").trim();
const smtpHost = String(env.SMTP_HOST ?? "").trim();
const smtpUser = String(env.SMTP_USER ?? "").trim();
const smtpPass = String(env.SMTP_PASS ?? "");
const smtpReady = Boolean(smtpHost && smtpUser && smtpPass && from);
if (smtpReady) pass("OTP email provider (SMTP only)", "SMTP fields are present; send a test email to verify credentials and sender acceptance");
else fail("OTP email provider (SMTP only)", "set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM in backend/.env; this project sends OTP only through SMTP and never logs OTPs to the terminal");
if (smtpHost && from && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) fail("EMAIL_FROM", "must be a valid sender email address accepted by the SMTP provider");
const smtpPort = Number(env.SMTP_PORT || 587);
if (smtpHost && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) fail("SMTP_PORT", "must be an integer from 1 to 65535");

function optionalFeature(label, keys, reason) {
  const values = keys.map((key) => configured(env[key]));
  if (values.every(Boolean)) pass(label, "required environment values are present; provider authentication is not tested");
  else if (values.some(Boolean)) warn(label, `partially configured; needs ${keys.filter((key, i) => !values[i]).join(", ")}. ${reason}`);
  else warn(label, `not configured; this feature will be unavailable. ${reason}`);
}
optionalFeature("Gemini chat", ["GEMINI_API_KEY"], "optional provider");
optionalFeature("Virtual try-on", ["RAPIDAPI_KEY"], "requires a valid RapidAPI key and active plan");
const imageProvider = String(env.IMAGE_GENERATION_PROVIDER || "ai_horde").trim().toLowerCase();
if (imageProvider === "ai_horde") {
  optionalFeature("Image generation (AI Horde)", ["AI_HORDE_API_KEY"], "the public community queue may be slow or unavailable");
} else if (imageProvider === "gemini") {
  optionalFeature("Image generation (Gemini)", ["GEMINI_API_KEY"], "requires a Gemini image-capable model; image-generation pricing and quota are separate from chat availability");
  if (configured(env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image")) pass("GEMINI_IMAGE_MODEL", "model value is present; model access is not tested");
} else if (imageProvider === "openai_compatible") {
  optionalFeature("Image generation (OpenAI-compatible API)", ["IMAGE_API_BASE_URL", "IMAGE_API_KEY", "IMAGE_API_MODEL"], "the API must implement POST /images/generations and return an image URL or base64 image data");
  const imageBase = String(env.IMAGE_API_BASE_URL || "").trim();
  if (imageBase) {
    try {
      const parsed = new URL(imageBase);
      const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !localHttp) fail("IMAGE_API_BASE_URL", "must use HTTPS (HTTP is allowed only for localhost development)");
      else if (parsed.pathname.endsWith("/images/generations")) warn("IMAGE_API_BASE_URL", "provide the API root (for example /v1); the integration appends /images/generations automatically");
      else pass("IMAGE_API_BASE_URL", "URL shape looks valid; provider compatibility is not tested");
    } catch { fail("IMAGE_API_BASE_URL", "must be a valid HTTPS API root URL"); }
  }
} else {
  fail("IMAGE_GENERATION_PROVIDER", "choose ai_horde, gemini, or openai_compatible");
}
optionalFeature("Razorpay payments", ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], "requires live/test credentials as appropriate");
if (configured(env.RAZORPAY_KEY_ID) && configured(env.RAZORPAY_KEY_SECRET) && !configured(env.RAZORPAY_WEBHOOK_SECRET)) {
  warn("Razorpay webhook", "RAZORPAY_WEBHOOK_SECRET is empty; webhook signatures will not validate");
}
optionalFeature("WhatsApp order notifications", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ADMIN_TO", "WHATSAPP_TEMPLATE_NAME"], "requires valid Meta credentials and an approved template");

console.log(`\nResult: ${errors} blocking issue(s), ${warnings} warning(s).`);
if (errors) {
  console.log("Fix every [FAIL] before relying on registration/admin startup. [WARN] items may disable optional features or need live validation.");
  process.exitCode = 1;
} else {
  console.log("Required configuration shapes passed. This does not prove database connectivity or that third-party credentials are valid.");
}
