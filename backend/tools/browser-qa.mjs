import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const base=(process.env.ATELIER_WEB_BASE||'http://localhost:3000').replace(/\/$/,'');
const apiBase=(process.env.ATELIER_API_BASE||'http://localhost:4000/api').replace(/\/$/,'');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(root,'browser-qa-results');
fs.mkdirSync(out,{recursive:true});

const candidates=process.platform==='win32' ? [
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'],'Google/Chrome/Application/chrome.exe'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,'Microsoft/Edge/Application/msedge.exe'),
] : ['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/chromium-browser'];
const browser=candidates.find(p=>p&&fs.existsSync(p));
if(!browser){console.error('BROWSER_NOT_FOUND');process.exit(2)}

const publicRoutes=process.env.ATELIER_QA_ROUTES
  ? process.env.ATELIER_QA_ROUTES.split(',').map(route=>route.trim()).filter(Boolean)
  : ['/','/shop','/new','/men','/women','/collections','/indo-western','/western','/about','/login','/register','/cart','/checkout','/wishlist','/account','/search','/custom','/builder','/stylist'];
const customerRoutes=['/account','/account/orders','/account/addresses','/account/wishlist','/checkout'];
const adminPath=(process.env.NEXT_PUBLIC_ADMIN_PATH||'/_atelier-console-8f2d6c').replace(/\/$/,'');
const adminRoutes=process.env.ATELIER_QA_ADMIN_ROUTES?process.env.ATELIER_QA_ADMIN_ROUTES.split(',').map(route=>route.trim()).filter(Boolean):[`${adminPath}?section=dashboard`,`${adminPath}?section=products`,`${adminPath}?section=orders`,`${adminPath}?section=payments`,`${adminPath}?section=users`,`${adminPath}?section=categories`,`${adminPath}?section=settings`,`${adminPath}?section=audit`,`${adminPath}/access`];
let productRoute='';
try{const r=await fetch(`${apiBase}/products`);const j=await r.json();if(Array.isArray(j)&&j[0]?.id)productRoute=`/product/${encodeURIComponent(String(j[0].id))}`}catch{}
if(productRoute&&!process.env.ATELIER_QA_ROUTES) publicRoutes.push(productRoute);
const errorMarkers=['Application error','Runtime TypeError','Unhandled Runtime Error','Cannot read properties of undefined','TypeError:','ReferenceError:','ChunkLoadError'];

class Cdp {
  constructor(wsUrl){this.ws=new WebSocket(wsUrl);this.next=1;this.pending=new Map();this.listeners=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.addEventListener('open',()=>resolve());this.ws.addEventListener('error',e=>reject(e))});this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);if(m.error)p.reject(new Error(JSON.stringify(m.error)));else p.resolve(m.result)}const ls=this.listeners.get(m.method)||[];for(const fn of ls)fn(m.params)});}
  async cmd(method,params={}){await this.ready;const id=this.next++;this.ws.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}))}
  on(method,fn){const ls=this.listeners.get(method)||[];ls.push(fn);this.listeners.set(method,ls)}
  async close(){try{this.ws.close()}catch{}}
}

