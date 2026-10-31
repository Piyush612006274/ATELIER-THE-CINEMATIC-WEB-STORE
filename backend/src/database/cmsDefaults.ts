import { cinematicHomeSections } from "./cinematicDefaults.js";
// Default CMS pages. Created automatically on API start when missing (never overwrites admin edits).
const NC = "/images/products/new-catalogue";
const slide = (eyebrow:string,l1:string,l2:string,l3:string,text:string,image:string,position:string)=>({eyebrow,line1:l1,line2:l2,line3:l3,text,image,position,fit:"cover",buttonText:"Shop Men",buttonLink:"/shop?gender=Men",button2Text:"Shop Women",button2Link:"/shop?gender=Women"});
const card = (title:string,image:string,link:string,desc="",height=0)=>({title,body:desc,image,link,fit:"cover",ratio:"4:5",height,position:"center 18%",buttonText:"Shop Now →"});

export const CORE_SLUGS = ["home","login","register","shop","men","women","new","product","cart","checkout","account"];
export const NATIVE_SLUGS = ["shop","men","women","new","collections-native","product","account","builder","stylist","indo-western","western","cart","checkout","wishlist","search","custom"].filter(x=>x!=="collections-native");

export const cmsDefaultPages: {slug:string;title:string;isSystem:boolean;sections:{type:string;content:Record<string,any>}[]}[] = [
  { slug:"home", title:"Home", isSystem:true, sections:cinematicHomeSections },
  { slug:"about", title:"About", isSystem:true, sections:[
    { type:"HERO", content:{ eyebrow:"THE HOUSE OF ATELIER", line1:"Designed for", line2:"the Modern Life.", line3:"", text:"Contemporary clothing built on considered design, modern Indian proportions and quiet restraint.", image:"/images/hero/hero-04-wide.jpg", fit:"cover", position:"70% center", height:560, buttonText:"Discover our collections", buttonLink:"/collections" }},
    { type:"IMAGE_TEXT", content:{ eyebrow:"OUR STORY", title:"Made to be worn, and worn again.", body:"ATELIER began with a simple idea: a wardrobe should earn its place. We create versatile pieces that feel considered, comfortable and quietly distinct.\n\nEvery silhouette is drawn around proportion, movement and repeat wear, so each piece works as easily on its own as it does layered.", image:`${NC}/women/tailored-blazer-01.avif`, fit:"cover", ratio:"4:5", height:0, position:"center top", reverse:false, buttonText:"Shop new arrivals", buttonLink:"/shop?filter=new" }},
    { type:"BENEFITS", content:{ items:[{icon:"box",title:"Considered design",text:"Clean lines and honest proportions."},{icon:"truck",title:"Modern Indian roots",text:"Indian references, tailored for today."},{icon:"return",title:"Built to be repeated",text:"Pieces designed for everyday wear."}] }},
    { type:"IMAGE_TEXT", content:{ eyebrow:"OUR PHILOSOPHY", title:"Quietly confident.", body:"We believe the most lasting wardrobe is not the loudest one. Our design language moves between Indian references and modern restraint, keeping proportion, movement and repeat wear at the centre.", image:`${NC}/women/structured-wool-coat-01.avif`, fit:"cover", ratio:"4:5", height:0, position:"center top", reverse:true, buttonText:"Explore the edit", buttonLink:"/shop" }},
    { type:"IMAGE_GRID", content:{ eyebrow:"THE LOOKBOOK", title:"Wear the edit.", body:"A few of the collections that define the house.", columns:4, items:[
      card("Women","/images/collections/womens-collection.jpg","/shop?gender=Women","Considered everyday dressing.",420),
      card("Men","/images/collections/mens-collection.jpg","/shop?gender=Men","Sharp, relaxed tailoring.",420),
      card("Summer","/images/collections/summer-collection.jpg","/collections","Light layers for warm days.",420),
      card("Winter","/images/collections/winter-edit.jpg","/collections","Structure and warmth.",420) ]}},
    { type:"COLLECTION_GRID", content:{ eyebrow:"CRAFTSMANSHIP", title:"Details that reward a closer look.", body:"Clean construction, considered finishes and versatile silhouettes built for modern layering.", columns:3, items:[
      card("Tailoring",`${NC}/women/tailored-blazer-02.avif`,"/shop?gender=Women","Structured, never stiff.",420),
      card("Drape",`${NC}/women/draped-blazer-dress-01.avif`,"/western","Movement built into every cut.",420),
      card("Indo-Western",`${NC}/women/contemporary-kurta-shirt-01.avif`,"/indo-western","Tradition, re-cut for now.",420) ]}},
    { type:"BANNER", content:{ eyebrow:"The ATELIER edit", title:"Find your next favourite.", body:"New arrivals, considered for every moment.", image:"/images/collections/couple-collection.jpg", fit:"cover", ratio:"original", height:600, position:"center 25%", buttonText:"Shop new arrivals →", buttonLink:"/shop?filter=new" }},
    { type:"NEWSLETTER", content:{ eyebrow:"Join our community", title:"Stay close to the next edit.", body:"New drops, editorial stories and considered wardrobe notes." }}
  ]},
  { slug:"collections", title:"Collections", isSystem:true, sections:[
    { type:"RICH_TEXT", content:{ eyebrow:"The ATELIER edit", title:"Our Collections", body:"Curated styles for every mood and moment." }},
    { type:"COLLECTION_GRID", content:{ eyebrow:"", title:"", body:"", columns:2, items:[
      card("Men’s Collection",`${NC}/men/tailored-blazer-01.avif`,"/shop?gender=Men","A disciplined edit of tailoring and easy layers.",640),
      card("Women’s Collection",`${NC}/women/pleated-palazzo-co-ord-01.avif`,"/shop?gender=Women","Fluid tailoring, neutral tones, considered silhouettes.",640),
      card("Indo-Western Edit",`${NC}/women/contemporary-kurta-shirt-01.avif`,"/indo-western","Modern Indian proportions, drape and tailoring.",640),
      card("Western Edit",`${NC}/women/sculpted-column-maxi-dress-01.avif`,"/western","Contemporary dresses and clean silhouettes.",640) ]}}
  ]},
  { slug:"login", title:"Login", isSystem:true, sections:[{ type:"HERO", content:{ eyebrow:"ATELIER / PRIVATE ACCESS", captionTitle:"A wardrobe with a quieter point of view.", captionText:"Verified customer access.", panelTitle:"Welcome Back", panelText:"Sign in securely to your ATELIER account.", rotationImages:[`${NC}/women/pleated-palazzo-co-ord-01.avif`,`${NC}/women/asymmetric-co-ord-blazer-set-01.avif`,`${NC}/women/draped-blazer-dress-01.avif`], autoRotate:true, intervalMs:2000, fit:"cover", position:"center top", imageHeight:0 }}]},
  { slug:"register", title:"Register", isSystem:true, sections:[{ type:"HERO", content:{ eyebrow:"ATELIER / 2026", captionTitle:"Build a wardrobe with intention.", captionText:"Create your verified ATELIER account.", panelTitle:"Join ATELIER", panelText:"Create a verified account with secure email and delivery details.", rotationImages:[`${NC}/men/relaxed-heavyweight-tee-01.avif`,`${NC}/men/tailored-blazer-01.avif`,`${NC}/women/draped-blazer-dress-01.avif`], autoRotate:true, intervalMs:2000, fit:"cover", position:"center top", imageHeight:0 }}]},
  ...NATIVE_SLUGS.map(slug=>({ slug, title:slug.split("-").map(x=>x[0].toUpperCase()+x.slice(1)).join(" "), isSystem:true, sections:[{ type:"NATIVE", content:{ route:slug } }] }))
];

