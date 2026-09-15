-- CreateTable
CREATE TABLE "IdempotencyStore" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyStore_createdAt_idx" ON "IdempotencyStore"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyStore_idempotencyKey_userId_key" ON "IdempotencyStore"("idempotencyKey", "userId");
