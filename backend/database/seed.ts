import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { collectionTypeFor } from "../src/database/catalog.js";
import { ensureCmsDefaults } from "../src/database/cmsDefaults.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for seed");
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) throw new Error("ADMIN_PASSWORD is required for seed");
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const img=(name:string)=>`/images/products/new-catalogue/men/${name}.avif`;
const png=(name:string)=>`/images/products/new-catalogue/men/${name}.avif`;
const photos={
 linen:img("classic-linen-shirt-01"), tshirt:img("relaxed-fit-t-shirt-01"), blazer:img("tailored-blazer-01"), coat:img("structured-wool-coat-01"), denim:img("denim-jacket-01"), cotton:img("cotton-trousers-01"), knit:img("essential-knit-polo-01"), oxford:img("relaxed-oxford-shirt-01"), wide:img("wide-leg-trousers-01"), dress:img("minimal-ribbed-dress-01"), wool:img("tailored-wool-trousers-01"), overshirt:img("textured-overshirt-01"), wide2:img("wide-leg-trousers-02"), wool2:img("tailored-wool-trousers-02")
};
const categories=[
 ["Shirts","shirts"],["T-Shirts","t-shirts"],["Jackets","jackets"],["Jeans","jeans"],["Trousers","trousers"],["Dresses","dresses"],["Coats","coats"],["Knitwear","knitwear"],["Indo-Western","indo-western"],["Co-Ord Sets","co-ord-sets"],["Kurtas","kurtas"],["Tops","tops"]
] as const;

type P={sku:string;name:string;slug:string;price:number;cat:string;gender:"Men"|"Women";type:string;colors:string[];stock:number;images:string[];description:string;featured?:boolean;newArrival?:boolean;bestSeller?:boolean};
const sizes=["XS","S","M","L","XL","XXL"];

