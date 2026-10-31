import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const updates = [
  { sku: "AT-M01", name: "relaxed-oxford-shirt", images: ["/images/products/new-catalogue/men/relaxed-oxford-shirt-01.avif","/images/products/new-catalogue/men/relaxed-oxford-shirt-02.avif"] },
  { sku: "AT-M02", name: "classic-linen-shirt", images: ["/images/products/new-catalogue/men/classic-linen-shirt-01.avif","/images/products/new-catalogue/men/classic-linen-shirt-02.avif"] },
  { sku: "AT-M03", name: "textured-overshirt", images: ["/images/products/new-catalogue/men/textured-overshirt-01.avif","/images/products/new-catalogue/men/textured-overshirt-02.avif"] },
  { sku: "AT-M04", name: "dark-denim-jacket", images: ["/images/products/new-catalogue/men/dark-denim-jacket-01.avif","/images/products/new-catalogue/men/dark-denim-jacket-02.avif"] },
  { sku: "AT-M05", name: "essential-knit-polo", images: ["/images/products/new-catalogue/men/essential-knit-polo-01.avif","/images/products/new-catalogue/men/essential-knit-polo-02.avif"] },
  { sku: "AT-M06", name: "relaxed-heavyweight-tee", images: ["/images/products/new-catalogue/men/relaxed-heavyweight-tee-01.avif","/images/products/new-catalogue/men/relaxed-heavyweight-tee-02.avif"] },
  { sku: "AT-M07", name: "mens-tailored-blazer", images: ["/images/products/new-catalogue/men/tailored-blazer-01.avif","/images/products/new-catalogue/men/tailored-blazer-02.avif"] },
  { sku: "AT-M08", name: "cotton-trousers", images: ["/images/products/new-catalogue/men/cotton-trousers-01.avif","/images/products/new-catalogue/men/cotton-trousers-02.avif"] },
  { sku: "AT-M09", name: "mens-pleated-wide-trousers", images: ["/images/products/new-catalogue/men/pleated-wide-trousers-01.avif","/images/products/new-catalogue/men/pleated-wide-trousers-02.avif"] },
  { sku: "AT-M10", name: "minimal-utility-overshirt", images: ["/images/products/new-catalogue/men/minimal-utility-overshirt-01.avif","/images/products/new-catalogue/men/minimal-utility-overshirt-02.avif"] },
  { sku: "AT-M11", name: "mens-wool-blend-overcoat", images: ["/images/products/new-catalogue/men/wool-blend-overcoat-01.avif","/images/products/new-catalogue/men/wool-blend-overcoat-02.avif"] },
  { sku: "AT-M12", name: "monochrome-knit-crew", images: ["/images/products/new-catalogue/men/monochrome-knit-crew-01.avif","/images/products/new-catalogue/men/monochrome-knit-crew-02.avif"] },
  { sku: "AT-W01", name: "draped-satin-co-ord-set", images: ["/images/products/new-catalogue/women/draped-satin-co-ord-set-01.avif","/images/products/new-catalogue/women/draped-satin-co-ord-set-02.avif"] },
  { sku: "AT-W02", name: "asymmetric-dhoti-trousers", images: ["/images/products/new-catalogue/women/asymmetric-dhoti-trousers-01.avif","/images/products/new-catalogue/women/asymmetric-dhoti-trousers-03.avif"] },
  { sku: "AT-W03", name: "structured-bandhani-shirt", images: ["/images/products/new-catalogue/women/structured-bandhani-shirt-01.avif","/images/products/new-catalogue/women/structured-bandhani-shirt-04.avif"] },
  { sku: "AT-W04", name: "corset-kurta-top", images: ["/images/products/new-catalogue/women/corset-kurta-top-01.avif","/images/products/new-catalogue/women/corset-kurta-top-05.avif"] },
  { sku: "AT-W05", name: "draped-blazer-dress", images: ["/images/products/new-catalogue/women/draped-blazer-dress-01.avif","/images/products/new-catalogue/women/draped-blazer-dress-06.avif"] },
  { sku: "AT-W08", name: "pleated-palazzo-co-ord", images: ["/images/products/new-catalogue/women/pleated-palazzo-co-ord-01.avif","/images/products/new-catalogue/women/pleated-palazzo-co-ord-07.avif"] },
  { sku: "AT-W10", name: "cropped-waistcoat-trouser-set", images: ["/images/products/new-catalogue/women/cropped-waistcoat-trouser-set-01.avif","/images/products/new-catalogue/women/cropped-waistcoat-trouser-set-08.avif"] },
  { sku: "AT-W13", name: "one-shoulder-draped-dress", images: ["/images/products/new-catalogue/women/one-shoulder-draped-dress-01.avif","/images/products/new-catalogue/women/one-shoulder-draped-dress-09.avif"] },
  { sku: "AT-W14", name: "tailored-saree-style-skirt", images: ["/images/products/new-catalogue/women/tailored-saree-style-skirt-01.avif","/images/products/new-catalogue/women/tailored-saree-style-skirt-10.avif"] },
  { sku: "AT-W15", name: "contemporary-kurta-shirt", images: ["/images/products/new-catalogue/women/contemporary-kurta-shirt-01.avif","/images/products/new-catalogue/women/contemporary-kurta-shirt-02.avif"] },
  { sku: "AT-W16", name: "draped-denim-jacket", images: ["/images/products/new-catalogue/women/draped-denim-jacket-01.avif","/images/products/new-catalogue/women/draped-denim-jacket-02.avif"] },
  { sku: "AT-W17", name: "satin-cowl-top-wide-trousers", images: ["/images/products/new-catalogue/women/satin-cowl-top-wide-trousers-01.avif","/images/products/new-catalogue/women/satin-cowl-top-wide-trousers-02.avif"] },
  { sku: "AT-W18", name: "asymmetric-co-ord-blazer-set", images: ["/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-01.avif","/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-02.avif"] },
  { sku: "AT-W20", name: "sculpted-column-maxi-dress", images: ["/images/products/new-catalogue/women/sculpted-column-maxi-dress-01.avif","/images/products/new-catalogue/women/sculpted-column-maxi-dress-02.avif"] },
  { sku: "AT-W21", name: "relaxed-fit-t-shirt", images: ["/images/products/new-catalogue/women/relaxed-fit-t-shirt-01.avif","/images/products/new-catalogue/women/relaxed-fit-t-shirt-02.avif"] },
  { sku: "AT-W22", name: "womens-tailored-blazer", images: ["/images/products/new-catalogue/women/tailored-blazer-01.avif","/images/products/new-catalogue/women/tailored-blazer-02.avif","/images/products/new-catalogue/women/tailored-blazer-03.avif"] },
  { sku: "AT-W23", name: "womens-structured-wool-coat", images: ["/images/products/new-catalogue/women/structured-wool-coat-01.avif","/images/products/new-catalogue/women/structured-wool-coat-02.avif","/images/products/new-catalogue/women/structured-wool-coat-03.avif"] },
  { sku: "AT-W24", name: "womens-wide-leg-trousers", images: ["/images/products/new-catalogue/women/wide-leg-trousers-01.avif","/images/products/new-catalogue/women/wide-leg-trousers-02.avif"] },
  { sku: "AT-W25", name: "minimal-ribbed-dress", images: ["/images/products/new-catalogue/women/minimal-ribbed-dress-01.avif","/images/products/new-catalogue/women/minimal-ribbed-dress-02.avif"] },
  { sku: "AT-W26", name: "womens-tailored-wool-trousers", images: ["/images/products/new-catalogue/women/tailored-wool-trousers-01.avif","/images/products/new-catalogue/women/tailored-wool-trousers-02.avif"] },
] as const;

async function main(){
  let updated=0;
  for(const item of updates){
    const result = await prisma.product.updateMany({ where:{ sku:item.sku }, data:{ images:[...item.images] } });
    if(result.count !== 1) throw new Error(`Expected exactly one product for ${item.sku} (${item.name}), found ${result.count}`);
    updated += result.count;
  }
  console.log(`Updated ${updated}/${updates.length} existing products. No database/schema creation or reset was performed.`);
}

main().catch(err=>{ console.error(err); process.exitCode=1; }).finally(()=>prisma.$disconnect());
