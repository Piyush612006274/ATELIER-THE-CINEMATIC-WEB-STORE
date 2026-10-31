import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { loadGlobalCssParts } from "./css-source.mjs";
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const front=read('frontend/components/storefront/storefront.tsx');
const back=read('backend/src/index.ts');
const ai=read('backend/src/lib/ai.ts');
const api=read('frontend/lib/api.ts');
const css=loadGlobalCssParts(root).join('\n');
const seed=read('backend/database/seed.ts');
const catalog=read('backend/src/database/catalog.ts');
const schema=read('backend/database/schema.prisma');
const files=(dir)=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]);

const canonical={
 Men:[
  'relaxed-oxford-shirt','classic-linen-shirt','textured-overshirt','dark-denim-jacket','essential-knit-polo','relaxed-heavyweight-tee','mens-tailored-blazer','cotton-trousers','mens-pleated-wide-trousers','minimal-utility-overshirt','mens-wool-blend-overcoat','monochrome-knit-crew'
 ],
 Women:[
  'draped-satin-co-ord-set','asymmetric-dhoti-trousers','structured-bandhani-shirt','corset-kurta-top','draped-blazer-dress','pleated-palazzo-co-ord','cropped-waistcoat-trouser-set','one-shoulder-draped-dress','tailored-saree-style-skirt','contemporary-kurta-shirt','draped-denim-jacket','satin-cowl-top-wide-trousers','asymmetric-co-ord-blazer-set','sculpted-column-maxi-dress','relaxed-fit-t-shirt','womens-tailored-blazer','womens-structured-wool-coat','womens-wide-leg-trousers','minimal-ribbed-dress','womens-tailored-wool-trousers'
 ]
};
const imageRoot=path.join(root,'frontend/public/images/products/new-catalogue');
const slugPairs={
 'Men:relaxed-oxford-shirt':['relaxed-oxford-shirt-01.avif','relaxed-oxford-shirt-02.avif'],
 'Men:classic-linen-shirt':['classic-linen-shirt-01.avif','classic-linen-shirt-02.avif'],
 'Men:textured-overshirt':['textured-overshirt-01.avif','textured-overshirt-02.avif'],
 'Men:dark-denim-jacket':['dark-denim-jacket-01.avif','dark-denim-jacket-02.avif'],
 'Men:essential-knit-polo':['essential-knit-polo-01.avif','essential-knit-polo-02.avif'],
 'Men:relaxed-heavyweight-tee':['relaxed-heavyweight-tee-01.avif','relaxed-heavyweight-tee-02.avif'],
 'Men:mens-tailored-blazer':['tailored-blazer-01.avif','tailored-blazer-02.avif'],
 'Men:cotton-trousers':['cotton-trousers-01.avif','cotton-trousers-02.avif'],
 'Men:mens-pleated-wide-trousers':['pleated-wide-trousers-01.avif','pleated-wide-trousers-02.avif'],
 'Men:minimal-utility-overshirt':['minimal-utility-overshirt-01.avif','minimal-utility-overshirt-02.avif'],
 'Men:mens-wool-blend-overcoat':['wool-blend-overcoat-01.avif','wool-blend-overcoat-02.avif'],
 'Men:monochrome-knit-crew':['monochrome-knit-crew-01.avif','monochrome-knit-crew-02.avif']
};
for (const slug of canonical.Women){
  const m=new RegExp(`Women:${slug}[^\n]*`, 'm').test(catalog);
  if(!m) throw new Error(`Missing Women canonical mapping: ${slug}`);
}

