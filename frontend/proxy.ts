import { NextRequest, NextResponse } from "next/server";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api").trim().replace(/\/$/, "");
const internalToken = (process.env.ATELIER_SECURITY_INTERNAL_TOKEN || "").trim();
const warningHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>404 · ATELIER</title><style>html,body{margin:0;min-height:100%;background:#f5f0e9;color:#211914;font-family:Arial,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}article{max-width:640px;border:1px solid #cfc2b5;background:#fffaf4;padding:clamp(24px,6vw,56px);box-shadow:0 16px 48px #21191412}small{letter-spacing:.22em;font-weight:700}h1{font-size:clamp(30px,6vw,48px);margin:18px 0 12px;line-height:1.05}p{line-height:1.7;color:#62564d}strong{color:#9d2f20}</style></head><body><main><article><small>ATELIER · 404</small><h1>YOU DO'NOT EXPLOITE THIS WEBSITE</h1><p><strong>Security warning.</strong> This request was not accepted. Automated probing and attempts to bypass access controls are not allowed.</p><p>If you are a legitimate visitor, return to the storefront and avoid unusual URL or form input.</p></article></main></body></html>`;

type Signal = "SQL_INJECTION" | "XSS_PAYLOAD" | "PATH_TRAVERSAL" | "COMMAND_INJECTION" | "SENSITIVE_FILE_PROBE";
function identifySignal(value: string): Signal | null {
  let current = String(value || "").slice(0, 10000);
  const variants = [current];
  for (let i = 0; i < 2; i++) {
    try { const decoded = decodeURIComponent(current.replace(/\+/g, "%20")); if (!decoded || decoded === current) break; variants.push(decoded.slice(0, 10000)); current = decoded; } catch { break; }
  }
  for (const v of variants) {
    if (/<\s*script\b|javascript\s*:|\bon(?:error|load|mouseover|focus)\s*=|<\s*iframe\b/i.test(v)) return "XSS_PAYLOAD";
    if (/(?:\.\.\s*[\\/]){2,}|%2e%2e(?:%2f|%5c)|\/etc\/passwd|\/proc\/self\/(?:environ|cmdline)/i.test(v)) return "PATH_TRAVERSAL";
    if (/\bunion(?:\s|\/\*.*?\*\/)+select\b|\b(?:sleep|benchmark)\s*\(\s*\d+|(?:['"]\s*)\b(?:or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|\b(?:or|and)\s+\d+\s*=\s*\d+|;\s*(?:drop|alter)\s+table\b/i.test(v)) return "SQL_INJECTION";
    if (/(?:;|&&|\|\|)\s*(?:curl|wget|bash|sh|powershell|cmd(?:\.exe)?)\b|\$\([^)]{1,120}\)|`[^`]{1,120}`/i.test(v)) return "COMMAND_INJECTION";
    if (/(?:^|[/?])\.env(?:[./?]|$)|\/\.git\/config|\bwp-admin\b|\bphpmyadmin\b|\/server-status\b/i.test(v)) return "SENSITIVE_FILE_PROBE";
  }
  return null;
}

function getClientIp(request: NextRequest): string {
  // Forwarding headers are attacker-controlled unless an ingress proxy removes
  // incoming copies and writes its own. Only trust them after explicit opt-in.
  const trustedProxy = String(process.env.FRONTEND_TRUSTED_PROXY || "").toLowerCase() === "true";
  const fromTrustedEdge = trustedProxy ? (request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip")) : "";
  const forwarded = trustedProxy ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : "";
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname.toLowerCase());
  const fallback = localHost || process.env.NODE_ENV !== "production" ? "127.0.0.1" : "";
  const raw = (fromTrustedEdge || forwarded || fallback).trim().replace(/^\[|\]$/g, "");
  return raw.toLowerCase().startsWith("::ffff:") ? raw.slice(7) : raw;
}

async function sendSecurityReport(ip: string, request: NextRequest, reason: Signal) {
  if (!internalToken || internalToken.length < 32 || !ip) return;
  try {
    await fetch(`${apiBase}/security/report`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-atelier-security-token": internalToken, "x-atelier-client-ip": ip, "x-atelier-client-user-agent": request.headers.get("user-agent") || "" },
      body: JSON.stringify({ path: `${request.nextUrl.pathname}${request.nextUrl.search}`.slice(0, 500), method: request.method, reason }),
      cache: "no-store",
      signal: AbortSignal.timeout(900),
    });
  } catch { /* The request still receives the local warning page if logging is unavailable. */ }
}

export async function proxy(request: NextRequest) {
  const ip = getClientIp(request);

  if (!internalToken || internalToken.length < 32 || /^(?:REPLACE|CHANGE_ME|PASTE|YOUR_)/i.test(internalToken)) {
    // In development the API security gate remains active. Production builds are
    // expected to configure the shared token to enable full-site IP enforcement.
    if (process.env.NODE_ENV === "production") return new NextResponse("Security protection is not configured.", { status: 503, headers: { "cache-control": "no-store" } });
  } else if (!ip) {
    if (process.env.NODE_ENV === "production") return new NextResponse("Security status is unavailable.", { status: 503, headers: { "cache-control": "no-store" } });
  } else {
    try {
      const check = await fetch(`${apiBase}/security/ip-status`, {
        method: "GET",
        headers: { "x-atelier-security-token": internalToken, "x-atelier-client-ip": ip },
        cache: "no-store",
        signal: AbortSignal.timeout(1000),
      });
      if (!check.ok) throw new Error(`Security status returned ${check.status}`);
      const status = await check.json() as { blocked?: boolean };
      if (status.blocked) return new NextResponse(warningHtml, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
    } catch {
      // Fail closed in production; do not silently bypass IP bans if the security
      // service cannot be consulted. Local development stays usable during startup.
      if (process.env.NODE_ENV === "production") return new NextResponse("Security protection is temporarily unavailable. Please try again shortly.", { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  const signal = identifySignal(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (signal) {
    await sendSecurityReport(ip, request, signal);
    return new NextResponse(warningHtml, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)"],
};
