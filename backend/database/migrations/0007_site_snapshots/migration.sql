CREATE TABLE IF NOT EXISTS "SiteDesignSnapshot" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "label" TEXT,
  "pageCount" INTEGER NOT NULL DEFAULT 0,
  "sectionCount" INTEGER NOT NULL DEFAULT 0,
  "state" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteDesignSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiteDesignSnapshot_dateKey_kind_idx" ON "SiteDesignSnapshot"("dateKey", "kind");
CREATE INDEX IF NOT EXISTS "SiteDesignSnapshot_createdAt_idx" ON "SiteDesignSnapshot"("createdAt");
