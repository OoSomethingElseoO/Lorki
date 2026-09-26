ALTER TABLE "MfaChallenge"
  ADD COLUMN "emailCodeHash" TEXT,
  ADD COLUMN "emailCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0;
