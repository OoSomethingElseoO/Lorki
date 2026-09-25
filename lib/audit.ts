import { prisma } from "@/lib/prisma";

export async function recordAudit(input: {
  action: string;
  affectedEntityType: string;
  affectedEntityId: string;
  reason: string;
  changedBy: string;
  metadata?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      affectedEntityType: input.affectedEntityType,
      affectedEntityId: input.affectedEntityId,
      reason: input.reason,
      changedBy: input.changedBy,
      metadata: input.metadata === undefined ? undefined : JSON.parse(JSON.stringify(input.metadata)),
    },
  });
}
