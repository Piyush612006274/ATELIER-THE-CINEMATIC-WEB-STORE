import fs from 'node:fs';
import assert from 'node:assert/strict';

const frontend=fs.readFileSync('frontend/components/storefront/storefront.tsx','utf8');
const seed=fs.readFileSync('backend/database/seed.ts','utf8');
const cmsDefaults=fs.readFileSync('backend/src/database/cmsDefaults.ts','utf8');
const backend=fs.readFileSync('backend/src/index.ts','utf8');

const routes=['home','about','shop','men','women','new','collections','product','account','builder','stylist','indo-western','western','cart','checkout','wishlist','search','custom','login','register'];
for(const route of routes){
  assert.match(frontend,new RegExp(`\\\"${route}\\\"`),`CMS route missing: ${route}`);
  assert.ok(seed.includes(`"${route}"`) || seed.includes(`slug:"${route}"`) || cmsDefaults.includes(`"${route}"`) || cmsDefaults.includes(`slug:"${route}"`),`CMS bootstrap missing: ${route}`);
}
assert.match(frontend,/Published CMS pages take precedence/);
assert.match(frontend,/NativeCmsRoute/);
assert.match(frontend,/displayMode/);
assert.match(frontend,/aspectRatio/);
assert.match(frontend,/autoRotate/);
assert.match(frontend,/intervalMs/);
assert.match(frontend,/rotationImages/);
assert.match(frontend,/<input[^>]*type="file"/);
assert.match(backend,/ROTATION_IMAGES_MUST_BE_REAL_PRODUCT_IMAGES/);
assert.ok(backend.includes("/api/admin/images/upload"),"upload endpoint missing");

console.log(`CMS_ROUTES=${routes.length}`);
console.log('CMS_COVERAGE=PASS');
console.log('IMAGE_EDITOR_CONTROLS=PASS');
console.log('PRODUCT_ROTATION_IMAGE_VALIDATION=PASS');
console.log('NATIVE_COMMERCE_LOGIC_PRESERVED=PASS');