async function waitFor(condition,timeoutMs=12000,intervalMs=150){const start=Date.now();while(Date.now()-start<timeoutMs){try{if(await condition())return true}catch{}await new Promise(r=>setTimeout(r,intervalMs))}return false}
async function waitForValue(readValue,timeoutMs=12000,intervalMs=150){const start=Date.now();while(Date.now()-start<timeoutMs){try{const value=await readValue();if(value)return value}catch{}await new Promise(r=>setTimeout(r,intervalMs))}return null}
async function pickTarget(port){const r=await fetch(`http://127.0.0.1:${port}/json/list`);if(!r.ok)throw new Error(`CHROMIUM_TARGET_LIST_HTTP_${r.status}`);const list=await r.json();return list.find(x=>x.type==='page'&&typeof x.webSocketDebuggerUrl==='string'&&x.webSocketDebuggerUrl.startsWith('ws://'))}
async function launchBrowser(profile,port){
  const args=['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-extensions',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--window-size=1440,1000','about:blank'];
  const child=spawn(browser,args,{stdio:['ignore','ignore','pipe']});
  const ready=await waitFor(async()=>{try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);return r.ok}catch{return false}},10000,100);
  if(!ready){child.kill('SIGKILL');throw new Error('BROWSER_REMOTE_DEBUGGING_NOT_READY')}
  const target=await waitForValue(async()=>pickTarget(port),5000,100);
  if(!target){child.kill('SIGKILL');throw new Error('BROWSER_PAGE_TARGET_NOT_FOUND')}
  const cdp=new Cdp(target.webSocketDebuggerUrl);
  await cdp.cmd('Page.enable'); await cdp.cmd('Runtime.enable'); await cdp.cmd('Network.enable');
  return {child,cdp};
}

