ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Category" ADD COLUMN "imageMode" TEXT NOT NULL DEFAULT 'contain';
ALTER TABLE "Category" ADD COLUMN "imageRatio" TEXT NOT NULL DEFAULT 'original';
ALTER TABLE "Category" ADD COLUMN "imageHeight" INTEGER;
CREATE TABLE "BlockedIdentity" (
  "id" TEXT NOT NULL,
  "emailHash" TEXT,
  "phoneHash" TEXT,
  "addressHash" TEXT,
  "reason" TEXT,
  "blockedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlockedIdentity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BlockedIdentity_emailHash_idx" ON "BlockedIdentity"("emailHash");
CREATE INDEX "BlockedIdentity_phoneHash_idx" ON "BlockedIdentity"("phoneHash");
CREATE INDEX "BlockedIdentity_addressHash_idx" ON "BlockedIdentity"("addressHash");
CREATE TABLE "SitePage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SitePage_slug_key" ON "SitePage"("slug");
CREATE INDEX "SitePage_status_isSystem_idx" ON "SitePage"("status", "isSystem");
CREATE TABLE "SiteSection" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiteSection_pageId_sortOrder_idx" ON "SiteSection"("pageId", "sortOrder");
ALTER TABLE "SiteSection" ADD CONSTRAINT "SiteSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
