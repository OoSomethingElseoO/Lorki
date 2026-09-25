CREATE TYPE "ReconciliationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
ALTER TABLE "PaymentReconciliation" ADD COLUMN "priority" "ReconciliationPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "PaymentReconciliation" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "PaymentReconciliation" ADD COLUMN "triagedAt" TIMESTAMP(3);
ALTER TABLE "PaymentReconciliation" ADD COLUMN "triagedBy" TEXT;
ALTER TABLE "PaymentReconciliation" ADD COLUMN "triageNote" TEXT;

CREATE OR REPLACE FUNCTION prevent_financial_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Financial audit records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only ON "AuditLog";
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_log_mutation();
