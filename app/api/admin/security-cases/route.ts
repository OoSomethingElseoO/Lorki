import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { apiJson } from "@/lib/api-contract";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!checkPermission(user, "OPS_ADMIN").authorized) return unauthorized("OPS_ADMIN");
  const cases = await prisma.securityCase.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return apiJson({ cases });
}
