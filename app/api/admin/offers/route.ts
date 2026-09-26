import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { apiJson } from "@/lib/api-contract";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const offers = await prisma.offer.findMany({
    include: { artwork: { select: { id: true, title: true, saleMode: true, offerClosesAt: true } }, order: { select: { id: true, status: true } } },
    orderBy: [{ status: "asc" }, { amountCents: "desc" }, { submittedAt: "asc" }],
  });
  return apiJson({ offers });
}
