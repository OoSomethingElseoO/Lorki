CREATE TYPE "SecurityCaseSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SecurityCaseStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE');
CREATE TABLE "SecurityCase" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" "SecurityCaseSeverity" NOT NULL,
  "status" "SecurityCaseStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "evidence" JSONB,
  "assignedTo" TEXT,
  "triageNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SecurityCase_fingerprint_key" ON "SecurityCase"("fingerprint");
CREATE INDEX "SecurityCase_status_severity_createdAt_idx" ON "SecurityCase"("status", "severity", "createdAt");
CREATE INDEX "SecurityCase_assignedTo_idx" ON "SecurityCase"("assignedTo");
