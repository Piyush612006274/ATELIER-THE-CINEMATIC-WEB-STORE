import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGlobalCssParts } from "./css-source.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const storefront = fs.readFileSync(path.join(root, "frontend/components/storefront/storefront.tsx"), "utf8");
const builder = fs.readFileSync(path.join(root, "frontend/components/admin/visual-site-builder.tsx"), "utf8");
const cms = fs.readFileSync(path.join(root, "frontend/components/admin/cms-kit.tsx"), "utf8");
const cssParts = loadGlobalCssParts(root);
const css = cssParts.join("\n");
const frontCode = storefront.replace(/\s+/g, "");
const builderCode = builder.replace(/\s+/g, "");
const cmsCode = cms.replace(/\s+/g, "");
const cssCode = css.replace(/\s+/g, "");
const checks = [
  ["Preview callback is stable across admin renders", frontCode.includes("constopenPreview=useCallback(") && frontCode.includes("constpreviewPathRef=useRef(previewPath)")],
  ["Admin data requests cancel stale state updates", frontCode.includes("letcancelled=false") && frontCode.includes("if(!cancelled)setDataLoading(false)")],
  ["Customer search is debounced", frontCode.includes("setTimeout(()=>setSearchQuery(q.trim()),250)")],
  ["Admin loading state is announced and visually visible", frontCode.includes("aria-busy={dataLoading}") && frontCode.includes('role="status"aria-live="polite"') && cssCode.includes("admin-loading-overlay")],
  ["Media upload has independent busy state and file-read error path", frontCode.includes("const[uploading,setUploading]=useState(false)") && frontCode.includes('reader.onerror=()=>reject(newError("IMAGE_READ_FAILED"))')],
  ["Media search label describes media, not customers", /aria-label="Search media files by name"/.test(storefront)],
  ["Image upload is disabled while media is busy", frontCode.includes("disabled={busy||uploading}") && cssCode.includes('label[aria-disabled="true"]')],
  ["Product list has an explicit empty state", /No products found\./.test(storefront)],
  ["Product modal supports dialog semantics and Escape close", frontCode.includes('role="dialog"aria-modal="true"aria-label={editing.id') && frontCode.includes('e.key==="Escape"&&!saving&&!uploading')],
  ["Category modal supports dialog semantics and Escape close", frontCode.includes('aria-label="Editcategory"') && frontCode.includes('e.key==="Escape"&&!busy')],
  ["Broken dashboard image previews can recover after URL correction", cmsCode.includes('style.opacity="1"') && frontCode.includes('el.style.display="block"') && frontCode.includes('el.style.display="none"')],
  ["Visual builder canvas is the real storefront; original ratio is treated as intrinsic image sizing by the shared renderer", builderCode.includes('className="visual-canvas-frame"') && builderCode.includes("?canvas=1") && frontCode.includes('ratio!=="original"?"auto"') && frontCode.includes('fit==="full"?"auto"')],
  ["Real renderer used by the builder canvas falls back when images are missing or broken", frontCode.includes("functionSmartImage") && frontCode.includes("onError={()=>setAttempt") && frontCode.includes("fallbackSrc={FALLBACK}")],
  ["Dashboard table wrappers allow horizontal scrolling", cssCode.includes("overscroll-behavior-x:contain") && cssCode.includes(".admin-table{min-width:720px}")],
  ["Dashboard has mobile toolbar/layout safeguards", cssCode.includes("@media(max-width:700px)") && cssCode.includes(".admin-category-add-controls{display:grid")],
  ["Image controls reset file input after selection", cmsCode.includes('e.target.value="";') && frontCode.includes('e.currentTarget.value=""')],
  ["Settings QR accepts only backend-supported image formats", /Choose a JPG, PNG or WEBP image/.test(storefront)],
  ["Product image upload merges into latest draft state", frontCode.includes("setEditing((current:any)=>{constcurrentImagesList=Array.isArray(current?.imagesList)") && frontCode.includes("currentImagesList,out.url")],
  ["Product editor cannot close while save/upload is active", frontCode.includes("e.target===e.currentTarget&&!saving&&!uploading") && frontCode.includes('disabled={saving||uploading}aria-label="Closeproducteditor"')],
  ["Category editor cannot close during save and row actions are serialized", frontCode.includes("e.target===e.currentTarget&&!busy&&setEditing(null)") && frontCode.includes("disabled={busy}>Edit</button>")],
  ["Settings fields are disabled while saving or uploading", frontCode.includes('<fieldsetclassName="settings-controls"disabled={saving||uploading}>') && frontCode.includes("</fieldset>") && cssCode.includes(".settings-controls:disabled")],
  ["Product category selector tracks current loaded categories", frontCode.includes("useEffect(()=>setCatList(Array.isArray(categories)?categories:[]),[categories],)")],
  ["Reduced-motion preference is respected in dashboard", cssCode.includes("@media(prefers-reduced-motion:reduce)") && cssCode.includes(".admin-loading-spinner{animation:none}")]
];
let failures = 0;
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} :: ${name}`); if (!ok) failures++; }
console.log(`DASHBOARD_UI_REGRESSION=${checks.length - failures}/${checks.length} ${failures ? "FAIL" : "PASS"}`);
process.exitCode = failures ? 1 : 0;
