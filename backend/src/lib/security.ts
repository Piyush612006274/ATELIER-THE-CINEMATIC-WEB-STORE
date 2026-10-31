import crypto from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "../database/prisma.js";

export type SecuritySignal = "SQL_INJECTION" | "XSS_PAYLOAD" | "PATH_TRAVERSAL" | "COMMAND_INJECTION" | "SENSITIVE_FILE_PROBE";

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1"]);
const blockedAccessLastLogged = new Map<string, number>();
const AUTO_BLOCK_AFTER = 3; // three high-confidence exploit signals in 15 minutes
const SIGNAL_WINDOW_MS = 15 * 60 * 1000;
const AUTO_BLOCK_MS = 24 * 60 * 60 * 1000;
const WARNING_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>404 · ATELIER</title><style>html,body{margin:0;min-height:100%;background:#f5f0e9;color:#211914;font-family:Arial,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}article{max-width:640px;border:1px solid #cfc2b5;background:#fffaf4;padding:clamp(24px,6vw,56px);box-shadow:0 16px 48px #21191412}small{letter-spacing:.22em;font-weight:700}h1{font-size:clamp(30px,6vw,48px);margin:18px 0 12px;line-height:1.05}p{line-height:1.7;color:#62564d}strong{color:#9d2f20}code{font-size:12px;color:#76685e}</style></head><body><main><article><small>ATELIER · 404</small><h1>YOU DO'NOT EXPLOITE THIS WEBSITE</h1><p><strong>Security warning.</strong> This request was not accepted. Automated probing and attempts to bypass access controls are not allowed.</p><p>If you are a legitimate visitor, return to the storefront and avoid unusual URL or form input.</p><code>Request denied · Security event recorded where storage is available.</code></article></main></body></html>`;

export { WARNING_HTML, AUTO_BLOCK_MS };

export function normalizeIp(input: string): string {
  const clean = String(input || "").trim().replace(/^\[|\]$/g, "");
  if (clean.toLowerCase().startsWith("::ffff:")) return clean.slice(7);
  return clean;
}

export function isValidIp(input: string): boolean {
  return isIP(normalizeIp(input)) !== 0;
}

export function isProtectedIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  const configured = (process.env.SECURITY_IP_ALLOWLIST || "").split(",").map((x) => normalizeIp(x)).filter(Boolean);
  return LOOPBACK_IPS.has(normalized) || configured.includes(normalized);
}

export function isInternalSecurityTokenValid(value: string | undefined): boolean {
  const expected = (process.env.SECURITY_INTERNAL_TOKEN || "").trim();
  const supplied = (value || "").trim();
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)); } catch { return false; }
}

function decodeCandidates(value: string): string[] {
  const values = [value.slice(0, 15000)];
  let candidate = values[0];
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(candidate.replace(/\+/g, "%20"));
      if (!next || next === candidate) break;
      values.push(next.slice(0, 15000));
      candidate = next;
    } catch { break; }
  }
  return values;
}

