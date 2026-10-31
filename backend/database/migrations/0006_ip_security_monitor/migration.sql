CREATE TABLE "IpBlock" (
  "id" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "reason" TEXT,
  "isPermanent" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "blockedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IpBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IpBlock_ipAddress_key" ON "IpBlock"("ipAddress");
CREATE INDEX "IpBlock_isPermanent_expiresAt_idx" ON "IpBlock"("isPermanent", "expiresAt");

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'WARNED',
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_ipAddress_createdAt_idx" ON "SecurityEvent"("ipAddress", "createdAt");
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");
CREATE INDEX "SecurityEvent_action_createdAt_idx" ON "SecurityEvent"("action", "createdAt");
