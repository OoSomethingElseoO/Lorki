import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { sendMfaReminderEmail } from "@/lib/email";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function POST(request: Request) {
  const admin = await getCurrentUser(request);
  if (!checkPermission(admin, "OPS_ADMIN").authorized) return unauthorized("OPS_ADMIN");
  const body = await readJsonObject(request) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) return apiContractError("INVALID_EMAIL", "A valid user email is required", 400);
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return apiContractError("NOT_FOUND", "User not found", 404);
  if (target.mfaEnabled) return apiContractError("CONFLICT", "MFA is already enabled for this user", 409);
  const settings = await getSettings();
  await sendMfaReminderEmail(target.email, settings.siteName?.trim() || "Lorki Originals");
  await recordAudit({ action: "MFA_REMINDER_SENT", affectedEntityType: "User", affectedEntityId: target.id, reason: "Administrator sent an MFA enrollment reminder", changedBy: admin!.email, metadata: { targetEmail: target.email } });
  return NextResponse.json({ ok: true });
}
