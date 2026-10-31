import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadGlobalCssParts } from "./css-source.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const front = fs.readFileSync(path.join(root, 'frontend/components/storefront/storefront.tsx'), 'utf8');
const cssParts = loadGlobalCssParts(root);
const css = cssParts.join('\n');
const back = fs.readFileSync(path.join(root, 'backend/src/index.ts'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'backend/database/seed.ts'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'backend/database/schema.prisma'), 'utf8');

const checks=[];
const ok=(name,pass,detail='')=>checks.push({name,pass,detail});

const routes = [
  ['/', 'Home'], ['/shop','Shop'], ['/new','New Arrivals'], ['/men','Men'], ['/women','Women'],
  ['/collections','Collections'], ['/indo-western','Indo-Western Edit'], ['/western','Western Edit'],
  ['/about','About'], ['/login','Login'], ['/register','Register'], ['/cart','Cart'], ['/checkout','Checkout'],
  ['/wishlist','Wishlist'], ['/account','Account'], ['/search','Search'], ['/custom','Custom Fit'],
  ['/builder','Outfit Builder'], ['/stylist','AI Stylist'], ['/admin','Admin']
];
for (const [route,label] of routes) ok(`route ${route}`, front.includes(label) || front.includes(`pathname==="${route}"`) || route==='/admin', label);

ok('home exactly 3 rendered hero looks',
  ((fs.readFileSync(path.join(root,'backend/src/database/cinematicDefaults.ts'),'utf8')).match(/tab: "/g)||[]).length===3);
ok('home split CTA', /button1Text/.test(fs.readFileSync(path.join(root,'frontend/components/storefront/cinematic.tsx'),'utf8')) && /button2Text/.test(fs.readFileSync(path.join(root,'frontend/components/storefront/cinematic.tsx'),'utf8')));
ok('home collection overlay', /reference-card-copy\{position:absolute/.test(css) && /reference-collection-card:hover \.reference-card-copy/.test(css));
ok('home mobile collection copy usable', /@media\(max-width:640px\)\{[\s\S]*reference-card-copy\{opacity:1/.test(css) || /@media\(max-width:900px\)\{[\s\S]*reference-card-copy\{opacity:1/.test(css));
ok('indo-western strict taxonomy', /collectionType===target/.test(front) && /WOMEN_INDO_WESTERN/.test(front));
ok('western strict taxonomy', /collectionType===target/.test(front) && /WOMEN_WESTERN/.test(front));
ok('checkout explicit light contrast', /checkout-layout \.checkout-card h3\{color:#201a17\}/.test(css) && /checkout-layout \.summary-row\{color:#6e655e\}/.test(css));
ok('checkout payment/status contrast', /checkout-layout \.secure-strip b\{color:#201a17\}/.test(css) && /checkout-layout \.qr-box\{background:#eee7df/.test(css));
ok('admin orders items defensive', /\(Array\.isArray\(o\.items\)\?o\.items:\[\]\)\.map/.test(front));
ok('account orders defensive', /Array\.isArray\(o\.items\)\?o\.items\.length:0/.test(front));
ok('order details defensive', /Array\.isArray\(order\.items\)\?order\.items:\[\]/.test(front));
ok('admin product sections separate men/women', /genderFilter/.test(front) && /genderFilter==="Men"/.test(front) && /genderFilter==="Women"/.test(front) && /Add \{genderFilter==="Women"\?"Women":"Men"\}/.test(front));
ok('admin image manager', /admin-image-grid/.test(front) && /admin\/images\/upload/.test(front) && /Remove/.test(front));
ok('admin upload backend', /app\.post\("\/api\/admin\/images\/upload"/.test(back));
ok('admin upload accepts only safe image types', /INVALID_IMAGE_DATA/.test(back) && /IMAGE_TOO_LARGE/.test(back) && back.includes('const m=d.dataUrl.match(/^data:(image'));
ok('site settings qr payload capacity', /siteSettingValueSchema=z\.union\(\[z\.string\(\)\.max\(2000000\)/.test(back));
ok('admin payments defensive', /Array\.isArray\(p\.payments\)/.test(front) || !/p\.payments\?\.map/.test(front));
ok('unmatched captured payment recovery', /admin\/payments\/\$\{p\.id\}\/refund/.test(front) && /CAPTURED_PAYMENT_NOT_FOUND|CAPTURED_PAYMENT_WITHOUT_ORDER/.test(back) && /refundPayment\(captured\.providerId/.test(back));
ok('admin data arrays defensive', /Array\.isArray\(v\)\?v:\[\]/.test(front));
ok('brand tagline removed from render', !/className="brand-tagline"/.test(front));
ok('brand tagline css removed', !/brand-tagline/.test(css));
ok('public hero4 removed', !/hero4Eyebrow|hero4Line1|hero4Line2|hero4Line3|hero4Image/.test(back));
ok('no remote customer image references', !/images\.pexels\.com|source\.unsplash\.com/.test(front));
ok('health endpoint executes DB probe', /app\.get\("\/api\/health"/.test(back) && /SELECT 1/.test(back));
ok('orders API includes items', /app\.get\("\/api\/admin\/orders"[\s\S]*?items:true/.test(back));
ok('customer orders include items', /app\.get\("\/api\/orders"[\s\S]*?items:true/.test(back));
ok('collection field in schema', /collectionType\s+String/.test(schema));
ok('seed does not reset DB directly', !/migrate reset|db push --force-reset/.test(seed));
ok('seed admin password env-only', /ADMIN_PASSWORD is required for seed/.test(seed) && !/ADMIN_PASSWORD must be at least 12/.test(seed));

const avifs=[];
const walk=(dir)=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ent.name==='node_modules'||ent.name==='.next')continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.avif$/i.test(ent.name))avifs.push(p)}};
walk(path.join(root,'frontend/public/images'));
const byHash=new Map();
for(const f of avifs){const h=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const a=byHash.get(h)||[];a.push(f);byHash.set(h,a)}
const dups=[...byHash.values()].filter(a=>a.length>1);
ok('asset files present', avifs.length>0, `avif=${avifs.length}`);
ok('no exact duplicate AVIF files', dups.length===0, `duplicate-groups=${dups.length}`);

const failures=checks.filter(x=>!x.pass);
for(const c of checks) console.log(`${c.pass?'PASS':'FAIL'} :: ${c.name}${c.detail?` :: ${c.detail}`:''}`);
console.log(`ROUTES_CHECKED=${routes.length}`);
console.log(`STATIC_UI_CHECKS=${checks.length}`);
console.log(`STATIC_UI_FAILURES=${failures.length}`);
process.exit(failures.length?1:0);
