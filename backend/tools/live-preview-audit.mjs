import fs from "node:fs";
import path from "node:path";
import { loadGlobalCssParts } from "./css-source.mjs";
const root=process.cwd();
const front=fs.readFileSync(path.join(root,"frontend/components/storefront/storefront.tsx"),"utf8");
const cms=fs.readFileSync(path.join(root,"frontend/components/admin/cms-kit.tsx"),"utf8");
const builder=fs.readFileSync(path.join(root,"frontend/components/admin/visual-site-builder.tsx"),"utf8");
const cssParts=loadGlobalCssParts(root);
const css=cssParts.join('\n');
const frontCode=front.replace(/\s+/g,'');
const builderCode=builder.replace(/\s+/g,'');
const cmsCode=cms.replace(/\s+/g,'');
const cssCode=css.replace(/\s+/g,'');
const checks=[
 ["LIVE_PREVIEW_COMPONENT",front.includes("function AdminLivePreview")],
 ["LIVE_PREVIEW_TOGGLE",front.includes("admin-live-preview-toggle")&&front.includes("Live Preview")],
 ["LIVE_PREVIEW_IFRAME",front.includes("ATELIER storefront live preview")&&front.includes("<iframe")],
 ["LIVE_PREVIEW_AUTO_REFRESH",frontCode.includes('atelier:data-changed')&&frontCode.includes("setReload((v)=>v+1)")],
 ["PRODUCT_EDITOR_DOES_NOT_AUTO_OPEN_PREVIEW",!frontCode.includes('onPreview?.(`/product/${p.id}`)')&&frontCode.includes('setEditing({...p,colorsCsv:p.colors?.join(",")')],
 ["CATEGORY_EDITOR_DOES_NOT_AUTO_OPEN_PREVIEW",!frontCode.includes('onPreview?.("/collections")')&&frontCode.includes('setEditing({...c})')],
 ["CMS_SECTION_SELECTION_DOES_NOT_AUTO_OPEN_PREVIEW",!cmsCode.includes('if(page?.slug)onPreview?.(`/${page.slug}`)')],
 ["BUILDER_HAS_EXPLICIT_PREVIEW_ACTION",builderCode.includes('onPreview?.(page.slug===')&&builderCode.includes('Livepreview')],
 ["BUILDER_PAGE_CHANGE_DOES_NOT_AUTO_OPEN_PREVIEW",!builderCode.includes('if(page)onPreview?.(`/${page.slug}`)')],
 ["SETTINGS_PREVIEW_ACTION",frontCode.includes('onPreview?.("/")')&&frontCode.includes('>LivePreview</button>')],
 ["RESPONSIVE_SPLIT_GRID",cssCode.includes('.admin.with-preview{grid-template-columns:215pxminmax(0,1fr)minmax(420px,46vw)')],
 ["MOBILE_STACK",cssCode.includes('.admin.with-preview{grid-template-columns:1fr}')],
 ["DEVICE_TOGGLE",frontCode.includes('viewport==="desktop"')&&frontCode.includes('viewport==="mobile"')],
 ["OPEN_NEW_TAB_IS_EXPLICIT",frontCode.includes('target="_blank"rel="noreferrer"')]
];
let fail=0;
for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} :: ${name}`);if(!ok)fail++;}
console.log(`LIVE_PREVIEW_CHECKS=${checks.length}`);
console.log(`LIVE_PREVIEW_FAILURES=${fail}`);
process.exitCode=fail?1:0;
