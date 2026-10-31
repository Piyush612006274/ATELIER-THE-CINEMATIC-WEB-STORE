ALTER TABLE "Product" ADD COLUMN "collectionType" TEXT NOT NULL DEFAULT 'WOMEN_WESTERN';
UPDATE "Product" SET "collectionType" = CASE
  WHEN "gender" = 'Men' THEN 'MEN'
  WHEN "slug" IN ('draped-satin-co-ord-set','asymmetric-dhoti-trousers','structured-bandhani-shirt','corset-kurta-top','pleated-palazzo-co-ord','cropped-waistcoat-trouser-set','one-shoulder-draped-dress','tailored-saree-style-skirt','contemporary-kurta-shirt','satin-cowl-top-wide-trousers') THEN 'WOMEN_INDO_WESTERN'
  ELSE 'WOMEN_WESTERN'
END;
