import crypto from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backendExample = path.join(projectRoot, "backend", ".env.example");
const frontendExample = path.join(projectRoot, "frontend", ".env.local.example");
const backendEnv = path.join(projectRoot, "backend", ".env");
const frontendEnv = path.join(projectRoot, "frontend", ".env.local");

if (existsSync(backendEnv) || existsSync(frontendEnv)) {
  console.error("Environment setup stopped: backend/.env and/or frontend/.env.local already exists.");
  console.error("No files were overwritten. Back up your existing values and edit them manually, or move BOTH files aside before running env:init on a fresh setup.");
  process.exit(1);
}
if (!existsSync(backendExample) || !existsSync(frontendExample)) {
  console.error("Environment template missing. Restore backend/.env.example and frontend/.env.local.example first.");
  process.exit(1);
}

const randomSecret = () => crypto.randomBytes(48).toString("hex");
const sharedToken = randomSecret();
let api = readFileSync(backendExample, "utf8");
let frontend = readFileSync(frontendExample, "utf8");
const setValue = (content, key, value) => {
  const line = new RegExp(`^${key}=.*$`, "m");
  if (!line.test(content)) throw new Error(`Required template key is missing: ${key}`);
  return content.replace(line, `${key}=${value}`);
};
api = setValue(api, "JWT_SECRET", randomSecret());
api = setValue(api, "AI_PROVIDER_ENCRYPTION_KEY", randomSecret());
api = setValue(api, "OTP_PEPPER", randomSecret());
api = setValue(api, "SECURITY_INTERNAL_TOKEN", sharedToken);
frontend = setValue(frontend, "ATELIER_SECURITY_INTERNAL_TOKEN", sharedToken);
writeFileSync(backendEnv, api, { mode: 0o600 });
writeFileSync(frontendEnv, frontend, { mode: 0o600 });
console.log("Created backend/.env and frontend/.env.local without overwriting existing files.");
console.log("Generated fresh JWT_SECRET, AI_PROVIDER_ENCRYPTION_KEY, OTP_PEPPER, and matching security monitor tokens.");
console.log("Next: configure DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SMTP_USER, SMTP_PASS, and EMAIL_FROM; then run npm run env:check.");
console.log("SMTP_PASS must be your real SMTP credential (for Gmail, an App Password). No OTP fallback is enabled.");