async function evalJs(cdp,expression,returnByValue=true){
  const r=await cdp.cmd('Runtime.evaluate',{expression,returnByValue,awaitPromise:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.text||'Runtime evaluation failed');
  return r.result?.value;
}
async function navigate(cdp,url){
  await cdp.cmd('Page.navigate',{url});
  await waitFor(async()=>{const v=await evalJs(cdp,'document.readyState');return v==='complete'||v==='interactive'},15000,150);
  await new Promise(r=>setTimeout(r,900));
}
async function viewport(cdp,width,height){
  await cdp.cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
}
async function hoverAtSelector(cdp,selector){
  const point=await evalJs(cdp,`(()=>{const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
  if(point) await cdp.cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
  await new Promise(r=>setTimeout(r,350));
  return evalJs(cdp,`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return null;const s=getComputedStyle(b);return {text:b.innerText,color:s.color,background:s.backgroundColor,rect:{width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height},hover:b.matches(':hover')}})()`);
}
async function clickHotspot(cdp){
  await waitFor(async()=>Boolean(await evalJs(cdp,"document.querySelector('.cin-character-stage .cin-hotspot-beacon')")),10000,150);
  return evalJs(cdp,`(async()=>{document.documentElement.style.scrollBehavior='auto';const stage=document.querySelector('.cin-character-stage');stage?.scrollIntoView({block:'center',behavior:'instant'});const stageRect=stage?.getBoundingClientRect();const buttons=[...(stage?.querySelectorAll('.cin-hotspot-beacon')||[])];if(!buttons.length)return null;const pins=[];for(const button of buttons){button.click();await new Promise(r=>setTimeout(r,600));const pin=button.closest('.cin-hotspot');const pop=pin?.querySelector('.cin-hotspot-popover');const r=pop?.getBoundingClientRect();pins.push({label:button.getAttribute('aria-label'),active:pin?.classList.contains('active'),detail:pop?.innerText,opacity:pop?getComputedStyle(pop).opacity:null,buttonVisible:!!button.getClientRects().length,insideStage:!!r&&r.left>=stageRect.left-1&&r.right<=stageRect.right+1&&r.top>=stageRect.top-1&&r.bottom<=stageRect.bottom+1,popover:{x:r?.x,y:r?.y,width:r?.width,height:r?.height},stage:{x:stageRect?.x,y:stageRect?.y,width:stageRect?.width,height:stageRect?.height}})}return {pins}})()`);
}
async function dragPet(cdp){
  await waitFor(async()=>Boolean(await evalJs(cdp,"document.querySelector('.atelier-pet .atelier-pet-open')")),8000,100);
  const before=await evalJs(cdp,`(()=>{const pet=document.querySelector('.atelier-pet');if(!pet)return null;const r=pet.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight}})()`);
  if(!before)return {found:false};
  const x=before.x+before.width/2,y=before.y+before.height/2;
  const dx=x>before.viewportWidth/2?-48:48,dy=y>before.viewportHeight/2?-36:36;
  await evalJs(cdp,"window.__atelierPetPointerEvents={down:0,move:0,up:0,details:[]};for(const [name,type] of [['down','pointerdown'],['move','pointermove'],['up','pointerup']])window.addEventListener(type,e=>{window.__atelierPetPointerEvents[name]++;window.__atelierPetPointerEvents.details.push({type:e.type,id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,buttons:e.buttons,target:e.target?.className})},true)");
  await cdp.cmd('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
  await new Promise(resolve=>setTimeout(resolve,80));
  await cdp.cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx,y:y+dy,button:'left',buttons:1});
  await new Promise(resolve=>setTimeout(resolve,80));
  const draggingClass=await evalJs(cdp,"Boolean(document.querySelector('.atelier-pet')?.classList.contains('is-dragging'))");
  const during=await evalJs(cdp,"(()=>{const r=document.querySelector('.atelier-pet')?.getBoundingClientRect();return r?{x:r.x,y:r.y}:null})()");
  await cdp.cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',clickCount:1});
  await new Promise(resolve=>setTimeout(resolve,150));
  const details=await evalJs(cdp,`(()=>{const pet=document.querySelector('.atelier-pet');if(!pet)return {found:false};const r=pet.getBoundingClientRect();let saved=null;try{saved=JSON.parse(localStorage.getItem('atelier-ai-pet:position:v4')||'null')}catch{}return {found:true,before:${JSON.stringify(before)},during:${JSON.stringify(during)},after:{x:r.x,y:r.y,width:r.width,height:r.height},inline:pet.getAttribute('style'),moved:Math.abs(r.x-${before.x})>10||Math.abs(r.y-${before.y})>10,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,saved,events:window.__atelierPetPointerEvents,draggingClass:${JSON.stringify(draggingClass)},draggingAfterRelease:pet.classList.contains('is-dragging')}})()`);
  await cdp.cmd('Page.reload');
  await waitFor(async()=>{const state=await evalJs(cdp,'document.readyState');return state==='complete'||state==='interactive'},15000,100);
  await waitFor(async()=>Boolean(await evalJs(cdp,"document.querySelector('.atelier-pet .atelier-pet-open')")),8000,100);
  await new Promise(resolve=>setTimeout(resolve,350));
  details.restored=await evalJs(cdp,"(()=>{const r=document.querySelector('.atelier-pet')?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null})()");
  details.restoredMatches=Boolean(details.restored&&details.after&&Math.abs(details.restored.x-details.after.x)<2&&Math.abs(details.restored.y-details.after.y)<2);
  return details;
}
async function screenshot(cdp,file){
  const metrics=await cdp.cmd('Page.getLayoutMetrics');
  const cs=metrics?.contentSize||{width:1440,height:1000};
  const viewportOnly=process.env.ATELIER_QA_VIEWPORT_SHOTS==='1';
  const vp=metrics?.cssVisualViewport||metrics?.cssLayoutViewport||{};
  const width=Math.min(Math.max(1,viewportOnly?(vp.clientWidth||1440):cs.width),1600);
  const height=Math.min(Math.max(1,viewportOnly?(vp.clientHeight||1000):cs.height),12000);
  const targetY=Number(await evalJs(cdp,'window.scrollY'))||0;
  const r=await cdp.cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:!viewportOnly,fromSurface:true,clip:{x:0,y:viewportOnly?0:targetY,width,height,scale:1}});
  fs.writeFileSync(file,Buffer.from(r.data,'base64'));
}
async function inspect(cdp){
  return await evalJs(cdp,`(async()=>{const body=document.body;const text=body?.innerText||'';const imgs=[...document.images];imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(resolve=>{const done=()=>resolve();i.addEventListener('load',done,{once:true});i.addEventListener('error',done,{once:true});setTimeout(done,5000)})));/* Allow React image-fallback onError updates to replace failed URLs before auditing. */await new Promise(resolve=>setTimeout(resolve,400));const settledImgs=[...document.images];const broken=settledImgs.filter(i=>!i.complete||i.naturalWidth===0);const links=[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(Boolean);const buttons=[...document.querySelectorAll('button')].length;const pet=document.querySelector('.atelier-pet');const pr=pet?.getBoundingClientRect();return {title:document.title,url:location.href,text:text.slice(0,20000),htmlBytes:document.documentElement?.outerHTML?.length||0,brokenImages:broken.length,brokenImageSources:broken.map(i=>i.currentSrc||i.src),imageCount:settledImgs.length,buttonCount:buttons,linkCount:links.length,innerWidth:innerWidth,scrollWidth:document.documentElement?.scrollWidth||0,scrollHeight:document.documentElement?.scrollHeight||0,bodyHeight:body?.scrollHeight||0,companion:pr?{x:pr.x,y:pr.y,right:innerWidth-pr.right,bottom:innerHeight-pr.bottom}:null,hasRoot:!!document.querySelector('#__next,[data-nextjs-scroll-focus-boundary]')};})()`);
}
async function login(cdp,email,password){
  await navigate(cdp,`${base}/login`);
  const ok=await evalJs(cdp,`(()=>{const inputs=[...document.querySelectorAll('input')];return inputs.map(x=>({type:x.type,name:x.name,placeholder:x.placeholder,autoComplete:x.autocomplete}));})()`);
  if(!Array.isArray(ok)||ok.length===0) throw new Error('LOGIN_FORM_NOT_FOUND');
  await evalJs(cdp,`(()=>{const set=(el,v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(setter)setter.call(el,v);else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};const inputs=[...document.querySelectorAll('input')];const emailEl=inputs.find(x=>x.type==='email')||inputs[0];const passEl=inputs.find(x=>x.type==='password');if(!emailEl||!passEl)throw new Error('LOGIN_FIELDS_NOT_FOUND');set(emailEl,${JSON.stringify(email)});set(passEl,${JSON.stringify(password)});return true;})()`);
  await evalJs(cdp,`(()=>{const b=document.querySelector('form button[type="submit"]');if(!b)throw new Error('LOGIN_SUBMIT_NOT_FOUND');b.click();return true;})()`);
  return await waitFor(async()=>{const p=await evalJs(cdp,'location.pathname');return p!=='/login'},15000,200);
}

async function runSuite(label,routes,credentials){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),`atelier-browser-${label}-`));
  const port=Number(process.env.ATELIER_CDP_PORT||9222)+(label==='public'?0:label==='customer'?1:2);
  let launched;
  try{launched=await launchBrowser(profile,port);const {child,cdp}=launched;
    const results=[];
    const paymentConfigResponses=[];
    cdp.on('Network.responseReceived',e=>{if(e.response?.url?.includes('/api/admin/payment-config'))paymentConfigResponses.push({status:e.response.status,url:e.response.url});});
    if(credentials){const logged=await login(cdp,credentials.email,credentials.password);if(!logged){results.push({route:'/login',pass:false,error:'LOGIN_DID_NOT_COMPLETE'});await cdp.close();child.kill('SIGTERM');return results;}results.push({route:'/login',pass:true,auth:label});}
    for(const route of routes){
      for(const mode of [{name:'desktop',w:1440,h:1000},{name:'mobile',w:390,h:844}]){
        await viewport(cdp,mode.w,mode.h);await navigate(cdp,`${base}${route}`);
        if(process.env.ATELIER_QA_SCROLL_SELECTOR){await evalJs(cdp,`(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector(${JSON.stringify(process.env.ATELIER_QA_SCROLL_SELECTOR)})?.scrollIntoView({block:'center',behavior:'instant'});return true})()`);await new Promise(r=>setTimeout(r,1200));}
        if(process.env.ATELIER_QA_CLICK_TEXT){await evalJs(cdp,`(()=>{const wanted=${JSON.stringify(process.env.ATELIER_QA_CLICK_TEXT)}.trim().toLowerCase();const els=[...document.querySelectorAll('button,[role="button"],a')];const el=els.find(x=>x.innerText?.trim().toLowerCase()===wanted)||els.find(x=>x.innerText?.trim().toLowerCase().startsWith(wanted));if(!el)return false;el.click();return true})()`);await new Promise(r=>setTimeout(r,2500));}
        let petDrag=null;
        if(process.env.ATELIER_QA_DRAG_PET==='1')petDrag=await dragPet(cdp);
        if(route==='/'&&mode.name==='mobile'&&process.env.ATELIER_QA_AI_PANEL==='1'){
          await evalJs(cdp,'([...document.querySelectorAll("button")].find(x=>x.getAttribute("aria-label")==="Open ATELIER AI")||document.querySelector(".atelier-pet-open"))?.click(); true');
          await waitFor(async()=>Boolean(await evalJs(cdp,'document.querySelector(".ai-panel")')),8000,100);
          await new Promise(r=>setTimeout(r,350));
        }
        const info=await inspect(cdp);
        if(process.env.ATELIER_QA_CLICK_TEXT)info.clickedText=process.env.ATELIER_QA_CLICK_TEXT;
        if(process.env.ATELIER_QA_STYLE_SELECTOR){
          info.styles=await evalJs(cdp,`(()=>{const root=document.querySelector(${JSON.stringify(process.env.ATELIER_QA_STYLE_SELECTOR)});if(!root)return null;const nodes=[root,...root.querySelectorAll('.wrap.empty,.page-hero,.checkout-layout,.checkout-card,.summary,h1,h2,h3,p,button')];return nodes.map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {tag:el.tagName,className:el.className,text:el.innerText?.trim().slice(0,90),color:s.color,background:s.backgroundColor,fontSize:s.fontSize,opacity:s.opacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}})})()`);
        }
        if(label==='admin'&&process.env.ATELIER_QA_PAYMENT_CONFIG==='1')info.paymentConfigResponses=paymentConfigResponses.slice();
        if(process.env.ATELIER_QA_HOTSPOT==='1')info.hotspot=await clickHotspot(cdp);
        if(process.env.ATELIER_QA_SCROLL_SELECTOR){
          info.target=await evalJs(cdp,`(()=>{const root=document.querySelector(${JSON.stringify(process.env.ATELIER_QA_SCROLL_SELECTOR)});if(!root)return null;const selector=${JSON.stringify(process.env.ATELIER_QA_SCROLL_SELECTOR)}==='.cin-character-footer'?'.cin-character-cta':${JSON.stringify(process.env.ATELIER_QA_SCROLL_SELECTOR)}==='.cin-manifesto-actions'? 'button':'button';const buttons=[...(root.matches('button')?[root]:root.querySelectorAll(selector))];return {text:root.innerText,scrollY:scrollY,buttons:buttons.map(b=>({text:b.innerText,rect:(()=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})(),color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor,padding:getComputedStyle(b).padding,fontSize:getComputedStyle(b).fontSize,display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility}))}})()`);
        }
        if(process.env.ATELIER_QA_HOVER_SELECTOR)info.hover=await hoverAtSelector(cdp,process.env.ATELIER_QA_HOVER_SELECTOR);
        const err=errorMarkers.find(x=>info.text.includes(x));
        const connection=/API is not reachable|API UNAVAILABLE/.test(info.text);
        const overflow=info.scrollWidth>mode.w+3;
        const broken=info.brokenImages>0;
        const noContent=info.htmlBytes<800||info.text.trim().length<20;
        const expectedTargetButtons=process.env.ATELIER_QA_SCROLL_SELECTOR==='.cin-character-footer'?1:process.env.ATELIER_QA_SCROLL_SELECTOR==='.cin-manifesto-actions'?2:1;
        const targetFailed=Boolean(process.env.ATELIER_QA_SCROLL_SELECTOR)&&info.target!==null&&(!info.target||info.target.buttons.length!==expectedTargetButtons||info.target.buttons.some(b=>!b.text.trim()||b.rect.width<100||b.rect.height<40||b.visibility!=='visible'));
        const hoverFailed=Boolean(process.env.ATELIER_QA_HOVER_SELECTOR)&&(!info.hover||info.hover.color===info.hover.background||!info.hover.text.trim());
        const hotspotFailed=process.env.ATELIER_QA_HOTSPOT==='1'&&(!info.hotspot||info.hotspot.pins.length!==3||info.hotspot.pins.some(p=>!p.active||Number(p.opacity)<0.9||!p.detail||!p.buttonVisible||!p.insideStage));
        const panelMissing=route==='/'&&mode.name==='mobile'&&process.env.ATELIER_QA_AI_PANEL==='1'&&!await evalJs(cdp,'Boolean(document.querySelector(".ai-panel"))');
        const petDragFailed=process.env.ATELIER_QA_DRAG_PET==='1'&&(!petDrag||!petDrag.found||!petDrag.moved||!petDrag.inside||!petDrag.saved||!petDrag.restoredMatches||petDrag.draggingAfterRelease);
        if(petDrag)info.petDrag=petDrag;
        const pass=!err&&!connection&&!overflow&&!broken&&!noContent&&!targetFailed&&!hoverFailed&&!hotspotFailed&&!panelMissing&&!petDragFailed;
        const safe=route.replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'')||'home';const prefix=label==='public'?'':`${label}_`;const shot=path.join(out,`${prefix}${safe}_${mode.name}.png`);await screenshot(cdp,shot);fs.writeFileSync(path.join(out,`${prefix}${safe}_${mode.name}.json`),JSON.stringify(info,null,2));
        results.push({route,mode:mode.name,pass,error:err||null,connection,overflow,brokenImages:info.brokenImages,htmlBytes:info.htmlBytes,scrollWidth:info.scrollWidth,viewport:mode.w,panelMissing,targetFailed:targetFailed||false});
        console.log(`${pass?'PASS':'FAIL'} ${label} ${mode.name} ${route}${err?` :: ${err}`:''}${connection?' :: api': ''}${overflow?' :: overflow':''}${broken?' :: broken-image':''}${panelMissing?' :: ai-panel-missing':''}${petDragFailed?' :: pet-drag':''}`);
      }
    }
    await cdp.close();child.kill('SIGTERM');return results;
  }catch(e){console.error(`FAIL ${label} :: ${e.message}`);try{launched?.cdp?.close()}catch{}try{launched?.child?.kill('SIGKILL')}catch{};return [{route:'__suite__',mode:'n/a',pass:false,error:e.message}]}
}

// Fail clearly when the app is not running instead of testing Chromium's network-error page as if it were the storefront.
try {
  await fetch(base, { signal: AbortSignal.timeout(5000) });
} catch (error) {
  console.error(`BROWSER_QA_BLOCKED: storefront not reachable at ${base} (${error?.cause?.code || error?.message || 'connection failed'})`);
  process.exit(2);
}

const results=[];
const publicResults=await runSuite('public',publicRoutes,null);results.push(...publicResults);
if(process.env.ATELIER_QA_EMAIL&&process.env.ATELIER_QA_PASSWORD){results.push(...await runSuite('customer',customerRoutes,{email:process.env.ATELIER_QA_EMAIL,password:process.env.ATELIER_QA_PASSWORD}))}
if(process.env.ATELIER_QA_ADMIN_EMAIL&&process.env.ATELIER_QA_ADMIN_PASSWORD){results.push(...await runSuite('admin',adminRoutes,{email:process.env.ATELIER_QA_ADMIN_EMAIL,password:process.env.ATELIER_QA_ADMIN_PASSWORD}))}

fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({base,results},null,2));
const failures=results.filter(x=>!x.pass);
console.log(`BROWSER_BASE=${base}`);
console.log(`BROWSER_CASES=${results.length}`);
console.log(`BROWSER_FAILURES=${failures.length}`);
console.log(`BROWSER_RESULTS=${out}`);
process.exit(failures.length?1:0);
