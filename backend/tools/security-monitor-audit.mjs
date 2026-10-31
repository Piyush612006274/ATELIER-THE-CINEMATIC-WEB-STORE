import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const schema = read("backend/database/schema.prisma");
const migration = read("backend/database/migrations/0006_ip_security_monitor/migration.sql");
const security = read("backend/src/lib/security.ts");
const api = read("backend/src/index.ts");
const proxy = read("frontend/proxy.ts");
const front = read("frontend/components/storefront/storefront.tsx");
const envCheck = read("backend/tools/env-check.mjs");
const backendEnv = read("backend/.env.example");
const frontendEnv = read("frontend/.env.local.example");
const checks = [
  ["IP_BLOCK_MODEL", /model IpBlock\s*\{[\s\S]*?ipAddress\s+String\s+@unique[\s\S]*?isPermanent\s+Boolean[\s\S]*?expiresAt\s+DateTime\?/.test(schema)],
  ["SECURITY_EVENT_MODEL", /model SecurityEvent\s*\{[\s\S]*?ipAddress\s+String[\s\S]*?path\s+String[\s\S]*?reason\s+String[\s\S]*?action\s+String/.test(schema)],
  ["DB_MIGRATION_TABLES_AND_INDEXES", /CREATE TABLE "IpBlock"/.test(migration) && /CREATE TABLE "SecurityEvent"/.test(migration) && /SecurityEvent_ipAddress_createdAt_idx/.test(migration)],
  ["SHARED_INTERNAL_TOKEN_TIMING_SAFE", /timingSafeEqual/.test(security) && /SECURITY_INTERNAL_TOKEN/.test(security)],
  ["IP_ALLOWLIST_AND_LOOPBACK_PROTECTION", /SECURITY_IP_ALLOWLIST/.test(security) && /127\.0\.0\.1/.test(security)],
  ["SQLI_DETECTION", /SQL_INJECTION/.test(security) && /union/.test(security) && /sleep/.test(security)],
  ["XSS_DETECTION", /XSS_PAYLOAD/.test(security) && /javascript/.test(security) && /script/.test(security)],
  ["PATH_TRAVERSAL_DETECTION", /PATH_TRAVERSAL/.test(security) && /etc\\\/passwd/.test(security)],
  ["COMMAND_INJECTION_DETECTION", /COMMAND_INJECTION/.test(security) && /powershell/.test(security)],
  ["THREE_SIGNALS_TRIGGER_24H_TEMPORARY_BLOCK", /AUTO_BLOCK_AFTER\s*=\s*3/.test(security) && /15 \* 60 \* 1000/.test(security) && /24 \* 60 \* 60 \* 1000/.test(security)],
  ["PERMANENT_BAN_NOT_DOWNGRADED", /Never downgrade an administrator's permanent ban/.test(security) && /existingBlock\?\.isPermanent/.test(security)],
  ["BACKEND_GLOBAL_IP_ENFORCEMENT", /getActiveIpBlock\(ip\)/.test(api) && /status\(404\)\.type\("html"\)\.send\(WARNING_HTML\)/.test(api)],
  ["WARNING_MESSAGE_PRESENT", /YOU DO'NOT EXPLOITE THIS WEBSITE/.test(security) && /YOU DO'NOT EXPLOITE THIS WEBSITE/.test(proxy)],
  ["PRIVATE_IP_STATUS_AND_REPORT_ROUTES", /\/api\/security\/ip-status/.test(api) && /\/api\/security\/report/.test(api)],
  ["ADMIN_EVENTS_ROUTE_PROTECTED", /app\.get\("\/api\/admin\/security\/events",requireAdmin/.test(api)],
  ["ADMIN_BLOCK_CREATE_AND_DELETE_PROTECTED", /app\.post\("\/api\/admin\/security\/blocks",requireAdmin/.test(api) && /app\.delete\("\/api\/admin\/security\/blocks\/:id",requireAdmin/.test(api)],
  ["ADMIN_MONITOR_UI_AND_PERMANENT_BAN", /function AdminSecurityMonitor/.test(front) && /Security Monitor/.test(front) && /Permanently block IP/.test(front)],
  ["NEXT_REQUEST_GATE_CHECKS_BLOCK_STATUS", /apiBase\}\$\{?/.test(proxy) === false && /security\/ip-status/.test(proxy) && /status\.blocked/.test(proxy)],
  ["PRODUCTION_GATE_FAILS_CLOSED", /process\.env\.NODE_ENV === "production"/.test(proxy) && /status: 503/.test(proxy)],
  ["MATCHING_SERVER_ONLY_ENV_KEYS_AND_VALIDATION", /SECURITY_INTERNAL_TOKEN=/.test(backendEnv) && /ATELIER_SECURITY_INTERNAL_TOKEN=/.test(frontendEnv) && /Security monitor shared token/.test(envCheck) && !/NEXT_PUBLIC_SECURITY_INTERNAL_TOKEN/.test(frontendEnv)],
  ["TRUST_PROXY_IS_NOT_ENABLED_BY_DEFAULT", /if \(\!trustProxyValue\) app\.set\("trust proxy", false\)/.test(api) || /!trustProxyValue \? false/.test(api)],
  ["URLENCODED_FORM_BODY_INSPECTION", /express\.urlencoded\(\{ extended: false, limit: "1mb", parameterLimit: 1000 \}\)/.test(api)],
  ["MALFORMED_OR_OVERSIZED_BODY_WARNING_AND_LOG", /entity\.parse\.failed/.test(api) && /MALFORMED_JSON_BODY/.test(api) && /OVERSIZED_REQUEST_BODY/.test(api) && /flagRequest\(req,res/.test(api)],
  ["IP_BLOCK_LOOKUP_FAILURE_CLOSED", /IP block lookup failed/.test(api) && /return res\.status\(503\)\.json\(\{ error: "SECURITY_STATUS_UNAVAILABLE" \}\)/.test(api)],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}`);
  if (!ok) failed++;
}
console.log(`SECURITY_MONITOR_CHECKS=${checks.length}`);
console.log(`SECURITY_MONITOR_FAILURES=${failed}`);
process.exit(failed ? 1 : 0);
