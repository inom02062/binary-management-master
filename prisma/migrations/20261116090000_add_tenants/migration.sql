CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Tenant_databaseUrl_key" ON "Tenant"("databaseUrl");

ALTER TABLE "User" ADD COLUMN "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

ALTER TABLE "ActivityLog" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "ActivityLog_tenantId_createdAt_idx" ON "ActivityLog"("tenantId", "createdAt");