// One catalogue product can have multiple views. The first two are used by the
// storefront card as front/back; any additional views remain available on PDP.
const catalogueImages=(gender:"men"|"women",slug:string)=>{
  const base=`/images/products/new-catalogue/${gender}/`;
  const known:Record<string,string[]>= {
    "men:classic-linen-shirt":["classic-linen-shirt-01.avif","classic-linen-shirt-02.avif"],
    "men:cotton-trousers":["cotton-trousers-01.avif","cotton-trousers-02.avif"],
    "men:dark-denim-jacket":["dark-denim-jacket-01.avif","dark-denim-jacket-02.avif"],
    "men:essential-knit-polo":["essential-knit-polo-01.avif","essential-knit-polo-02.avif"],
    "men:minimal-utility-overshirt":["minimal-utility-overshirt-01.avif","minimal-utility-overshirt-02.avif"],
    "men:monochrome-knit-crew":["monochrome-knit-crew-01.avif","monochrome-knit-crew-02.avif"],
    "men:pleated-wide-trousers":["pleated-wide-trousers-01.avif","pleated-wide-trousers-02.avif"],
    "men:mens-pleated-wide-trousers":["pleated-wide-trousers-01.avif","pleated-wide-trousers-02.avif"],
    "men:relaxed-heavyweight-tee":["relaxed-heavyweight-tee-01.avif","relaxed-heavyweight-tee-02.avif"],
    "men:relaxed-oxford-shirt":["relaxed-oxford-shirt-01.avif","relaxed-oxford-shirt-02.avif"],
    "men:tailored-blazer":["tailored-blazer-01.avif","tailored-blazer-02.avif"],
    "men:mens-tailored-blazer":["tailored-blazer-01.avif","tailored-blazer-02.avif"],
    "men:textured-overshirt":["textured-overshirt-01.avif","textured-overshirt-02.avif"],
    "men:wool-blend-overcoat":["wool-blend-overcoat-01.avif","wool-blend-overcoat-02.avif"],
    "men:mens-wool-blend-overcoat":["wool-blend-overcoat-01.avif","wool-blend-overcoat-02.avif"],
    "women:asymmetric-co-ord-blazer-set":["asymmetric-co-ord-blazer-set-01.avif","asymmetric-co-ord-blazer-set-02.avif"],
    "women:asymmetric-dhoti-trousers":["asymmetric-dhoti-trousers-01.avif","asymmetric-dhoti-trousers-03.avif"],
    "women:contemporary-kurta-shirt":["contemporary-kurta-shirt-01.avif","contemporary-kurta-shirt-02.avif"],
    "women:corset-kurta-top":["corset-kurta-top-01.avif","corset-kurta-top-05.avif"],
    "women:cropped-waistcoat-trouser-set":["cropped-waistcoat-trouser-set-01.avif","cropped-waistcoat-trouser-set-08.avif"],
    "women:draped-blazer-dress":["draped-blazer-dress-01.avif","draped-blazer-dress-06.avif"],
    "women:draped-denim-jacket":["draped-denim-jacket-01.avif","draped-denim-jacket-02.avif"],
    "women:draped-satin-co-ord-set":["draped-satin-co-ord-set-01.avif","draped-satin-co-ord-set-02.avif"],
    "women:minimal-ribbed-dress":["minimal-ribbed-dress-01.avif","minimal-ribbed-dress-02.avif"],
    "women:one-shoulder-draped-dress":["one-shoulder-draped-dress-01.avif","one-shoulder-draped-dress-09.avif"],
    "women:pleated-palazzo-co-ord":["pleated-palazzo-co-ord-01.avif","pleated-palazzo-co-ord-07.avif"],
    "women:relaxed-fit-t-shirt":["relaxed-fit-t-shirt-01.avif","relaxed-fit-t-shirt-02.avif"],
    "women:satin-cowl-top-wide-trousers":["satin-cowl-top-wide-trousers-01.avif","satin-cowl-top-wide-trousers-02.avif"],
    "women:sculpted-column-maxi-dress":["sculpted-column-maxi-dress-01.avif","sculpted-column-maxi-dress-02.avif"],
    "women:structured-bandhani-shirt":["structured-bandhani-shirt-01.avif","structured-bandhani-shirt-04.avif"],
    "women:structured-wool-coat":["structured-wool-coat-01.avif","structured-wool-coat-02.avif","structured-wool-coat-03.avif"],
    "women:womens-structured-wool-coat":["structured-wool-coat-01.avif","structured-wool-coat-02.avif","structured-wool-coat-03.avif"],
    "women:tailored-blazer":["tailored-blazer-01.avif","tailored-blazer-02.avif","tailored-blazer-03.avif"],
    "women:womens-tailored-blazer":["tailored-blazer-01.avif","tailored-blazer-02.avif","tailored-blazer-03.avif"],
    "women:tailored-saree-style-skirt":["tailored-saree-style-skirt-01.avif","tailored-saree-style-skirt-10.avif"],
    "women:tailored-wool-trousers":["tailored-wool-trousers-01.avif","tailored-wool-trousers-02.avif"],
    "women:womens-tailored-wool-trousers":["tailored-wool-trousers-01.avif","tailored-wool-trousers-02.avif"],
    "women:wide-leg-trousers":["wide-leg-trousers-01.avif","wide-leg-trousers-02.avif"],
    "women:womens-wide-leg-trousers":["wide-leg-trousers-01.avif","wide-leg-trousers-02.avif"],
  };
  return (known[`${gender}:${slug}`]||[]).map(file=>base+file);
};

const p=(x:Omit<P,"images"> & {images?:string[]})=>({...x,images:x.images??catalogueImages(x.gender==="Men"?"men":"women",x.slug)});

