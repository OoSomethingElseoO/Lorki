CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'FLUTTERWAVE', 'MANUAL');
CREATE TYPE "ProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'MISSING_PROVIDER_PAYMENT', 'MISSING_LOCAL_ORDER', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'DUPLICATE_EVENT', 'PAYOUT_MISMATCH', 'REFUND_UNMATCHED', 'MANUAL_REVIEW', 'RESOLVED');

CREATE TABLE "PaymentProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "externalId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "ProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB,
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentProviderEvent_provider_externalId_key" ON "PaymentProviderEvent"("provider", "externalId");
CREATE INDEX "PaymentProviderEvent_receivedAt_idx" ON "PaymentProviderEvent"("receivedAt");

CREATE TABLE "PaymentReconciliation" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "externalId" TEXT,
  "orderId" TEXT,
  "payoutId" TEXT,
  "expectedAmountCents" INTEGER,
  "actualAmountCents" INTEGER,
  "expectedCurrency" TEXT,
  "actualCurrency" TEXT,
  "status" "ReconciliationStatus" NOT NULL,
  "differenceCents" INTEGER,
  "eventType" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "metadata" JSONB,
  CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentReconciliation_status_observedAt_idx" ON "PaymentReconciliation"("status", "observedAt");
CREATE INDEX "PaymentReconciliation_provider_externalId_idx" ON "PaymentReconciliation"("provider", "externalId");
CREATE INDEX "PaymentReconciliation_orderId_idx" ON "PaymentReconciliation"("orderId");
CREATE INDEX "PaymentReconciliation_payoutId_idx" ON "PaymentReconciliation"("payoutId");
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
