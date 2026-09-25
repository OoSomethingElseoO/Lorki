import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!checkPermission(user, "OPS_ADMIN").authorized) return unauthorized("OPS_ADMIN");
  const cases = await prisma.securityCase.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ cases });
}
