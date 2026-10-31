import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const index=fs.readFileSync(path.join(root,"backend/src/index.ts"),"utf8");
const auth=fs.readFileSync(path.join(root,"backend/src/lib/auth.ts"),"utf8");
const envLib=fs.readFileSync(path.join(root,"backend/src/lib/env.ts"),"utf8");
const front=fs.readFileSync(path.join(root,"frontend/components/storefront/storefront.tsx"),"utf8");
const middleware=fs.readFileSync(path.join(root,"backend/src/middleware/auth.ts"),"utf8");
const email=fs.readFileSync(path.join(root,"backend/src/lib/email.ts"),"utf8");
const checks=[
["JWT_SECRET_REQUIRED",(/JWT_SECRET\?\.trim\(\)/.test(auth)&&/JWT_SECRET is required/.test(auth))||(/requireJwtSecret/.test(auth)&&/JWT_SECRET is missing or still a placeholder/.test(envLib))],
["HTTPONLY_SESSION",/httpOnly:\s*true/.test(auth)],
["SAMESITE_SESSION",/sameSite:\s*"lax"/.test(auth)],
["SECURE_SESSION_PROD",/secure:\s*process\.env\.NODE_ENV === "production"/.test(auth)],
["AUTH_MIDDLEWARE",/function requireAuth/.test(middleware)],
["ADMIN_MIDDLEWARE",/function requireAdmin/.test(middleware)],
["ADMIN_API_RATE_LIMITED",/skip: \(req\) => isInternalSecurityRoute\(req\)/.test(index)&&!/skip: \(req\) => isInternalSecurityRoute\(req\) \|\| Boolean\(readAdminToken/.test(index)],
["LOCAL_PAYLOAD_DETECTION",/if \(!isProtectedIp\(ip\)\) \{[\s\S]*?const signal = detectSuspiciousSignal\(req\.originalUrl, true\)/.test(index)],
["AUTH_RATE_LIMIT",/const authRateLimit\s*=\s*rateLimit/.test(index)],
["AI_TRYON_AUTH",/app\.post\("\/api\/ai\/try-on", aiTryOnRateLimit, requireAuth/.test(index)],
["PAYMENT_SIGNATURE_CHECK",/verifySignature\(d\.razorpayOrderId,d\.razorpayPaymentId,d\.razorpaySignature\)/.test(index)],
["PAYMENT_CAPTURE_CHECK",/p\.status!=="captured"/.test(index)],
["ZOD_VALIDATION",/const registerSchema/.test(index)&&/const loginSchema/.test(index)&&/const addressSchema/.test(index)&&/const cartItemSchema/.test(index)],
["PUBLIC_SETTINGS_FILTER",/publicSettingKeys/.test(index)&&/publicSettingsMap/.test(index)],
["IMAGE_REF_VALIDATION",/const imageRefSchema/.test(index)&&/images:z\.array\(imageRefSchema\)/.test(index)],
["GLOBAL_ERROR_HANDLER",/app\.use\(\(err:any,(?:_req|req):Request,res:Response,_next:NextFunction\)/.test(index)],
["SAME_LOGIN_ACCEPTS_ADMIN_ONLY_AFTER_PASSWORD_VERIFICATION",/app\.post\("\/api\/auth\/login"[\s\S]*?if\(user\.role==="ADMIN"\)\{[\s\S]*?bcrypt\.compare\(data\.password,user\.passwordHash\)[\s\S]*?setSession\(res,\{userId:user\.id,role:"ADMIN"\}\)[\s\S]*?return res\.json\(\{user:safeUser\(user\)\}\)/.test(index)],
["CUSTOMER_ME_EXCLUDES_ADMIN_COOKIE",/app\.get\("\/api\/auth\/me", requireAuth/.test(index)&&!/app\.get\("\/api\/auth\/me"[\s\S]*?readAdminToken/.test(index)],
["SAME_LOGIN_REDIRECTS_ADMIN_TO_DASHBOARD",/if\s*\(\s*r\.user\.role\s*===\s*"ADMIN"\s*\)\s*\{[\s\S]*?onNavigate\(ADMIN_ROUTE\)/.test(front)],
["NO_PUBLIC_ADMIN_LOGIN_ENTRY_OR_SPECIAL_LOGIN_PAGE",!front.includes("Open Control Room sign-in")&&!front.includes("function AdminLogin")&&!front.includes("ADMIN_LOGIN_ROUTE")],
["UNAUTHENTICATED_ADMIN_ROUTE_RETURNS_TO_SHARED_LOGIN",/if\s*\(\s*!authorized\s*\)\s*return\s*<RedirectTo to="\/login"/.test(front)],
["SESSION_COOKIES_MUTUALLY_EXCLUSIVE",/if\(payload\.role==="ADMIN"\)clearSession\(res\);else clearAdminSession\(res\)/.test(auth)&&/function clearSession\(res:Response\):void\{res\.clearCookie\(cookieName/.test(auth)&&/function clearAdminSession\(res:Response\):void\{res\.clearCookie\(adminCookieName/.test(auth)],
["OTP_ISSUANCE_SERIALIZED",/pg_advisory_xact_lock\(hashtext\(\$\{normalized\}\), hashtext\(\$\{purpose\}\)\)/.test(email)],
["OTP_EMAIL_FAILURE_INVALIDATES_CODE",/catch \(error\)[\s\S]*?verificationCode\.updateMany\(\{where:\{id:row\.id,consumedAt:null\},data:\{consumedAt:new Date\(\)\}\}\)/.test(email)],
["RESET_RESPONSE_DOES_NOT_ENUMERATE_EMAIL",/app\.post\(\"\/api\/auth\/password-reset\/request\"[^\n]*res\.json\(\{sent:true,expiresIn:600\}\)/.test(index)],
["CAPTURED_UNMATCHED_PAYMENT_RECOVERY",/app\.post\(\"\/api\/admin\/payments\/:id\/refund\",requireAdmin/.test(index)&&/refundPayment\(captured\.providerId/.test(index)],
["CAPTURE_REQUIRES_SNAPSHOT",/PAYMENT_SNAPSHOT_MISSING/.test(index)&&/snapshotVersion !== 1/.test(index)]
];
let failures=0; for(const [k,ok] of checks){console.log(`${k}=${ok?"PASS":"FAIL"}`); if(!ok)failures++;}
console.log(`SECURITY_API_CHECKS=${checks.length}`);console.log(`SECURITY_API_FAILURES=${failures}`);process.exit(failures?1:0);