export function detectSuspiciousSignal(value: string, includeProbePaths = false): SecuritySignal | null {
  const variants = decodeCandidates(String(value || ""));
  for (const text of variants) {
    if (/<\s*script\b|javascript\s*:|\bon(?:error|load|mouseover|focus)\s*=|<\s*iframe\b/i.test(text)) return "XSS_PAYLOAD";
    if (/(?:\.\.\s*[\\/]){2,}|%2e%2e(?:%2f|%5c)|\/etc\/passwd|\/proc\/self\/(?:environ|cmdline)/i.test(text)) return "PATH_TRAVERSAL";
    if (/\bunion(?:\s|\/\*.*?\*\/)+select\b|\b(?:sleep|benchmark)\s*\(\s*\d+|(?:['"]\s*)\b(?:or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|\b(?:or|and)\s+\d+\s*=\s*\d+|;\s*(?:drop|alter)\s+table\b/i.test(text)) return "SQL_INJECTION";
    if (/(?:;|&&|\|\|)\s*(?:curl|wget|bash|sh|powershell|cmd(?:\.exe)?)\b|\$\([^)]{1,120}\)|`[^`]{1,120}`/i.test(text)) return "COMMAND_INJECTION";
    if (includeProbePaths && /(?:^|[/?])\.env(?:[./?]|$)|\/\.git\/config|\bwp-admin\b|\bphpmyadmin\b|\/server-status\b/i.test(text)) return "SENSITIVE_FILE_PROBE";
  }
  return null;
}

export async function getActiveIpBlock(ipInput: string) {
  const ipAddress = normalizeIp(ipInput);
  if (!isValidIp(ipAddress) || isProtectedIp(ipAddress)) return null;
  const block = await prisma.ipBlock.findUnique({ where: { ipAddress } });
  if (!block) return null;
  if (block.isPermanent) return block;
  if (block.expiresAt && block.expiresAt.getTime() > Date.now()) return block;
  // Invalid/expired temporary entries never become accidental permanent bans.
  await prisma.ipBlock.deleteMany({ where: { id: block.id } });
  return null;
}

export async function recordSecuritySignal(input: {
  ipAddress: string; path: string; method: string; reason: string; userAgent?: string | null;
}) {
  const ipAddress = normalizeIp(input.ipAddress);
  if (!isValidIp(ipAddress)) return { autoBlocked: false, eventId: null as string | null };
  const now = new Date();
  const protectedIp = isProtectedIp(ipAddress);
  const since = new Date(now.getTime() - SIGNAL_WINDOW_MS);
  const recentCount = protectedIp ? 0 : await prisma.securityEvent.count({
    where: { ipAddress, createdAt: { gte: since }, action: { in: ["WARNED", "AUTO_BLOCKED"] } }
  });
  let autoBlocked = !protectedIp && recentCount >= AUTO_BLOCK_AFTER - 1;
  // Never downgrade an administrator's permanent ban into an expiring auto-block.
  const existingBlock = autoBlocked ? await prisma.ipBlock.findUnique({ where: { ipAddress } }) : null;
  if (existingBlock?.isPermanent) autoBlocked = false;
  const event = await prisma.securityEvent.create({ data: {
    ipAddress,
    path: String(input.path || "/").slice(0, 500),
    method: String(input.method || "GET").slice(0, 16),
    reason: String(input.reason || "SUSPICIOUS_REQUEST").slice(0, 80),
    action: autoBlocked ? "AUTO_BLOCKED" : "WARNED",
    userAgent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
  } });
  if (autoBlocked) {
    const expiresAt = new Date(now.getTime() + AUTO_BLOCK_MS);
    await prisma.ipBlock.upsert({
      where: { ipAddress },
      update: { reason: `Automatic temporary block after repeated security signals (${input.reason})`, isPermanent: false, expiresAt, blockedBy: null },
      create: { ipAddress, reason: `Automatic temporary block after repeated security signals (${input.reason})`, isPermanent: false, expiresAt, blockedBy: null },
    });
  }
  await prisma.auditLog.create({ data: {
    action: autoBlocked ? "SECURITY_AUTO_BLOCK" : "SECURITY_SIGNAL",
    entity: "SecurityEvent",
    entityId: event.id,
    details: { ipAddress, path: event.path, method: event.method, reason: event.reason, action: event.action, userAgent: event.userAgent, temporaryBlockHours: autoBlocked ? 24 : 0 },
  } });
  return { autoBlocked, eventId: event.id };
}

export async function logBlockedAccess(ipAddressInput: string, path: string, method: string, userAgent?: string | null) {
  const ipAddress = normalizeIp(ipAddressInput);
  if (!isValidIp(ipAddress)) return;
  const now = Date.now();
  const last = blockedAccessLastLogged.get(ipAddress) || 0;
  if (now - last < 60_000) return;
  blockedAccessLastLogged.set(ipAddress, now);
  if (blockedAccessLastLogged.size > 5000) {
    for (const [ip, time] of blockedAccessLastLogged) if (now - time > 10 * 60_000) blockedAccessLastLogged.delete(ip);
  }
  const event = await prisma.securityEvent.create({ data: {
    ipAddress, path: String(path || "/").slice(0, 500), method: String(method || "GET").slice(0, 16),
    reason: "ACCESS_ATTEMPT_FROM_BLOCKED_IP", action: "BLOCKED_ACCESS", userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
  } });
  await prisma.auditLog.create({ data: { action: "BLOCKED_IP_ACCESS_ATTEMPT", entity: "SecurityEvent", entityId: event.id, details: { ipAddress, path: event.path, method: event.method, userAgent: event.userAgent } } });
}