const products:P[]=[
// MEN — 12
p({sku:"AT-M01",name:"Relaxed Oxford Shirt",slug:"relaxed-oxford-shirt",price:2799,cat:"Shirts",gender:"Men",type:"shirt",colors:["White","Grey","Navy"],stock:28,images:catalogueImages("men","relaxed-oxford-shirt"),description:"Relaxed Oxford cotton with a clean collar and an easy modern fit.",featured:true,bestSeller:true}),
p({sku:"AT-M02",name:"Classic Linen Shirt",slug:"classic-linen-shirt",price:2499,cat:"Shirts",gender:"Men",type:"shirt",colors:["White","Beige","Black"],stock:24,images:catalogueImages("men","classic-linen-shirt"),description:"Breathable premium linen shaped for warm-weather tailoring.",featured:true,newArrival:true}),
p({sku:"AT-M03",name:"Textured Overshirt",slug:"textured-overshirt",price:3499,cat:"Jackets",gender:"Men",type:"overshirt",colors:["Olive","Black","Brown"],stock:18,images:catalogueImages("men","textured-overshirt"),description:"A textured overshirt that works as a polished light layer.",newArrival:true}),
p({sku:"AT-M04",name:"Dark Denim Jacket",slug:"dark-denim-jacket",price:3999,cat:"Jeans",gender:"Men",type:"jacket",colors:["Indigo","Black"],stock:20,images:catalogueImages("men","dark-denim-jacket"),description:"Dark-wash denim with a structured but relaxed profile.",bestSeller:true}),
p({sku:"AT-M05",name:"Essential Knit Polo",slug:"essential-knit-polo",price:2999,cat:"Knitwear",gender:"Men",type:"polo",colors:["Beige","Olive","Black"],stock:22,images:catalogueImages("men","essential-knit-polo"),description:"Soft-touch knit polo with a refined collar and clean finish.",featured:true}),
p({sku:"AT-M06",name:"Relaxed Heavyweight Tee",slug:"relaxed-heavyweight-tee",price:1999,cat:"T-Shirts",gender:"Men",type:"t-shirt",colors:["Black","White","Grey"],stock:35,images:catalogueImages("men","relaxed-heavyweight-tee"),description:"Dense cotton jersey with a relaxed premium silhouette.",bestSeller:true}),
p({sku:"AT-M07",name:"Tailored Blazer",slug:"mens-tailored-blazer",price:6999,cat:"Jackets",gender:"Men",type:"blazer",colors:["Black","Charcoal","Brown"],stock:11,images:catalogueImages("men","mens-tailored-blazer"),description:"Soft-shouldered tailoring designed for modern day-to-night dressing.",featured:true,newArrival:true}),
p({sku:"AT-M08",name:"Cotton Trousers",slug:"cotton-trousers",price:2499,cat:"Trousers",gender:"Men",type:"trousers",colors:["Beige","Black","Grey"],stock:29,images:catalogueImages("men","cotton-trousers"),description:"Clean cotton trousers with a comfortable high-rise profile."}),
p({sku:"AT-M09",name:"Pleated Wide Trousers",slug:"mens-pleated-wide-trousers",price:3299,cat:"Trousers",gender:"Men",type:"trousers",colors:["Taupe","Black","Stone"],stock:19,images:catalogueImages("men","mens-pleated-wide-trousers"),description:"Contemporary wide-leg trousers with a pressed front pleat.",newArrival:true}),
p({sku:"AT-M10",name:"Minimal Utility Overshirt",slug:"minimal-utility-overshirt",price:3799,cat:"Jackets",gender:"Men",type:"overshirt",colors:["Olive","Stone","Black"],stock:16,images:catalogueImages("men","minimal-utility-overshirt"),description:"Minimal utility styling translated into a clean city layer."}),
p({sku:"AT-M11",name:"Wool Blend Overcoat",slug:"mens-wool-blend-overcoat",price:7499,cat:"Coats",gender:"Men",type:"coat",colors:["Charcoal","Brown","Black"],stock:9,images:catalogueImages("men","mens-wool-blend-overcoat"),description:"A long wool-blend overcoat with an architectural line.",newArrival:true}),
p({sku:"AT-M12",name:"Monochrome Knit Crew",slug:"monochrome-knit-crew",price:3199,cat:"Knitwear",gender:"Men",type:"sweater",colors:["Black","Cream","Grey"],stock:17,images:catalogueImages("men","monochrome-knit-crew"),description:"A clean crew-neck knit for understated layered dressing.",bestSeller:true}),
// WOMEN — 20 products from ATELIER-Womens-20-Products-FINAL
p({sku:"AT-W01",name:"Draped Satin Co-Ord Set",slug:"draped-satin-co-ord-set",price:4499,cat:"Co-Ord Sets",gender:"Women",type:"co-ord",colors:["Black", "Ivory", "Taupe"],stock:18,images:catalogueImages("women","draped-satin-co-ord-set"),description:"A fluid satin co-ord blending contemporary tailoring with Indo-Western drape.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W02",name:"Asymmetric Dhoti Trousers",slug:"asymmetric-dhoti-trousers",price:3199,cat:"Trousers",gender:"Women",type:"dhoti-trousers",colors:["Black", "Ivory", "Brown"],stock:22,images:catalogueImages("women","asymmetric-dhoti-trousers"),description:"An asymmetric dhoti-inspired trouser with a relaxed modern fall.",featured:false,newArrival:true,bestSeller:true}),
p({sku:"AT-W03",name:"Structured Bandhani Shirt",slug:"structured-bandhani-shirt",price:2799,cat:"Indo-Western",gender:"Women",type:"shirt",colors:["Black", "Burgundy", "Ivory"],stock:19,images:catalogueImages("women","structured-bandhani-shirt"),description:"A structured western shirt with a refined Bandhani-inspired surface.",featured:true,newArrival:true,bestSeller:false}),
p({sku:"AT-W04",name:"Corset Kurta Top",slug:"corset-kurta-top",price:2699,cat:"Indo-Western",gender:"Women",type:"kurta-top",colors:["Black", "Ivory", "Burgundy"],stock:22,images:catalogueImages("women","corset-kurta-top"),description:"A sculpted corset interpretation of the modern kurta silhouette.",featured:false,newArrival:true,bestSeller:false}),
p({sku:"AT-W05",name:"Draped Blazer Dress",slug:"draped-blazer-dress",price:5999,cat:"Dresses",gender:"Women",type:"blazer-dress",colors:["Black", "Charcoal", "Brown"],stock:10,images:catalogueImages("women","draped-blazer-dress"),description:"Tailoring meets drape in a sharp, evening-ready blazer dress.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W08",name:"Pleated Palazzo Co-Ord",slug:"pleated-palazzo-co-ord",price:4299,cat:"Co-Ord Sets",gender:"Women",type:"palazzo-co-ord",colors:["Black", "Cream", "Beige"],stock:15,images:catalogueImages("women","pleated-palazzo-co-ord"),description:"A pleated palazzo co-ord designed for fluid, elevated movement.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W10",name:"Cropped Waistcoat & Trouser Set",slug:"cropped-waistcoat-trouser-set",price:4299,cat:"Co-Ord Sets",gender:"Women",type:"waistcoat-set",colors:["Charcoal", "Ivory", "Taupe"],stock:14,images:catalogueImages("women","cropped-waistcoat-trouser-set"),description:"A cropped waistcoat paired with relaxed trousers for modern tailoring.",featured:true,newArrival:true,bestSeller:false}),
p({sku:"AT-W13",name:"One-Shoulder Draped Dress",slug:"one-shoulder-draped-dress",price:4499,cat:"Dresses",gender:"Women",type:"one-shoulder-dress",colors:["Black", "Burgundy", "Champagne"],stock:11,images:catalogueImages("women","one-shoulder-draped-dress"),description:"A one-shoulder draped dress balancing sculptural shape and movement.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W14",name:"Tailored Saree-Style Skirt",slug:"tailored-saree-style-skirt",price:3499,cat:"Indo-Western",gender:"Women",type:"saree-skirt",colors:["Black", "Ivory", "Taupe"],stock:20,images:catalogueImages("women","tailored-saree-style-skirt"),description:"A tailored skirt with a saree-inspired drape for modern styling.",featured:false,newArrival:true,bestSeller:false}),
p({sku:"AT-W15",name:"Contemporary Kurta Shirt",slug:"contemporary-kurta-shirt",price:2999,cat:"Kurtas",gender:"Women",type:"kurta-shirt",colors:["Ivory", "Black", "Olive"],stock:21,images:catalogueImages("women","contemporary-kurta-shirt"),description:"A contemporary kurta-shirt with a clean western collar and easy fit.",featured:true,newArrival:true,bestSeller:false}),
p({sku:"AT-W16",name:"Draped Denim Jacket",slug:"draped-denim-jacket",price:4299,cat:"Jackets",gender:"Women",type:"denim-jacket",colors:["Indigo", "Washed Black", "Ice Blue"],stock:14,images:catalogueImages("women","draped-denim-jacket"),description:"A fashion-forward denim jacket with an expressive draped construction.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W17",name:"Satin Cowl Top & Wide Trousers",slug:"satin-cowl-top-wide-trousers",price:3899,cat:"Co-Ord Sets",gender:"Women",type:"satin-co-ord",colors:["Black", "Champagne", "Burgundy"],stock:15,images:catalogueImages("women","satin-cowl-top-wide-trousers"),description:"A satin cowl top and wide trouser pairing built for modern evenings.",featured:false,newArrival:true,bestSeller:true}),
p({sku:"AT-W18",name:"Asymmetric Co-Ord Blazer Set",slug:"asymmetric-co-ord-blazer-set",price:5499,cat:"Co-Ord Sets",gender:"Women",type:"blazer-co-ord",colors:["Black", "Ivory", "Cobalt"],stock:12,images:catalogueImages("women","asymmetric-co-ord-blazer-set"),description:"An asymmetric blazer co-ord bringing editorial tailoring to occasion dressing.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W20",name:"Sculpted Column Maxi Dress",slug:"sculpted-column-maxi-dress",price:6999,cat:"Dresses",gender:"Women",type:"maxi-dress",colors:["Black", "Ivory", "Burgundy"],stock:9,images:catalogueImages("women","sculpted-column-maxi-dress"),description:"A sculpted column maxi dress with an elongated editorial silhouette.",featured:true,newArrival:true,bestSeller:true}),
// PRESERVED ORIGINAL WOMEN — 6 products from the original ATELIER catalogue
p({sku:"AT-W21",name:"Relaxed Fit T-Shirt",slug:"relaxed-fit-t-shirt",price:1999,cat:"T-Shirts",gender:"Women",type:"top",colors:["Black","White","Grey"],stock:31,images:catalogueImages("women","relaxed-fit-t-shirt"),description:"A dense cotton jersey tee with a relaxed silhouette and an understated finish.",featured:true,bestSeller:true}),
p({sku:"AT-W22",name:"Tailored Blazer",slug:"womens-tailored-blazer",price:6999,cat:"Jackets",gender:"Women",type:"jacket",colors:["Black","Navy","Brown"],stock:12,images:catalogueImages("women","womens-tailored-blazer"),description:"Sharp but unforced. A clean tailored blazer balanced with a softly structured shoulder and fluid drape.",featured:true,newArrival:true,bestSeller:true}),
p({sku:"AT-W23",name:"Structured Wool Coat",slug:"womens-structured-wool-coat",price:7999,cat:"Coats",gender:"Women",type:"coat",colors:["Brown","Black","Beige"],stock:8,images:catalogueImages("women","womens-structured-wool-coat"),description:"An enduring winter coat with a generous collar and a precise, architectural line.",featured:true,newArrival:true}),
p({sku:"AT-W24",name:"Wide Leg Trousers",slug:"womens-wide-leg-trousers",price:3199,cat:"Trousers",gender:"Women",type:"pants",colors:["Black","Beige","Brown"],stock:25,images:catalogueImages("women","womens-wide-leg-trousers"),description:"A wide-leg silhouette with an elegant drape and a pressed crease made for long days.",newArrival:true,bestSeller:true}),
p({sku:"AT-W25",name:"Minimal Ribbed Dress",slug:"minimal-ribbed-dress",price:3499,cat:"Dresses",gender:"Women",type:"dress",colors:["Black","Beige","Burgundy"],stock:13,images:catalogueImages("women","minimal-ribbed-dress"),description:"A long, ribbed dress with a restrained silhouette and effortless movement.",featured:true,bestSeller:true}),
p({sku:"AT-W26",name:"Tailored Wool Trousers",slug:"womens-tailored-wool-trousers",price:3999,cat:"Trousers",gender:"Women",type:"pants",colors:["Black","Grey","Navy"],stock:15,images:catalogueImages("women","womens-tailored-wool-trousers"),description:"Refined wool trousers with a clean waist and an elongated leg line.",featured:false,bestSeller:false}),

];

