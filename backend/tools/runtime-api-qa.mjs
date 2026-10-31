import fs from 'node:fs';

const base=(process.env.ATELIER_API_BASE||'http://localhost:4000/api').replace(/\/$/,'');
const checks=[];
const pass=(name,ok,detail='')=>{checks.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} :: ${name}${detail?` :: ${detail}`:''}`)};

async function request(path, options={}){
  try{
    const r=await fetch(`${base}${path}`, {redirect:'manual', ...options});
    let body='';
    const type=r.headers.get('content-type')||'';
    if(type.includes('application/json')) body=await r.json(); else body=await r.text();
    return {ok:true,status:r.status,body,headers:r.headers};
  }catch(e){return {ok:false,status:0,body:null,error:String(e?.message||e)}}
}

const health=await request('/health');
pass('GET /health responds',health.ok && health.status===200, health.ok?`HTTP ${health.status}`:health.error);
if(health.ok && typeof health.body==='object') pass('health reports database connected',health.body.database==='connected' || health.body.database==='ok',JSON.stringify(health.body));

const products=await request('/products');
pass('GET /products responds',products.ok && products.status===200,products.ok?`HTTP ${products.status}`:products.error);
pass('products payload is array',products.ok && Array.isArray(products.body),products.ok?`count=${Array.isArray(products.body)?products.body.length:0}`:health.error);
if(products.ok && Array.isArray(products.body)) {
  pass('catalogue has 12 men',products.body.filter(p=>p?.gender==='Men').length===12,`men=${products.body.filter(p=>p?.gender==='Men').length}`);
  pass('catalogue has 20 women',products.body.filter(p=>p?.gender==='Women').length===20,`women=${products.body.filter(p=>p?.gender==='Women').length}`);
  pass('catalogue has 32 active products',products.body.filter(p=>p?.status==='ACTIVE').length===32,`active=${products.body.filter(p=>p?.status==='ACTIVE').length}`);
  pass('product image arrays are valid',products.body.every(p=>Array.isArray(p?.images)&&p.images.length>0), 'every product has at least one image');
  pass('collection taxonomy valid',products.body.every(p=>['MEN','WOMEN_INDO_WESTERN','WOMEN_WESTERN'].includes(p?.collectionType)), 'all collectionType values are explicit');
}

for (const [name,path] of [['/categories','/categories'],['/settings','/settings']]) {
  const r=await request(path);
  pass(`GET ${name} responds`,r.ok&&r.status===200,r.ok?`HTTP ${r.status}`:r.error);
}

const unauthOrders=await request('/orders');
pass('GET /orders rejects unauthenticated access',unauthOrders.ok && [401,403].includes(unauthOrders.status),unauthOrders.ok?`HTTP ${unauthOrders.status}`:unauthOrders.error);
const unauthAdminOrders=await request('/admin/orders');
pass('GET /admin/orders rejects unauthenticated access',unauthAdminOrders.ok && [401,403].includes(unauthAdminOrders.status),unauthAdminOrders.ok?`HTTP ${unauthAdminOrders.status}`:unauthAdminOrders.error);
const unauthAdminProducts=await request('/admin/products');
pass('GET /admin/products rejects unauthenticated access',unauthAdminProducts.ok && [401,403].includes(unauthAdminProducts.status),unauthAdminProducts.ok?`HTTP ${unauthAdminProducts.status}`:unauthAdminProducts.error);

const me=await request('/auth/me');
pass('GET /auth/me rejects unauthenticated access',me.ok && [401,403].includes(me.status),me.ok?`HTTP ${me.status}`:me.error);

const failures=checks.filter(x=>!x.ok);
console.log(`API_BASE=${base}`);
console.log(`RUNTIME_API_CHECKS=${checks.length}`);
console.log(`RUNTIME_API_FAILURES=${failures.length}`);
process.exit(failures.length?1:0);
