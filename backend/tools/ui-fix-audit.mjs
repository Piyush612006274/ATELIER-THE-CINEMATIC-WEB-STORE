import fs from "node:fs";
import path from "node:path";
import { loadGlobalCssParts } from "./css-source.mjs";
const root=process.cwd();
const storefront=fs.readFileSync(path.join(root,"frontend/components/storefront/storefront.tsx"),"utf8");
const api=fs.readFileSync(path.join(root,"frontend/lib/api.ts"),"utf8");
const backend=fs.readFileSync(path.join(root,"backend/src/index.ts"),"utf8");
const cssParts=loadGlobalCssParts(root);
const css=cssParts.join('\n');
const cms=fs.readFileSync(path.join(root,"frontend/components/admin/cms-kit.tsx"),"utf8");
const builder=fs.readFileSync(path.join(root,"frontend/components/admin/visual-site-builder.tsx"),"utf8");
const nextConfig=fs.readFileSync(path.join(root,"frontend/next.config.mjs"),"utf8");
const frontendPackage=JSON.parse(fs.readFileSync(path.join(root,"frontend/package.json"),"utf8"));
const checks=[
 ["Collection card title rendered from content",storefront.includes('<strong>{c.title}</strong>')],
 ["Collection card title overlay always visible",css.includes(".reference-card-copy{position:absolute!important")&&css.includes("opacity:1!important")],
 ["Collection media fills card edge-to-edge",css.includes(".reference-collection-media{position:absolute!important;inset:0!important")&&css.includes("padding:0!important;margin:0!important")],
 ["Collection cards use intrinsic portrait ratio instead of conflicting fixed height",css.includes("aspect-ratio:5/8!important")&&css.includes("min-height:0!important;height:auto!important")],
 ["Auth shows persistent accessible inline errors",storefront.includes('className="auth-error" role="alert" aria-live="assertive"')],
 ["API errors retain server validation issues",api.includes("details?: unknown")&&api.includes("body?.issues || body?.details")],
 ["Login/register errors are human-readable",storefront.includes("const authErrorText=")&&storefront.includes("EMAIL_NOT_VERIFIED:")&&storefront.includes("INVALID_CREDENTIALS:")],
 ["Registration requires strong password, phone, address and terms",storefront.includes("PASSWORD_POLICY_FAILED")&&storefront.includes("PHONE_INVALID")&&storefront.includes("ADDRESS_LINE_INVALID")&&storefront.includes("TERMS_REQUIRED")],
 ["Registration consent enforced by backend",backend.includes("acceptedTerms:z.literal(true)")&&backend.includes("const data=registerSchema.parse(req.body)")],
 ["OTP code format validated client-side",storefront.includes("const validateOtp=()=>{if(!/^\\d{6}$/.test(otp))")],
 ["Try-on products include full active catalogue, not only cart",storefront.includes("const tryOnProducts=useMemo(()=>Array.from(new Map([...cartProducts,...products]")],
 ["Try-on button provides an actionable validation path",storefront.includes('className="btn ai-try-btn" onClick={generate} disabled={busy}')&&storefront.includes("Upload a clear, front-facing photo first")],
 ["Try-on reports provider configuration/usage problems",storefront.includes("TRY_ON_NOT_CONFIGURED:")&&storefront.includes("TRY_ON_DAILY_LIMIT:")&&storefront.includes("TRY_ON_PROVIDER_QUOTA:")&&storefront.includes("TRY_ON_PROVIDER_AUTH:")&&storefront.includes("RAPIDAPI")],
 ["Backend rejects try-on before quota reservation when provider key is missing",backend.includes('const configuredTryOnProvider = await activeAIProvider("tryon")')&&backend.includes('if (!configuredTryOnProvider && !String(env.RAPIDAPI_KEY || "").trim()) return res.status(503).json({ error: "TRY_ON_NOT_CONFIGURED" })')],
 ["Backend exposes only safe provider error codes to the user",backend.includes('results.push({ productId: product.id, name: product.name, error: safeCode })')&&!backend.includes('results.push({ productId: product.id, name: product.name, error: String(e?.message')],
 ["Preview only opens on an explicit builder action",builder.includes('onClick={() => page && onPreview?.(`/${page.slug}`)}')&&!builder.includes('if (page) onPreview?.(`/${page.slug}`)')],
 ["CMS section selection no longer opens preview automatically",!cms.includes('if(page?.slug) onPreview?.(`/${page.slug}`)')],
 ["Product/category editors no longer open preview automatically",!storefront.includes('onPreview?.(`/product/${p.id}`)')&&!storefront.includes('onPreview?.("/collections")')],
 ["Laptop/tablet/mobile collection breakpoints are present",css.includes("@media(max-width:1100px)")&&css.includes("@media(max-width:900px)")&&css.includes("@media(max-width:700px)")&&css.includes("@media(max-width:380px)")],
 ["Mobile builder canvas scales to the available viewport",builder.includes("canvasOuterRef")&&builder.includes("canvasMetrics.availableWidth / canvasWidth")&&builder.includes("visual-canvas-stage")&&css.includes(".visual-canvas-stage")],
 ["Tables remain horizontally scrollable on narrow screens",css.includes("overscroll-behavior-x:contain")&&css.includes("overflow-x:auto")],
 ["About hero photo fills the frame without inset padding",css.includes(".page-about .about-image img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:center 35%;background:transparent;padding:0")],
 ["About heading and story sections adapt to small screens",css.includes(".page-about .about-hero h1{font-size:clamp(40px,10vw,58px);line-height:.94")&&css.includes(".page-about .about-info-grid article{padding:22px")],
 ["About CMS hero is a compact left-image/right-copy split",css.includes(".page-about .cms-hero{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important")&&css.includes(".page-about .cms-hero-overlay{display:none!important}")],
 ["About CMS image-text stays compact and fully framed",css.includes(".page-about .cms-image-text{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;height:clamp(400px,31vw,520px)!important")&&css.includes(".page-about .cms-image-text-media img{display:block!important;width:100%!important;height:100%!important;min-height:0!important;max-width:none!important;object-fit:contain!important")],
 ["About CMS image-text stacks cleanly on small screens",css.includes("@media(max-width:640px){\n  .page-about .cms-hero-media{height:clamp(220px,68vw,300px)!important}")&&css.includes(".page-about .cms-image-text{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto!important;height:auto!important")],
 ["Visual builder image-text defaults to cover framing (real renderer)",builder.includes('fit: "cover", ratio: "4:5"')&&builder.includes('className="visual-canvas-frame"')&&storefront.includes('content.fit||content.displayMode||"cover"')],
 ["Next config loads env files before requiring production API URL",(nextConfig.includes("loadEnvConfig(__dirname, process.env.NODE_ENV === \"development\")")&&frontendPackage.dependencies?.["@next/env"]==="16.3.6")||(nextConfig.includes("readApiBaseFromEnvFiles")&&nextConfig.includes("NEXT_PUBLIC_API_BASE"))],
 ["Shared customer login securely redirects an authenticated admin to the dashboard",storefront.includes('if(r.user.role==="ADMIN")')&&storefront.includes('onNavigate(ADMIN_ROUTE)')&&storefront.includes('/auth/login')],
 ["No public admin login link or separate admin login page is exposed",!storefront.includes("Open Control Room sign-in")&&!storefront.includes("auth-admin-access")&&!storefront.includes("function AdminLogin")&&!storefront.includes("ADMIN_LOGIN_ROUTE")]
];
let fail=0;
for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} :: ${name}`);if(!ok)fail++;}
console.log(`UI_FIX_AUDIT=${checks.length-fail}/${checks.length} ${fail?"FAIL":"PASS"}`);
process.exitCode=fail?1:0;