async function main(){
  for(let i=0;i<categories.length;i++){const [name,slug]=categories[i];await prisma.category.upsert({where:{slug},update:{name,sortOrder:i,active:true},create:{name,slug,sortOrder:i,active:true}})}
  const rows=await prisma.category.findMany(); const by=new Map(rows.map(c=>[c.name,c.id]));
  await prisma.product.updateMany({where:{status:{in:["ACTIVE","DRAFT"]}},data:{status:"ARCHIVED"}});
  for(const x of products){
    const categoryId=by.get(x.cat)!;
    const data={name:x.name,sku:x.sku,slug:x.slug,price:x.price,categoryId,gender:x.gender,collectionType:collectionTypeFor(x),type:x.type,colors:x.colors,sizes,images:x.images,stock:x.stock,featured:x.featured??false,newArrival:x.newArrival??false,bestSeller:x.bestSeller??false,status:"ACTIVE" as const,description:x.description,rating:4.8,reviewCount:48};
    const existingBySku=await prisma.product.findUnique({where:{sku:x.sku},select:{id:true}});
    if(existingBySku){
      await prisma.product.update({where:{id:existingBySku.id},data});
      continue;
    }
    const existingBySlug=await prisma.product.findUnique({where:{slug:x.slug},select:{id:true}});
    if(existingBySlug){
      await prisma.product.update({where:{id:existingBySlug.id},data});
      continue;
    }
    await prisma.product.create({data});
  }
  const email=(process.env.ADMIN_EMAIL??"").trim().toLowerCase();
  if(!email) throw new Error("ADMIN_EMAIL is required for seed; refusing to use a hard-coded admin email."); const hash=await bcrypt.hash(adminPassword,12);
  await prisma.user.upsert({where:{email},update:{name:"ATELIER Admin",phone:process.env.WHATSAPP_ADMIN_TO??"",passwordHash:hash,role:"ADMIN",emailVerifiedAt:new Date(),phoneVerifiedAt:null},create:{email,name:"ATELIER Admin",phone:process.env.WHATSAPP_ADMIN_TO??"",passwordHash:hash,role:"ADMIN",emailVerifiedAt:new Date(),phoneVerifiedAt:null}});
  const settings={siteName:"ATELIER",tagline:"Exceptional fashion for every moment.",headerHomeLabel:"Home",headerShopLabel:"Shop",headerCollectionsLabel:"Collections",headerAboutLabel:"About",footerTagline:"Quiet luxury, considered for modern life.",contactEmail:process.env.CONTACT_EMAIL??"hello@atelier.example",whatsappAdminNumber:process.env.WHATSAPP_ADMIN_TO??"9773912429",paymentQrUrl:process.env.PAYMENT_QR_URL??"",paymentRazorpayQrId:process.env.PAYMENT_RAZORPAY_QR_ID??"",paymentUpiId:process.env.PAYMENT_UPI_ID??"",currency:"INR",newsletterText:"Stay in the know.",announcement:"",footerShopLabel:"Shop",footerAboutLabel:"About",footerHelpLabel:"Help",socialInstagram:"Instagram",socialPinterest:"Pinterest",socialFacebook:"Facebook",copyrightText:"© 2026 ATELIER. All rights reserved.",hero1Eyebrow:"TIMELESS STYLE. MODERN YOU.",hero1Line1:"TIMELESS STYLE.",hero1Line2:"MODERN YOU.",hero1Line3:"",hero1Text:"Exceptional Fashion for Every Moment",hero1Image:"/images/hero/hero-04-wide.jpg",hero2Eyebrow:"THE QUIET ART OF DRESS.",hero2Line1:"A Softer",hero2Line2:"Kind of",hero2Line3:"Confidence",hero2Text:"Clean lines, considered materials, and silhouettes that move with you.",hero2Image:"/images/hero/hero-01.jpg",hero3Eyebrow:"MADE FOR MODERN LIVES.",hero3Line1:"Layered",hero3Line2:"With",hero3Line3:"Intention",hero3Text:"Wardrobe essentials with an editorial point of view.",hero3Image:"/images/hero/hero-03.jpg",hero4Eyebrow:"MILAN / MODERN HERITAGE.",hero4Line1:"Culture",hero4Line2:"Meets",hero4Line3:"Modernity",hero4Text:"A cinematic city edit shaped by heritage, movement and contemporary ease.",hero4Image:"/images/hero/hero-02.jpg"};
  for(const [key,value] of Object.entries(settings))await prisma.siteSetting.upsert({where:{key},update:{},create:{key,value}});
  await ensureCmsDefaults(prisma); // fills missing pages only; never overwrites admin edits
  console.log(`Seeded ATELIER: ${products.filter(x=>x.gender==='Men').length} men + ${products.filter(x=>x.gender==='Women').length} women = ${products.length} products`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