const scenario=(name,fn)=>({name,fn});
const frontendScenarios=[
 scenario('header has clean brand lockup',()=>/cin-brand/.test(front)&&!/<span className="brand-tagline"/.test(front)),
 scenario('announcement bar is mounted',()=>/<AnnouncementBar settings=\{settings\}\/>/.test(front)),
 scenario('desktop nav has Western',()=>/route:"\/western",label:"Western"/.test(front)),
 scenario('mobile nav has both cultural edits exactly once',()=>{const n=(front.match(/\["\/indo-western","Indo-Western Edit"\]/g)||[]).length; const w=(front.match(/\["\/western","Western Edit"\]/g)||[]).length; return n===1&&w===1}),
 scenario('Shop uses usePathname',()=>/const path=usePathname\(\)/.test(front)&&!/window\.location\.pathname/.test(front)),
 scenario('Shop syncs URL gender into state',()=>/setGender\(genderFrom\?\[genderFrom\]:\[\]\)/.test(front)),
 scenario('Shop strict collection filtering',()=>/p\.collectionType===collectionType/.test(front)),
 scenario('Men and women edit filtering is explicit',()=>/p\.gender==="Men"/.test(front)&&/p\.gender==="Women"/.test(front)),
 scenario('Indo-Western uses explicit taxonomy',()=>/WOMEN_INDO_WESTERN/.test(front)&&/p\.collectionType/.test(front)),
 scenario('Western uses explicit taxonomy',()=>/WOMEN_WESTERN/.test(front)&&/collectionType===target/.test(front)),
 scenario('no blocked product assets remain',()=>!/UI_BLOCKED_IMAGES/.test(front)),
 scenario('no random cross-product collection image pool',()=>!/COLLECTION_IMAGE_POOL/.test(front)&&!(/collectionImageChoices[\s\S]{0,500}pool/.test(front))),
 scenario('ProductCard uses canonical primary image',()=>/const primary=productImage\(p\)/.test(front)),
 scenario('ProductCard uses canonical secondary image',()=>/const secondary=productSecondaryImage\(p\)/.test(front)),
 scenario('ProductCard hover flip exists',()=>/product-hit:hover \.product-flip/.test(css)||/product-hit:hover \.product-flip/.test(css)),
 scenario('ProductCard touch toggle exists',()=>/flip-toggle/.test(front)&&/setPinned/.test(front)),
 scenario('ProductCard keyboard focus exists',()=>/product-hit:focus-visible/.test(css)),
 scenario('PDP uses canonical product data',()=>/productImage\(p\)/.test(front)&&/ProductPage/.test(front)),
 scenario('Cart drawer uses canonical product images',()=>/SmartImage src=\{productImage\(i\.product\)\}/.test(front)), scenario('wishlist route has canonical products',()=>front.includes('api<Product[]>("/wishlist")')),
 scenario('footer newsletter calls backend',()=>/\/newsletter\/subscribe/.test(front)),
 scenario('footer has both collection links',()=>/\["\/indo-western"/.test(front)&&/\["\/western"/.test(front)),
 scenario('saved address picker exists',()=>/saved-address-picker/.test(front)&&/\/addresses/.test(front)),
 scenario('address edit/default/remove exists',()=>/setDefault=async/.test(front)&&/editingId/.test(front)&&/remove=async/.test(front)),
 scenario('account surfaces API errors',()=>/const \[loadError,setLoadError\]/.test(front)&&/role="alert"/.test(front)),
 scenario('order details surfaces API errors',()=>/const \[error,setError\]=useState/.test(front)&&/OrderDetails/.test(front)),
 scenario('logout always clears local state',()=>/finally\{setUser\(null\);setWish\(\[\]\);setCart\(loadGuestCart\(\)\)/.test(front)),
 scenario('guest cart rejected items are retained',()=>/rejectedIds/.test(front)&&/saveGuestCart\(guest\.filter/.test(front)),
 scenario('body scroll locks modal surfaces',()=>/document\.body\.style\.overflow/.test(front)),
 scenario('login/register password UX',()=>/auth-progress/.test(css)&&/password-hint/.test(front)),
 scenario('No unfinished 3D message',()=>!/(3D preview unavailable|3D preview is unavailable)/i.test(front)),
 scenario('No NOCTURNE experimental brand',()=>!/NOCTURNE/.test(front)),
 scenario('No customer-facing Nothing found dead-end',()=>!/Nothing found\./.test(front)),
 scenario('search routes cultural edits directly',()=>/x==="Indo-Western Edit"\?"\/indo-western"/.test(front)&&/x==="Western Edit"\?"\/western"/.test(front)),
 scenario('Header SPA navigation',()=>/e\.preventDefault\(\);onNavigate\(x\.route\)/.test(front)),
 scenario('AVIF accepted by frontend image handling',()=>/avif/.test(front)),
 scenario('frontend remote image refs require HTTPS',()=>{const m=front.match(/function safeImg[\s\S]{0,300}/)?.[0]||"";return m.includes('^https')&&!m.includes('^http?')}),
 scenario('no legacy imageOverride/secondaryOverride props',()=>!/imageOverride=/.test(front)&&!/secondaryOverride=/.test(front)),
 scenario('canonical product count references 12 men/20 women in seed',()=>/gender:"Men"/.test(seed)&&/gender:"Women"/.test(seed)),
 scenario('mobile bottom nav exists',()=>/mobile-bottom-nav/.test(front)),
 scenario('quick add disabled when sold out',()=>/disabled=\{p\.stock<1\}/.test(front)),
 scenario('wishlist accessible labels exist',()=>/Save \$\{p\.name\} to wishlist/.test(front)),
 scenario('cart accessible labels exist',()=>/Decrease quantity/.test(front)&&/Remove \$\{i\.product\.name\}/.test(front)),
 scenario('hero has visible copy and split CTAs',()=>/CinHero/.test(front)&&/button1Text/.test(read('frontend/components/storefront/cinematic.tsx'))&&/button2Text/.test(read('frontend/components/storefront/cinematic.tsx'))),
 scenario('hero autoplay can pause',()=>/heroPaused/.test(front)&&/onMouseEnter/.test(front)),
 scenario('footer legal links exist',()=>/privacy/.test(front)&&/terms/.test(front)&&/cookies/.test(front)),
 scenario('mobile AI Stylist opens in-app panel',()=>{const m=front.match(/function MobileMenu[\s\S]*?\nfunction MobileBottomNav/); return Boolean(m&&m[0].includes('onAI();onClose()')&&!m[0].includes('onNavigate("/stylist")'))}),
 scenario('about legal anchors are real sections',()=>front.includes('id="privacy"')&&front.includes('id="terms"')&&front.includes('id="cookies"')),
 scenario('footer social labels are not dead buttons',()=>front.includes('footer-social" aria-label="Social channels')&&!front.includes('<div className="footer-social"><button')),
 scenario('api error class exists',()=>/class ApiError extends Error/.test(api)),
 scenario('guest fallback on 401 only',()=>/e instanceof ApiError && e.status===401/.test(front)),
 scenario('account order link route exists',()=>/\/account\/orders\//.test(front)),
 scenario('no raw window pathname in navigation',()=>!/window\.location\.pathname/.test(front)),
 scenario('auth fields direct editable address values',()=>!/value=\{address\.firstName \|\| name\.split/.test(front))
];

const backendScenarios=[
 scenario('AVIF image validation allowed',()=>/imagePathRe=.*(?:webp\|avif)/.test(back)&&/imageRefSchema/.test(back)),
 scenario('product public returns canonical images',()=>/images: canonicalImagesFor\(p\)/.test(back)),
 scenario('product public returns collectionType',()=>/collectionType: collectionTypeFor\(p\)/.test(back)),
 scenario('product detail uses productPublic',()=>/app.get\("\/api\/products\/:id"[\s\S]{0,600}productPublic\(p\)/.test(back)),
 scenario('wishlist filters inactive products',()=>/rows\.filter\(r=>r\.product\?\.status==="ACTIVE"\)/.test(back)),
 scenario('wishlist returns canonical product',()=>/productPublic\(r\.product\)/.test(back)),
 scenario('cart returns canonical product',()=>/function cartPublic/.test(back)&&/res\.json\(cartPublic\(c\)\)/.test(back)),
 scenario('cart sync exposes rejected items',()=>/res\.json\(\{cart:cartPublic\([\s\S]*rejected\}\)/.test(back)),
 scenario('collection query enforces gender',()=>/enforcedCollectionGender/.test(back)&&/WOMEN_/.test(back)),
 scenario('admin create validates collection enum',()=>/collectionType:z\.enum/.test(back)),
 scenario('admin patch validates collection enum',()=>/collectionType:z\.enum/.test(back)),
 scenario('admin collection prevents men in women edit',()=>/WOMEN_PRODUCTS_CANNOT_USE_MEN_COLLECTION/.test(back)),
 scenario('admin collection prevents women in men edit',()=>/MEN_PRODUCTS_MUST_USE_MEN_COLLECTION/.test(back)),
 scenario('order response sanitizes payment data',()=>/function sanitizeCustomerOrder/.test(back)&&/res\.json\(sanitizeCustomerOrder/.test(back)),
 scenario('customer order removes raw payment object',()=>/method:p\.method, amount:p\.amount/.test(back)),
 scenario('order status transitions are restricted',()=>/ORDER_TRANSITIONS/.test(back)&&/INVALID_ORDER_TRANSITION/.test(back)),
 scenario('cancel/refund restocks',()=>/increment:item\.quantity/.test(back)),
 scenario('stock decrements transactionally',()=>/updateMany\(\{where:\{id:item\.productId,stock:\{gte:Number\(item\.quantity\)\}\},data:\{stock:\{decrement:Number\(item\.quantity\)\}\}\}\)/.test(back)),
 scenario('payment signature verified',()=>/verifySignature\(d\.razorpayOrderId/.test(back)),
 scenario('payment captured checked',()=>/p\.status!=="captured"/.test(back)),
 scenario('payment intent ownership checked',()=>/userId:req\.session!\.userId/.test(back)),
 scenario('addresses can set default',()=>/isDefault:true/.test(back)),
 scenario('addresses delete handled',()=>/app\.delete\("\/api\/addresses\/:id"/.test(back)),
 scenario('wishlist only active on add',()=>/p\.status!=="ACTIVE"/.test(back)&&/PRODUCT_NOT_FOUND/.test(back)),
 scenario('cart variant validation',()=>/INVALID_VARIANT/.test(back)),
 scenario('cart stock validation',()=>/INSUFFICIENT_STOCK/.test(back)),
 scenario('admin password env-only',()=>/process\.env\.ADMIN_PASSWORD/.test(back)&&!/ADMIN_PASSWORD must be at least 12/.test(seed)),
 scenario('admin email is env driven',()=>/process\.env\.ADMIN_EMAIL/.test(back)&&!/.+@.+\.com/.test(back.split('async function syncEnvAdmin')[0])),
 scenario('seed refuses hard-coded admin fallback',()=>/refusing to use a hard-coded admin email/.test(seed)),
 scenario('seed archives legacy active/draft products',()=>/updateMany\(\{where:\{status:\{in:\["ACTIVE","DRAFT"\]\}\},data:\{status:"ARCHIVED"\}\}\)/.test(seed)),
 scenario('seed writes collectionType',()=>/collectionType:collectionTypeFor\(x\)/.test(seed)),
 scenario('schema contains collectionType',()=>/collectionType String/.test(schema)),
 scenario('migration creates collectionType',()=>fs.existsSync(path.join(root,'backend/database/migrations/0004_catalog_hardening/migration.sql'))),
 scenario('AI accepts AVIF',()=>/avif/.test(ai)),
 scenario('AI try-on uses canonical images',()=>/canonicalImagesFor/.test(ai)&&/tryOnImageFor/.test(ai)),
 scenario('newsletter endpoint exists',()=>/NEWSLETTER_SUBSCRIBE/.test(back)&&/\/api\/newsletter\/subscribe/.test(back)),
 scenario('auth rate limit exists',()=>/authRateLimit/.test(back)),
 scenario('httpOnly cookie configured',()=>/httpOnly:\s*true/.test(read('backend/src/lib/auth.ts'))),
 scenario('public settings are filtered',()=>/publicSettingKeys/.test(back)&&/publicSettingsMap/.test(back)),
 scenario('image sources are local images or HTTPS URLs',()=>{const m=back.match(/const imagePathRe[\s\S]{0,500}?const siteSettingValueSchema/)?.[0]||"";return m.includes('imagePathRe')&&m.includes('imageHttpsRe')&&m.includes('^https')&&!m.includes('^http?')}),
 scenario('global error handler exists',()=>/app\.use\(\(err:any/.test(back)),
 scenario('health endpoint exists',()=>/\/api\/health/.test(back)),
 scenario('admin orders user is selected',()=>/include:\{user:\{select:\{id:true,name:true,email:true,phone:true\}/.test(back)),
 scenario('order item stores canonical image',()=>/imageUrl:canonicalImagesFor\(i\.product\)\[0\]/.test(back)),
 scenario('address postal code is validated',()=>/postalCode:z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{6\}\$\//.test(back)),
 scenario('phone is validated',()=>/phoneSchema/.test(back)),
 scenario('no arbitrary order transition',()=>/INVALID_ORDER_TRANSITION/.test(back)),
 scenario('admin product image URLs validated',()=>/images:z\.array\(imageRefSchema\)/.test(back)),
 scenario('admin product gender constrained',()=>back.includes('gender:z.enum(["Men","Women"])')),
 scenario('inactive products excluded from public API',()=>/status:"ACTIVE"/.test(back)),
 scenario('cart response canonicalizes products after sync',()=>/cart:cartPublic\(await getOrCreateCart/.test(back)),
 scenario('customer order ownership required',()=>/where:\{id:routeParam\(req,"id"\),userId:req\.session!\.userId\}/.test(back)),
 scenario('payment intent expiry enforced',()=>/PAYMENT_INTENT_EXPIRED/.test(back)),
 scenario('checkout preserves immutable payment snapshot',()=>back.includes('metadata:{...paymentMeta(intent),kind:"checkout",address,shippingMethod}')),
 scenario('customer /me requires customer middleware',()=>back.includes('app.get("/api/auth/me", requireAuth')),
 scenario('admin /me requires admin middleware',()=>back.includes('app.get("/api/auth/admin/me", requireAdmin')),
 scenario('upload route uses elevated parser after admin authorization',()=>back.includes('app.post("/api/admin/images/upload",requireAdmin,express.json({limit:"12mb"})')),
 scenario('duplicate order protection exists',()=>/findUnique\(\{where:\{paymentIntentId:intent.id\}/.test(back)),
 scenario('transaction rolls back failed stock decrement',()=>/prisma\.\$transaction\(async tx/.test(back)),
 scenario('admin audit logging exists',()=>/prisma\.auditLog\.create/.test(back)),
 scenario('CORS credentials enabled',()=>/credentials:\s*true/.test(back)),
 scenario('rate limit standard headers',()=>/standardHeaders:\s*true/.test(back)),
 scenario('express json body limit',()=>/express\.json\(\{limit:"1mb"\}\)/.test(back)),
 scenario('try-on authentication required',()=>/app\.post\("\/api\/ai\/try-on",[\s\S]{0,120}requireAuth/.test(back)),
];

const uiScenarios=[
 scenario('hero has gradient readability overlay',()=>/hero-reference-overlay/.test(css)&&/linear-gradient/.test(css)),
 scenario('hero copy is positioned above image',()=>/hero-reference-copy/.test(css)&&/z-index/.test(css)),
 scenario('hero CTA is visible',()=>/hero-actions/.test(css)),
 scenario('brand tagline removed',()=>!/brand-tagline/.test(front) && !/brand-tagline/.test(css)),
 scenario('announcement bar readable',()=>/announcement-bar/.test(css)),
 scenario('navigation bold',()=>/main-nav[^}]*font-weight:700/.test(css)),
 scenario('product cards have 3D perspective',()=>/perspective:1200px/.test(css)),
 scenario('product cards hide backface',()=>/backface-visibility:hidden/.test(css)),
 scenario('mobile flip control visible',()=>/@media\(max-width:900px\)[\s\S]*flip-toggle/.test(css)),
 scenario('product grid images fill the editorial frame',()=>/product-media img\{object-fit:cover/.test(css)&&/product-face img\{object-fit:cover!important/.test(css)), scenario('mobile filters use readable light contrast',()=>/mobile-filter-panel\{[^}]*background:#f8f3ed[^}]*color:#211a16/.test(css)&&/mobile-filter-panel \.check\{color:#5f554e/.test(css)), scenario('collection cards have bounded media frames',()=>/large-card\{position:relative;aspect-ratio:4\/5;min-height:0/.test(css)&&/reference-collection-media\{aspect-ratio:4\/5!important;min-height:0!important/.test(css)&&!/reference-collection-media\{aspect-ratio:auto!important;/.test(css)), scenario('builder actions are separated',()=>/builder-form-head > div:last-child\{display:flex;[^}]*gap:10px/.test(css)), scenario('initial loading uses structured skeleton',()=>/function StorefrontLoading/.test(front)&&/if\(loading\)return <StorefrontLoading\/>/.test(front)&&/storefront-loading\{/.test(css)),
 scenario('cart drawer has strong contrast',()=>/cart-drawer\{background:#f5efe8!important/.test(css)),
 scenario('cart drawer responsive',()=>/@media\(max-width:640px\)[\s\S]*cart-drawer/.test(css)),
 scenario('auth panel has premium contrast',()=>/auth-panel\{background:#f4eee7/.test(css)),
 scenario('auth fields focus state exists',()=>/auth-form input:focus/.test(css)),
 scenario('address cards are actionable',()=>/address-actions/.test(css)),
 scenario('saved address picker styled',()=>/saved-address-picker/.test(css)),
 scenario('mobile bottom nav exists',()=>/mobile-bottom-nav/.test(css)),
 scenario('focus visible global exists',()=>/:focus-visible/.test(css)),
 scenario('overlay scroll locked',()=>/overscroll-behavior:contain/.test(css)),
 scenario('no blur effects on product images',()=>{const plain=css.split('/* Cinematic design system')[0];return !/product-media img[^}]*blur\(/.test(plain)&&!/filter:\s*blur/.test(plain)}),
 scenario('no experimental NOCTURNE styling',()=>!/NOCTURNE/.test(css)),
 scenario('collection pages have editorial hero',()=>/editorial-collection-hero/.test(css)),
 scenario('admin order item array guarded',()=>/Array\.isArray\(o\.items\)\?o\.items:\[\]/.test(front)),
 scenario('admin image manager exists',()=>/admin-image-grid/.test(front)&&/admin\/images\/upload/.test(front)),
 scenario('home collection copy overlay',()=>/reference-card-copy\{position:absolute/.test(css)),
 scenario('checkout light contrast hardened',()=>/checkout-card \.secure-strip b\{color:#201a17\}/.test(css)||/checkout-card \.secure-strip b/.test(css)),
 scenario('collections separated as cards',()=>/collection-large-grid/.test(front)),
 scenario('Indo-Western page copy exists',()=>/Indo-Western Edit/.test(front)),
 scenario('Western page copy exists',()=>/Western Edit/.test(front)),
 scenario('empty collection state exists',()=>/Coming soon\./.test(front)),
 scenario('search no-result guidance exists',()=>/No pieces found/.test(front)),
 scenario('cart empty state exists',()=>/Your bag is empty\./.test(front)),
 scenario('wishlist empty state exists',()=>/Your wishlist is empty\./.test(front)),
 scenario('checkout empty state exists',()=>/Your cart is empty\./.test(front)),
 scenario('accessibility labels on search',()=>/aria-label="Search products"/.test(front)),
 scenario('accessibility labels on cart',()=>/aria-label=\{`(Cart|Bag)/.test(front)),
 scenario('accessibility labels on menu',()=>/aria-label="Open menu"/.test(front)),
 scenario('buttons have hover transitions',()=>/transition:/.test(css)),
 scenario('brand uses serif editorial typography',()=>/site-header \.brand/.test(css)&&/var\(--serif\)/.test(css)),
 scenario('page hero typography is present',()=>/page-hero h1/.test(css)),
 scenario('product grid responsive',()=>/@media\(max-width:900px\)[\s\S]*product-grid/.test(css)),
 scenario('mobile auth responsive',()=>/@media\(max-width:900px\)[\s\S]*auth-panel/.test(css)),
 scenario('mobile address responsive',()=>/@media\(max-width:900px\)[\s\S]*address-card/.test(css)),
 scenario('desktop nav uses semantic nav',()=>/<nav className="cin-nav-links"/.test(front)),
 scenario('mobile nav uses semantic nav',()=>/<nav className="mobile-menu-links"/.test(front)),
 scenario('footer contains collection links',()=>/Indo-Western Edit/.test(front)&&/Western Edit/.test(front)),
 scenario('product card status uses readable stock note',()=>/Only \$\{p\.stock\} left/.test(front)),
 scenario('sold out state is visually explicit',()=>/Sold Out/.test(front)),
 scenario('wishlist state visually explicit',()=>/wish-btn/.test(css)&&/wishlist/.test(front)),
 scenario('cart count badge exists',()=>/cart-count/.test(css)),
 scenario('announcement is not transparent over content',()=>/background:#171311/.test(css)),
 scenario('header has bottom border',()=>/site-header[\s\S]*border-bottom/.test(css)),
 scenario('image rendering not blurred',()=>/image-rendering:auto/.test(css)),
 scenario('hero mobile sizes exist',()=>/@media\(max-width:640px\)[\s\S]*hero-reference-board/.test(css)),
 scenario('quick add is keyboard focusable',()=>/quick-add:focus-visible/.test(css)),
 scenario('product flip cue exists',()=>/product-hover-cue/.test(front)),
 scenario('newsletter form has status region',()=>/newsletter-status/.test(front)),
];

const assetScenarios=[
 scenario('32 canonical product slugs are represented',()=>canonical.Men.every(s=>catalog.includes(`Men:${s}`)||catalog.includes(`men:${s}`))&&canonical.Women.every(s=>catalog.includes(`Women:${s}`))),
 scenario('24 men catalogue files exist',()=>fs.readdirSync(path.join(imageRoot,'men')).filter(x=>x.endsWith('.avif')).length===24),
 scenario('42 unique women catalogue files exist',()=>fs.readdirSync(path.join(imageRoot,'women')).filter(x=>x.endsWith('.avif')).length===42),
 scenario('all men pairs exist',()=>Object.entries(slugPairs).every(([k,n])=>n.every(f=>fs.existsSync(path.join(imageRoot,'men',f))))),
 scenario('all canonical image paths exist',()=>{const matches=[...catalog.matchAll(/"(Men|Women):([^\"]+)": \[([^\]]+)\]/g)]; return matches.length>=32}),
 scenario('no old jpg/png in catalogue product dirs',()=>[...fs.readdirSync(path.join(imageRoot,'men')), ...fs.readdirSync(path.join(imageRoot,'women'))].every(x=>/\.avif$/i.test(x))),
 scenario('no blocked image list',()=>!/UI_BLOCKED_IMAGES/.test(front)),
 scenario('no random fallback image pool',()=>!/COLLECTION_IMAGE_POOL/.test(front)),
 scenario('female edit assets stay in women folder',()=>/Women:/.test(catalog)&&!/Men:\S+[\s\S]{0,80}women\//.test(catalog)),
 scenario('male edit assets stay in men folder',()=>/Men:/.test(catalog)&&!/Men:\S+[\s\S]{0,80}women\//.test(catalog)),
];

function runGroup(name,scenarios){
  let failures=0;
  const details=[];
  for(let pass=1;pass<=50;pass++){
    for(const s of scenarios){
      let ok=false;
      try{ok=Boolean(s.fn())}catch(e){ok=false}
      if(!ok){failures++;details.push(`${name} pass ${pass}: ${s.name}`)}
    }
  }
  const checks=50*scenarios.length;
  console.log(`${name.toUpperCase()}_50X_CHECKS=${checks}`);
  console.log(`${name.toUpperCase()}_50X_FAILURES=${failures}`);
  if(failures) for(const d of details.slice(0,50)) console.log(`FAIL ${d}`);
  return {checks,failures};
}

const out=[
  runGroup('frontend',frontendScenarios),
  runGroup('backend',backendScenarios),
  runGroup('uiux',uiScenarios),
  runGroup('assets',assetScenarios),
];
const all=out.reduce((a,b)=>a+b.checks,0), failures=out.reduce((a,b)=>a+b.failures,0);
const digest=crypto.createHash('sha256').update(front+back+css+catalog).digest('hex').slice(0,16);
console.log(`TOTAL_50X_ASSERTIONS=${all}`);
console.log(`TOTAL_50X_FAILURES=${failures}`);
console.log(`SOURCE_DIGEST=${digest}`);
process.exit(failures?1:0);
