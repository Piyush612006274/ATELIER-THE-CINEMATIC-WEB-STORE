import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const publicDir=path.join(root,"frontend","public");
const storefrontPath = fs.existsSync(path.join(root,"frontend","components","storefront","storefront.tsx"))
  ? path.join(root,"frontend","components","storefront","storefront.tsx")
  : path.join(root,"frontend","components","storefront.tsx");
const code=fs.readFileSync(storefrontPath,"utf8");
const match=code.match(/const REFERENCE_WEB_IMAGES:Record<string,string>\=\{(.*?)\n\};\nconst REFERENCE_BY_SLUG/s);
const refs=match ? [...match[1].matchAll(/:\"([^\"]+)\"/g)].map(m=>m[1]) : [];
const unique=[...new Set(refs)];
const missing=unique.filter(r=>!fs.existsSync(path.join(publicDir,r.replace(/^\//,""))));
const nonRaster=unique.filter(r=>!['jpg','jpeg','png','webp','avif'].includes(r.split('.').pop().toLowerCase()));
const duplicates=refs.filter((x,i,a)=>a.indexOf(x)!==i);
console.log(`REFERENCE_LOCAL_ASSETS=${refs.length}`);
console.log(`REFERENCE_LOCAL_UNIQUE=${unique.length}`);
console.log(`REFERENCE_LOCAL_DUPLICATES=${duplicates.length}`);
console.log(`REFERENCE_LOCAL_MISSING=${missing.length}`);
console.log(`REFERENCE_LOCAL_NONRASTER=${nonRaster.length}`);
process.exit(missing.length||nonRaster.length||duplicates.length?1:0);
