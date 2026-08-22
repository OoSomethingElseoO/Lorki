-- AlterTable
ALTER TABLE "Conservancy" ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "registrationDocumentUrl" TEXT,
ADD COLUMN     "payoutAccountHolderName" TEXT,
ADD COLUMN     "registrationCheckedAt" TIMESTAMP(3),
ADD COLUMN     "sanctionsCheckedAt" TIMESTAMP(3),
ADD COLUMN     "payoutNameCheckedAt" TIMESTAMP(3);

-- Every existing conservancy was already back-verified as admin-created
-- (see the previous migration) — back-fill the three checklist items to
-- match, so an already-trusted admin-created org doesn't retroactively
-- fail a checklist that didn't exist when it was created.
UPDATE "Conservancy"
SET "registrationCheckedAt" = "verifiedAt", "sanctionsCheckedAt" = "verifiedAt", "payoutNameCheckedAt" = "verifiedAt"
WHERE "verifiedAt" IS NOT NULL;
