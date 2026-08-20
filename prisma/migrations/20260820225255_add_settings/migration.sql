-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "stripeSecretKey" TEXT,
    "stripeWebhookSecret" TEXT,
    "resendApiKey" TEXT,
    "emailFrom" TEXT,
    "operationsEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
