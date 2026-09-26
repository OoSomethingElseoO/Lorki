import { NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";
import { recordAudit } from "@/lib/audit";
import { sendDeletionRequestedEmail } from "@/lib/email";

/**
 * Request account closure without destroying financial, payout, or audit
 * history. The request immediately disables the account and clears its
 * session; an administrator must decide whether it can be retained,
 * anonymized, or restored.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return apiContractError("UNAUTHENTICATED", "Not signed in", 401);

  const body = await readJsonObject(request) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

  const pending = await prisma.accountDeletionRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return apiContractError("CONFLICT", "An account deletion request is already pending review", 409);

  const now = new Date();
  let requestRecord;
  try {
    requestRecord = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: user.id, accountStatus: "ACTIVE" },
        data: {
          accountStatus: "DELETION_REQUESTED",
          deletionRequestedAt: now,
          sessionVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("ACCOUNT_STATE_CHANGED");
      return tx.accountDeletionRequest.create({
        data: { userId: user.id, reason },
        select: { id: true, status: true, requestedAt: true },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_STATE_CHANGED") {
      return apiContractError("CONFLICT", "The account state changed; please refresh and try again", 409);
    }
    throw error;
  }

  await recordAudit({
    action: "ACCOUNT_DELETION_REQUESTED",
    affectedEntityType: "User",
    affectedEntityId: user.id,
    reason: reason || "User requested account deletion",
    changedBy: user.email,
    metadata: { requestId: requestRecord.id },
  });
  sendDeletionRequestedEmail(user.email, "Lorkulup").catch(() => undefined);

  const response = NextResponse.json({ ok: true, request: requestRecord });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
