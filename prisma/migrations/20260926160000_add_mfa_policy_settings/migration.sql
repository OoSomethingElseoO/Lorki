ALTER TABLE "Settings"
  ADD COLUMN "requireMfaForAdmins" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireMfaForHighRisk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowMfaEmailOtp" BOOLEAN NOT NULL DEFAULT false;
