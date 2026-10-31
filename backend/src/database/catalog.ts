export type CollectionType = "MEN" | "WOMEN_INDO_WESTERN" | "WOMEN_WESTERN";

const CANONICAL_IMAGES: Record<string, string[]> = {
  "Men:relaxed-oxford-shirt": ["relaxed-oxford-shirt-01.avif", "relaxed-oxford-shirt-02.avif"],
  "Men:classic-linen-shirt": ["classic-linen-shirt-01.avif", "classic-linen-shirt-02.avif"],
  "Men:textured-overshirt": ["textured-overshirt-01.avif", "textured-overshirt-02.avif"],
  "Men:dark-denim-jacket": ["dark-denim-jacket-01.avif", "dark-denim-jacket-02.avif"],
  "Men:essential-knit-polo": ["essential-knit-polo-01.avif", "essential-knit-polo-02.avif"],
  "Men:relaxed-heavyweight-tee": ["relaxed-heavyweight-tee-01.avif", "relaxed-heavyweight-tee-02.avif"],
  "Men:mens-tailored-blazer": ["tailored-blazer-01.avif", "tailored-blazer-02.avif"],
  "Men:cotton-trousers": ["cotton-trousers-01.avif", "cotton-trousers-02.avif"],
  "Men:mens-pleated-wide-trousers": ["pleated-wide-trousers-01.avif", "pleated-wide-trousers-02.avif"],
  "Men:minimal-utility-overshirt": ["minimal-utility-overshirt-01.avif", "minimal-utility-overshirt-02.avif"],
  "Men:mens-wool-blend-overcoat": ["wool-blend-overcoat-01.avif", "wool-blend-overcoat-02.avif"],
  "Men:monochrome-knit-crew": ["monochrome-knit-crew-01.avif", "monochrome-knit-crew-02.avif"],
  "Women:draped-satin-co-ord-set": ["draped-satin-co-ord-set-01.avif", "draped-satin-co-ord-set-02.avif"],
  "Women:asymmetric-dhoti-trousers": ["asymmetric-dhoti-trousers-01.avif", "asymmetric-dhoti-trousers-03.avif"],
  "Women:structured-bandhani-shirt": ["structured-bandhani-shirt-01.avif", "structured-bandhani-shirt-04.avif"],
  "Women:corset-kurta-top": ["corset-kurta-top-01.avif", "corset-kurta-top-05.avif"],
  "Women:draped-blazer-dress": ["draped-blazer-dress-01.avif", "draped-blazer-dress-06.avif"],
  "Women:pleated-palazzo-co-ord": ["pleated-palazzo-co-ord-01.avif", "pleated-palazzo-co-ord-07.avif"],
  "Women:cropped-waistcoat-trouser-set": ["cropped-waistcoat-trouser-set-01.avif", "cropped-waistcoat-trouser-set-08.avif"],
  "Women:one-shoulder-draped-dress": ["one-shoulder-draped-dress-01.avif", "one-shoulder-draped-dress-09.avif"],
  "Women:tailored-saree-style-skirt": ["tailored-saree-style-skirt-01.avif", "tailored-saree-style-skirt-10.avif"],
  "Women:contemporary-kurta-shirt": ["contemporary-kurta-shirt-01.avif", "contemporary-kurta-shirt-02.avif"],
  "Women:draped-denim-jacket": ["draped-denim-jacket-01.avif", "draped-denim-jacket-02.avif"],
  "Women:satin-cowl-top-wide-trousers": ["satin-cowl-top-wide-trousers-01.avif", "satin-cowl-top-wide-trousers-02.avif"],
  "Women:asymmetric-co-ord-blazer-set": ["asymmetric-co-ord-blazer-set-01.avif", "asymmetric-co-ord-blazer-set-02.avif"],
  "Women:sculpted-column-maxi-dress": ["sculpted-column-maxi-dress-01.avif", "sculpted-column-maxi-dress-02.avif"],
  "Women:relaxed-fit-t-shirt": ["relaxed-fit-t-shirt-01.avif", "relaxed-fit-t-shirt-02.avif"],
  "Women:womens-tailored-blazer": ["tailored-blazer-01.avif", "tailored-blazer-02.avif", "tailored-blazer-03.avif"],
  "Women:womens-structured-wool-coat": ["structured-wool-coat-01.avif", "structured-wool-coat-02.avif", "structured-wool-coat-03.avif"],
  "Women:womens-wide-leg-trousers": ["wide-leg-trousers-01.avif", "wide-leg-trousers-02.avif"],
  "Women:minimal-ribbed-dress": ["minimal-ribbed-dress-01.avif", "minimal-ribbed-dress-02.avif"],
  "Women:womens-tailored-wool-trousers": ["tailored-wool-trousers-01.avif", "tailored-wool-trousers-02.avif"],
};

const INDO_SLUGS = new Set([
  "draped-satin-co-ord-set","asymmetric-dhoti-trousers","structured-bandhani-shirt","corset-kurta-top",
  "pleated-palazzo-co-ord","cropped-waistcoat-trouser-set","one-shoulder-draped-dress","tailored-saree-style-skirt",
  "contemporary-kurta-shirt","satin-cowl-top-wide-trousers"
]);

export function collectionTypeFor(product: { gender?: string; slug?: string; collectionType?: string; type?: string; category?: { name?: string } | null }): CollectionType {
  if (product.gender === "Men") return "MEN";
  if (product.collectionType === "WOMEN_INDO_WESTERN" || product.collectionType === "WOMEN_WESTERN") return product.collectionType;
  return INDO_SLUGS.has(String(product.slug || "")) ? "WOMEN_INDO_WESTERN" : "WOMEN_WESTERN";
}

// Legacy / unprefixed slugs that may still exist in older databases.
const LEGACY_SLUG_ALIASES: Record<string, string> = {
  "Men:tailored-blazer": "Men:mens-tailored-blazer",
  "Men:pleated-wide-trousers": "Men:mens-pleated-wide-trousers",
  "Men:wool-blend-overcoat": "Men:mens-wool-blend-overcoat",
  "Women:tailored-blazer": "Women:womens-tailored-blazer",
  "Women:structured-wool-coat": "Women:womens-structured-wool-coat",
  "Women:wide-leg-trousers": "Women:womens-wide-leg-trousers",
  "Women:tailored-wool-trousers": "Women:womens-tailored-wool-trousers",
};

function slugifyName(value: string) {
  return value.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function catalogueKeyFor(product: { gender?: string; slug?: string; name?: string }) {
  const gender = product.gender || "";
  for (const raw of [String(product.slug || ""), slugifyName(String(product.name || ""))]) {
    if (!raw) continue;
    const direct = `${gender}:${raw}`;
    if (CANONICAL_IMAGES[direct]) return direct;
    const aliased = LEGACY_SLUG_ALIASES[direct];
    if (aliased && CANONICAL_IMAGES[aliased]) return aliased;
    const prefixed = `${gender}:${gender === "Women" ? "womens" : "mens"}-${raw}`;
    if (CANONICAL_IMAGES[prefixed]) return prefixed;
  }
  return null;
}

export function canonicalImagesFor(product: { gender?: string; slug?: string; name?: string; images?: string[] }) {
  const key = catalogueKeyFor(product);
  if (key) {
    const dir = product.gender === "Women" ? "women" : "men";
    return CANONICAL_IMAGES[key].map(name => `/images/products/new-catalogue/${dir}/${name}`);
  }
  return Array.isArray(product.images) ? product.images.filter(Boolean) : [];
}
