import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const email = read("backend/src/lib/email.ts");
const horde = read("backend/src/admin/imageGeneration.ts");
const api = read("backend/src/index.ts");
const media = read("frontend/components/storefront/storefront.tsx");
const env = read("backend/.env.example");
const envInit = read("backend/tools/init-env.mjs");
const envCheck = read("backend/tools/env-check.mjs");
const whatsapp = read("backend/src/lib/whatsapp.ts");
const checks = [
  ["SMTP requires STARTTLS before auth on non-implicit TLS", email.includes("SMTP_STARTTLS_UNAVAILABLE") && email.includes('command("STARTTLS")') && email.includes('command("AUTH LOGIN")')],
  ["OTP delivery uses SMTP only with no provider fallback or terminal OTP logging", email.includes("sendViaSmtp") && email.includes("await sendViaSmtp(to, subject, text, html, from)") && !email.includes("RESEND_API_KEY") && !email.includes("ALLOW_DEV_OTP") && !email.includes("[ATELIER DEV OTP]")],
  ["OTP path uses provider abstraction", email.includes("await sendEmail(normalized,subject,text,html)")],
  ["Shared admin login can resync an env-configured blocked/deleted admin account", api.includes('user.blockedAt || user.deletedAt || !user.emailVerifiedAt') && api.includes('blockedAt:null,deletedAt:null')],
  ["Common DB failures return safe actionable error codes", api.includes('error:"DATABASE_UNAVAILABLE"') && api.includes('error:"DATABASE_AUTH_FAILED"') && api.includes('error:"DATABASE_SCHEMA_OUTDATED"') && api.includes('error:"DATABASE_NOT_FOUND"') && media.includes('code==="DATABASE_UNAVAILABLE"') && media.includes('code==="DATABASE_NOT_FOUND"')],
  ["AI Horde async generation endpoint exists", horde.includes('/generate/async') && horde.includes('/generate/check/') && horde.includes('/generate/status/')],
  ["Image generation provider is selected through backend env", horde.includes("IMAGE_GENERATION_PROVIDER") && horde.includes("getImageGenerationProvider") && horde.includes("generateConfiguredImage")],
  ["Image generation supports Gemini image API", horde.includes("generateGeminiImage") && horde.includes("GEMINI_IMAGE_MODEL") && horde.includes("responseModalities")],
  ["Image generation supports an OpenAI-compatible images endpoint", horde.includes("generateOpenAICompatibleImage") && horde.includes("/images/generations") && horde.includes("IMAGE_API_BASE_URL")],
  ["Image generation provider configuration is checked", horde.includes("isImageGenerationConfigured") && env.includes("IMAGE_GENERATION_PROVIDER=")],
  ["AI Horde request includes identity header", horde.includes('"Client-Agent": clientAgent')],
  ["AI Horde images are type/size checked", horde.includes("inferImage(buffer)") && horde.includes("MAX_IMAGE_BYTES")],
  ["Image generation route is admin guarded and rate limited", api.includes('"/api/admin/ai/generate-image",aiImageGenerationRateLimit,requireAdmin')],
  ["Generated files are saved in existing upload path", api.includes('`ai-fashion-${crypto.randomUUID()}.${generated.extension}`') && api.includes('path.join(uploadDir,filename)')],
  ["Generated-image operation is audited", api.includes('action:"AI_IMAGE_GENERATION"')],
  ["Media Library contains prompt generation action", media.includes('"/admin/ai/generate-image"') && media.includes("Generate a new image")],
  ["Environment template includes SMTP values and omits alternate OTP providers", env.includes("SMTP_HOST=") && env.includes("SMTP_PORT=") && env.includes("SMTP_USER=") && env.includes("SMTP_PASS=") && !env.includes("RESEND_API_KEY") && !env.includes("ALLOW_DEV_OTP")],
  ["Environment template contains no fake AI Horde credential", env.includes("AI_HORDE_API_KEY=\n")],
  ["Environment template contains no fake admin or database credentials", env.includes("DATABASE_URL=\n") && env.includes("ADMIN_EMAIL=\n") && env.includes("ADMIN_PASSWORD=\n") && !env.includes("admin@example.com") && !env.includes("CHANGE_ME_DB_PASSWORD")],
  ["env:init generates random secrets and a matching internal token without overwriting files", envInit.includes("randomBytes(48)") && envInit.includes("ATELIER_SECURITY_INTERNAL_TOKEN") && envInit.includes("if (existsSync(backendEnv) || existsSync(frontendEnv))")],
  ["OTP hashing fails closed if OTP_PEPPER is missing or a placeholder", email.includes("OTP_PEPPER_NOT_CONFIGURED") && !email.includes('?? "atelier-otp"')],
  ["Environment checker detects spaces in variable names and Markdown URL values", envCheck.includes("environment variable names may use only letters, numbers, and underscores") && envCheck.includes("not Markdown link syntax") && envCheck.includes("percent-encode it as %40")],
  ["Existing WhatsApp Cloud API sender remains present", whatsapp.includes("graph.facebook.com") && whatsapp.includes("WHATSAPP_PHONE_NUMBER_ID")]
];
let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}`);
  if (!ok) failures++;
}
console.log(`INTEGRATION_CONFIG_AUDIT=${checks.length - failures}/${checks.length} ${failures ? "FAIL" : "PASS"}`);
process.exitCode = failures ? 1 : 0;
