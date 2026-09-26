import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { apiJson } from "@/lib/api-contract";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");

  const inquiries = await prisma.inquiry.findMany({
    include: {
      artwork: { include: { campaign: { include: { animal: true, artist: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiJson({ inquiries });
}
