CREATE TABLE "ShareEvent" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShareEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShareEvent_targetType_targetId_createdAt_idx" ON "ShareEvent"("targetType", "targetId", "createdAt");
CREATE INDEX "ShareEvent_createdAt_idx" ON "ShareEvent"("createdAt");
ALTER TABLE "ShareEvent" ADD CONSTRAINT "ShareEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
