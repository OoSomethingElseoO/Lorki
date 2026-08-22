-- AlterTable
ALTER TABLE "Conservancy" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- Every existing conservancy predates self-registration entirely, so it
-- was necessarily entered by an admin by hand — back-verify all of them
-- rather than retroactively locking out organizations that were never
-- part of the trust problem this column exists to solve.
UPDATE "Conservancy" SET "verifiedAt" = "createdAt" WHERE "verifiedAt" IS NULL;
