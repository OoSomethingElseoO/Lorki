-- AlterTable
ALTER TABLE "Conservancy" ADD COLUMN     "registrationVerificationMethod" TEXT;

-- Every existing conservancy was already back-verified as admin-created,
-- pre-dating this field entirely — record a generic method rather than
-- leaving already-verified rows with an unexplained blank.
UPDATE "Conservancy" SET "registrationVerificationMethod" = 'Admin-created before this field existed'
WHERE "registrationCheckedAt" IS NOT NULL AND "registrationVerificationMethod" IS NULL;
