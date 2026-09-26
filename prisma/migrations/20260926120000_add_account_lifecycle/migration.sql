CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DELETION_REQUESTED', 'SUSPENDED', 'DELETION_APPROVED', 'ANONYMIZED');
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESTORED');

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deletionApprovedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3),
  ADD COLUMN "legalHoldUntil" TIMESTAMP(3);

CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AccountDeletionRequest_status_requestedAt_idx" ON "AccountDeletionRequest"("status", "requestedAt");
CREATE INDEX "AccountDeletionRequest_userId_requestedAt_idx" ON "AccountDeletionRequest"("userId", "requestedAt");
