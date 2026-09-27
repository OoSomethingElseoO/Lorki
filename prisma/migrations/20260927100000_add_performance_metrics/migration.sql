CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "route" TEXT NOT NULL,
    "deviceClass" TEXT NOT NULL,
    "navigationType" TEXT,
    "connectionType" TEXT,
    "release" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerformanceMetric_metric_createdAt_idx" ON "PerformanceMetric"("metric", "createdAt");
CREATE INDEX "PerformanceMetric_route_createdAt_idx" ON "PerformanceMetric"("route", "createdAt");
