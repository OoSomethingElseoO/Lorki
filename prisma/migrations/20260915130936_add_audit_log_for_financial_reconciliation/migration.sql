-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_animalId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_conservancyId_fkey";

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "affectedEntityType" TEXT NOT NULL,
    "affectedEntityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_affectedEntityType_affectedEntityId_idx" ON "AuditLog"("affectedEntityType", "affectedEntityId");

-- CreateIndex
CREATE INDEX "AuditLog_changedBy_idx" ON "AuditLog"("changedBy");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_conservancyId_fkey" FOREIGN KEY ("conservancyId") REFERENCES "Conservancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
