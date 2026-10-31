-- Reconcile both historical table names without discarding saved website history.
-- Older local copies created "SiteSnapshot"; current Prisma schema uses "SiteDesignSnapshot".
DO $$
BEGIN
  IF to_regclass('public."SiteDesignSnapshot"') IS NULL THEN
    IF to_regclass('public."SiteSnapshot"') IS NOT NULL THEN
      ALTER TABLE public."SiteSnapshot" RENAME TO "SiteDesignSnapshot";
    ELSE
      CREATE TABLE public."SiteDesignSnapshot" (
        "id" TEXT NOT NULL,
        "kind" TEXT NOT NULL,
        "dateKey" TEXT NOT NULL,
        "label" TEXT,
        "pageCount" INTEGER NOT NULL DEFAULT 0,
        "sectionCount" INTEGER NOT NULL DEFAULT 0,
        "state" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SiteDesignSnapshot_pkey" PRIMARY KEY ("id")
      );
    END IF;
  END IF;

  -- If both names exist, merge older rows into the schema-backed table. Keep the
  -- old table untouched as a safety net; a conflict never overwrites newer data.
  IF to_regclass('public."SiteDesignSnapshot"') IS NOT NULL
     AND to_regclass('public."SiteSnapshot"') IS NOT NULL THEN
    INSERT INTO public."SiteDesignSnapshot"
      ("id", "kind", "dateKey", "label", "pageCount", "sectionCount", "state", "createdBy", "createdAt", "updatedAt")
    SELECT "id", "kind", "dateKey", "label", "pageCount", "sectionCount", "state", "createdBy", "createdAt", "updatedAt"
    FROM public."SiteSnapshot"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Table renames do not rename associated index names in PostgreSQL.
DO $$
BEGIN
  IF to_regclass('public."SiteSnapshot_dateKey_kind_idx"') IS NOT NULL
     AND to_regclass('public."SiteDesignSnapshot_dateKey_kind_idx"') IS NULL THEN
    ALTER INDEX public."SiteSnapshot_dateKey_kind_idx" RENAME TO "SiteDesignSnapshot_dateKey_kind_idx";
  END IF;
  IF to_regclass('public."SiteSnapshot_createdAt_idx"') IS NOT NULL
     AND to_regclass('public."SiteDesignSnapshot_createdAt_idx"') IS NULL THEN
    ALTER INDEX public."SiteSnapshot_createdAt_idx" RENAME TO "SiteDesignSnapshot_createdAt_idx";
  END IF;
  IF to_regclass('public."SiteDesignSnapshot"') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteSnapshot_pkey' AND conrelid = 'public."SiteDesignSnapshot"'::regclass)
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteDesignSnapshot_pkey' AND conrelid = 'public."SiteDesignSnapshot"'::regclass) THEN
    ALTER TABLE public."SiteDesignSnapshot" RENAME CONSTRAINT "SiteSnapshot_pkey" TO "SiteDesignSnapshot_pkey";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SiteDesignSnapshot_dateKey_kind_idx" ON public."SiteDesignSnapshot"("dateKey", "kind");
CREATE INDEX IF NOT EXISTS "SiteDesignSnapshot_createdAt_idx" ON public."SiteDesignSnapshot"("createdAt");