export async function ensureCmsDefaults(prisma:any){
  for(const d of cmsDefaultPages){
    let page = await prisma.sitePage.findUnique({ where:{ slug:d.slug }, include:{ _count:{ select:{ sections:true } } } });
    if(!page){ page = await prisma.sitePage.create({ data:{ slug:d.slug, title:d.title, isSystem:d.isSystem, status:"PUBLISHED" }, include:{ _count:{ select:{ sections:true } } } }); }
    if(page._count.sections===0){ for(const [i,s] of d.sections.entries()) await prisma.siteSection.create({ data:{ pageId:page.id, type:s.type, sortOrder:i, visible:true, content:s.content } }); }
  }
}
export async function resetPageToDefaults(prisma:any, pageId:string){
  const page = await prisma.sitePage.findUnique({ where:{ id:pageId } }); if(!page) return null;
  const d = cmsDefaultPages.find(x=>x.slug===page.slug); if(!d) return null;
  await prisma.siteSection.deleteMany({ where:{ pageId } });
  for(const [i,s] of d.sections.entries()) await prisma.siteSection.create({ data:{ pageId, type:s.type, sortOrder:i, visible:true, content:s.content } });
  return prisma.sitePage.findUnique({ where:{ id:pageId }, include:{ sections:{ orderBy:{ sortOrder:"asc" } } } });
}
