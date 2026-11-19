-- These columns and table existed in databases previously synchronized with db push.
-- The migration records them for fresh databases; existing volumes must baseline it as applied.
ALTER TABLE "Payment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAID';

ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "User" ADD COLUMN "permissions" TEXT DEFAULT '[]';

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);