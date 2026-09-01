-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('RESEND', 'SMTP', 'NONE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "smtpHost" TEXT,
ADD COLUMN "smtpPort" TEXT,
ADD COLUMN "smtpUser" TEXT,
ADD COLUMN "smtpPassword" TEXT;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
