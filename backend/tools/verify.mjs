import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));

function loadTypeScript() {
  const candidates = [
    "typescript",
    path.join(root, "backend", "node_modules", "typescript"),
    path.join(root, "frontend", "node_modules", "typescript"),
    "/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript",
  ];
  for (const spec of candidates) {
    try { return require(spec); } catch {}
  }
  throw new Error("TYPESCRIPT_NOT_INSTALLED: run `npm install` at the project root, then run `npm run verify`");
}
const ts = loadTypeScript();
const scanDirs = ["backend", "frontend"];
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist", "generated", ".venv", "venv", "__pycache__"].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    e.isDirectory() ? walk(f) : files.push(f);
  }
}
for (const d of scanDirs) {
  const p = path.join(root, d);
  if (fs.existsSync(p)) walk(p);
}
const rel = (p) => path.relative(root, p).replaceAll("\\", "/");
const source = files.filter((f) => /\.(ts|tsx|js|mjs|cjs|mts|cts)$/.test(path.extname(f)));
const jsonFiles = files.filter((f) => path.basename(f) === "package.json");

let syntax = 0;
let jsonErrors = 0;
for (const f of source) {
  const ext = path.extname(f);
  const kind = ext === ".tsx" ? ts.ScriptKind.TSX : [".js", ".mjs", ".cjs"].includes(ext) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, kind);
  for (const d of sf.parseDiagnostics ?? []) {
    syntax++;
    const pos = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    console.error(`${rel(f)}:${pos.line + 1}:${pos.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
}
for (const f of jsonFiles) {
  try { JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { jsonErrors++; console.error(`Invalid JSON ${rel(f)}: ${e.message}`); }
}

const packageErrors = [];
for (const app of ["backend", "frontend"]) {
  const f = path.join(root, app, "package.json");
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const [dep, version] of Object.entries({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) })) {
    if (String(version).startsWith("workspace:")) packageErrors.push(`${app}:${dep}`);
  }
  for (const s of ["dev", "build", "typecheck"]) if (!p.scripts?.[s]) packageErrors.push(`${app}:missing-script:${s}`);
}

const imageRefs = new Set();
for (const f of source.concat(jsonFiles)) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(/\/images\/[A-Za-z0-9_./-]+\.(?:svg|png|jpe?g|webp)/g)) imageRefs.add(m[0]);
}
const missingImages = [...imageRefs].filter((ref) => {
  const r = ref.slice(1);
  return !fs.existsSync(path.join(root, "frontend/public", r));
});

const externalImages = source.concat(jsonFiles)
  .filter((f) => /images\.unsplash\.com|images\.pexels\.com|source\.unsplash\.com/.test(fs.readFileSync(f, "utf8")))
  .map(rel);

const backendPkg = JSON.parse(fs.readFileSync(path.join(root, "backend/package.json"), "utf8"));
const backendDeps = new Set(Object.keys({ ...(backendPkg.dependencies ?? {}), ...(backendPkg.devDependencies ?? {}) }));
const packageImports = [];
for (const f of source.filter((f) => f.startsWith(path.join(root, "backend") + path.sep))) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] || m[2];
    if (spec && !spec.startsWith(".") && !spec.startsWith("node:") && !spec.startsWith("@/")) packageImports.push([rel(f), spec]);
  }
}
const packageImportErrors = packageImports.filter(([_, spec]) => {
  if (spec === "prisma/config") return false;
  for (const dep of backendDeps) {
    if (spec === dep || spec.startsWith(`${dep}/`)) return false;
  }
  return true;
});

const localImportErrors = [];
const localImportRegex = /from\s+["'](\.\.?\/[^"']+)["']|import\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;
for (const f of source) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(localImportRegex)) {
    const spec = m[1] || m[2];
    const clean = spec.replace(/\.(?:js|mjs|cjs)$/i, "");
    const base = path.resolve(path.dirname(f), clean);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, "index.ts"), path.join(base, "index.tsx"), path.join(base, "index.js")];
    const generated = /[\\/]generated[\/]prisma[\/]client$/.test(base);
    if (!candidates.some(fs.existsSync) && !generated) localImportErrors.push(`${rel(f)} -> ${spec}`);
  }
}

const index = fs.readFileSync(path.join(root, "backend/src/index.ts"), "utf8");
const unsafeParams = [...index.matchAll(/req\.params\.([A-Za-z0-9_]+)/g)]
  .map((m) => m[1])
  .filter((k) => !index.includes(`routeParam(req, "${k}")`) && !index.includes(`routeParam(req,"${k}")`) && !index.includes(`routeParam(req, '${k}')`) && !index.includes(`routeParam(req,'${k}')`));
const routePattern = /app\.(?:get|post|patch|put|delete)\(\s*["']([^"']+)["']/g;
const routes = [...index.matchAll(routePattern)].map((m) => m[1].replace(/^\/api/, ""));
const requiredRoutes = [
  "/health", "/products", "/products/:id", "/categories", "/settings", "/auth/register", "/auth/login", "/auth/logout", "/auth/me",
  "/addresses", "/addresses/:id", "/wishlist", "/wishlist/:productId", "/cart", "/cart/items", "/cart/items/:id", "/cart/sync",
  "/orders", "/orders/:id", "/payments/qr/create", "/payments/qr/verify", "/payments/checkout/order", "/payments/checkout/verify",
  "/auth/register/verify", "/auth/otp/request", "/auth/otp/login", "/auth/password-reset/request", "/auth/password-reset/confirm",
  "/admin/stats", "/admin/users", "/admin/users/:id", "/admin/orders", "/admin/orders/:id", "/admin/payments", "/admin/products", "/admin/products/:id",
  "/admin/categories", "/admin/categories/:id", "/admin/settings", "/admin/audit"
];
const routeMisses = requiredRoutes.filter((req) => !routes.some((r) => {
  const a = req.split("/");
  const b = r.split("/");
  return a.length === b.length && a.every((x, i) => x.startsWith(":") || x === b[i]);
}));

const schema = fs.readFileSync(path.join(root, "backend/database/schema.prisma"), "utf8").replace(/\s+/g, " ");
const migration = fs.readFileSync(path.join(root, "backend/database/migrations/0001_init/migration.sql"), "utf8");
const schemaTokens = [
  "model User", "model VerificationCode", "model Address", "model Category", "model Product", "model Cart", "model CartItem", "model PaymentIntent", "model Payment", "model Order", "model OrderItem", "model SiteSetting", "model AuditLog",
  "addresses Address[]", "wishlist WishlistItem[]", "cart Cart?", "orders Order[]", "paymentIntents PaymentIntent[]", "category Category", "items OrderItem[]", "product Product"
];
const schemaErrors = schemaTokens.filter((t) => !schema.includes(t));
const migrationTables = ["User", "Category", "Product", "Address", "WishlistItem", "Cart", "CartItem", "PaymentIntent", "Payment", "Order", "OrderItem", "SiteSetting", "AuditLog"];
const migrationErrors = migrationTables.filter((t) => !migration.includes(`CREATE TABLE "${t}"`));

const configErrors = [];
for (const f of ["backend/prisma.config.ts", "backend/src/lib/env.ts", "backend/src/database/prisma.ts", "backend/database/schema.prisma", "backend/database/seed.ts"]) {
  if (!fs.existsSync(path.join(root, f))) configErrors.push(`missing:${f}`);
}
const seedText = fs.readFileSync(path.join(root, "backend/database/seed.ts"), "utf8");
const menCatalogue = (seedText.match(/p\(\{[^\n]*gender:"Men"/g) ?? []).length;
const womenCatalogue = (seedText.match(/p\(\{[^\n]*gender:"Women"/g) ?? []).length;
if (menCatalogue !== 12) configErrors.push(`catalogue-men:${menCatalogue}`);
if (womenCatalogue !== 20) configErrors.push(`catalogue-women:${womenCatalogue}`);
if (seedText.includes('import "dotenv/config"')) configErrors.push("seed-imports-dotenv");
if (!fs.existsSync(path.join(root, "backend/package.json"))) configErrors.push("missing-backend-package");

const storefrontText = fs.readFileSync(path.join(root, "frontend/components/storefront/storefront.tsx"), "utf8");
const coupleTwinningImages = (storefrontText.match(/twinning:\[([\s\S]*?)\]/)?.[1].match(/https:\/\/images\.pexels\.com\//g) ?? []).length;
const coupleContrastImages = (storefrontText.match(/contrast:\[([\s\S]*?)\]/)?.[1].match(/https:\/\/images\.pexels\.com\//g) ?? []).length;
if (coupleTwinningImages !== 0) configErrors.push(`couple-twinning-remote-images:${coupleTwinningImages}`);
if (coupleContrastImages !== 0) configErrors.push(`couple-contrast-remote-images:${coupleContrastImages}`);

const frontendPage = fs.existsSync(path.join(root, "frontend/app/[[...path]]/page.tsx"));
if (!frontendPage) configErrors.push("missing-frontend-page");
if (fs.existsSync(path.join(root, "admin"))) configErrors.push("separate-admin-directory-still-present");

console.log(`FILES_SCANNED=${files.length}`);
console.log(`SYNTAX_ERRORS=${syntax}`);
console.log(`JSON_ERRORS=${jsonErrors}`);
console.log(`MISSING_LOCAL_IMAGES=${missingImages.length}`);
console.log(`WORKSPACE_PROTOCOL_ERRORS=${packageErrors.length}`);
console.log(`PACKAGE_IMPORT_ERRORS=${packageImportErrors.length}`);
console.log(`LOCAL_IMPORT_ERRORS=${localImportErrors.length}`);
console.log(`UNSAFE_ROUTE_PARAM_REFERENCES=${unsafeParams.length}`);
console.log(`ROUTE_CONTRACT_MISSES=${routeMisses.length}`);
console.log(`PRISMA_SCHEMA_ERRORS=${schemaErrors.length}`);
console.log(`PRISMA_MIGRATION_ERRORS=${migrationErrors.length}`);
console.log(`EXTERNAL_IMAGE_REFERENCES=${externalImages.length}`);
console.log(`COUPLE_TWINNING_IMAGES=${coupleTwinningImages}`);
console.log(`COUPLE_CONTRAST_IMAGES=${coupleContrastImages}`);
console.log(`CONFIG_ERRORS=${configErrors.length}`);
console.log(`CATALOGUE_MEN=${menCatalogue}`);
console.log(`CATALOGUE_WOMEN=${womenCatalogue}`);
console.log(`CATALOGUE_TOTAL=${menCatalogue + womenCatalogue}`);

if (missingImages.length) console.log(missingImages.join("\n"));
if (packageErrors.length) console.log(packageErrors.join("\n"));
if (packageImportErrors.length) console.log(packageImportErrors.join("\n"));
if (localImportErrors.length) console.log(localImportErrors.join("\n"));
if (unsafeParams.length) console.log(unsafeParams.join("\n"));
if (routeMisses.length) console.log(routeMisses.join("\n"));
if (schemaErrors.length) console.log(schemaErrors.join("\n"));
if (migrationErrors.length) console.log(migrationErrors.join("\n"));
if (externalImages.length) console.log(externalImages.join("\n"));
if (configErrors.length) console.log(configErrors.join("\n"));

if (syntax || jsonErrors || missingImages.length || packageErrors.length || packageImportErrors.length || localImportErrors.length || unsafeParams.length || routeMisses.length || schemaErrors.length || migrationErrors.length || configErrors.length) process.exit(1);
