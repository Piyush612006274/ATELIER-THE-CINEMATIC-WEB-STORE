import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const frontend=fs.readFileSync(path.join(root,'frontend/components/storefront/storefront.tsx'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/src/index.ts'),'utf8');
const results=[];
const check=(name,ok,detail)=>results.push({name,ok,detail});

const routes=[];
const routeRe=/app\.(get|post|patch|put|delete)\(["']\/api([^"']+)["']/g;
let m;
while((m=routeRe.exec(backend))) routes.push(`${m[1].toUpperCase()} ${m[2]}`);

const required=[
  'GET /admin/stats',
  'GET /admin/users','GET /admin/users/:id','PATCH /admin/users/:id','POST /admin/users/:id/block','POST /admin/users/:id/unblock','DELETE /admin/users/:id',
  'GET /admin/orders','GET /admin/payments','PATCH /admin/orders/:id','POST /admin/payments/:id/refund',
  'GET /admin/products','POST /admin/products','PATCH /admin/products/:id','DELETE /admin/products/:id',
  'GET /admin/categories','POST /admin/categories','PATCH /admin/categories/:id','DELETE /admin/categories/:id',
  'GET /admin/settings','PUT /admin/settings',
  'GET /admin/audit','DELETE /admin/audit','DELETE /admin/audit/:id',
  'GET /admin/pages','POST /admin/pages','PATCH /admin/pages/:id','DELETE /admin/pages/:id','POST /admin/pages/:id/reset',
  'POST /admin/images/upload','POST /admin/sections/:id/duplicate','PATCH /admin/sections/:id','DELETE /admin/sections/:id','POST /admin/pages/:id/sections'
];
for(const r of required) check(`Backend route ${r}`,routes.includes(r),routes.includes(r)?'implemented':'missing');

const sections=['dashboard','products','orders','payments','users','categories','builder','settings','audit'];
for(const section of sections) check(`Admin section ${section}`,new RegExp(`section\\s*===\\s*[\"']${section}[\"']`).test(frontend),'render branch present');

check('Sidebar collapse control',frontend.includes('sidebarCollapsed')&&frontend.includes('Collapse')&&frontend.includes('aria-expanded={!sidebarCollapsed}'),'desktop collapse/expand present');
check('Mobile open/close control',frontend.includes('mobileNavOpen')&&frontend.includes('Open menu')&&frontend.includes('Close menu'),'mobile drawer present');
check('Preview open/close control',frontend.includes('previewOpen')&&frontend.includes('Close Live Preview'),'storefront preview present');
check('Audit row deletion',frontend.includes('/admin/audit/${id}')&&frontend.includes('Delete this audit event permanently'),'per-event deletion wired');
check('Audit bulk deletion',frontend.includes('/admin/audit',{method:'DELETE'})&&frontend.includes('DELETE AUDIT'),'bulk deletion + typed confirmation wired');

const mutationPrefixes=[
  'app.delete("/api/admin/audit/:id",requireAdmin',
  'app.delete("/api/admin/audit",requireAdmin',
  'app.patch("/api/admin/products/:id",requireAdmin',
  'app.put("/api/admin/settings",requireAdmin',
  'app.patch("/api/admin/orders/:id",requireAdmin',
  'app.post("/api/admin/payments/:id/refund",requireAdmin',
  'app.delete("/api/admin/users/:id",requireAdmin',
  'app.post("/api/admin/categories",requireAdmin',
  'app.patch("/api/admin/categories/:id",requireAdmin',
  'app.delete("/api/admin/categories/:id",requireAdmin',
  'app.post("/api/admin/sections/:id/duplicate",requireAdmin'
];
for(const prefix of mutationPrefixes) check(`Authorization ${prefix}`,backend.includes(prefix),'requireAdmin enforced');

const auditActions=[
  'CREATE_PAGE','UPDATE_PAGE','DELETE_PAGE','CREATE_SECTION','UPDATE_SECTION','DELETE_SECTION','DUPLICATE_SECTION',
  'RESET_PAGE','UPDATE_USER','BLOCK_USER','UNBLOCK_USER','DELETE_USER','UPDATE_STATUS','REFUND_ORDER','CREATE','UPDATE','ARCHIVE','CREATE_CATEGORY','UPDATE_CATEGORY','DELETE_CATEGORY','UPDATE_SETTINGS'
];
for(const action of auditActions) {
  // Order audit action is intentionally selected dynamically: status changes vs. provider-backed refunds.
  const found = action === 'UPDATE_STATUS' ? /"UPDATE_STATUS"/.test(backend) : backend.includes(`action:"${action}"`) || (action === 'REFUND_ORDER' && /action:\s*needsProviderRefund\s*\?\s*"REFUND_ORDER"/.test(backend));
  check(`Audit action ${action}`,found,found?'logged':'missing');
}

const failed=results.filter(r=>!r.ok);
for(const r of results) console.log(`${r.ok?'PASS':'FAIL'}\t${r.name}\t${r.detail}`);
console.log(`ADMIN_FUNCTION_AUDIT ${results.length-failed.length}/${results.length} PASS`);
if(failed.length) process.exit(1);
