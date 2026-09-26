import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";
import { sendWorkVisibilityEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getCurrentUser(request);
  if (!checkPermission(admin, "OPS_ADMIN").authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as { withdrawn?: unknown } | null;
  if (typeof body?.withdrawn !== "boolean") return apiContractError("VALIDATION_ERROR", "withdrawn must be boolean", 400);
  const artist = await prisma.artist.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!artist) return apiContractError("NOT_FOUND", "Artist not found", 404);
  const result = await prisma.artwork.updateMany({ where: { campaign: { artistId: id }, inventoryState: { not: "SOLD" } }, data: { isPublished: !body.withdrawn } });
  await recordAudit({ action: body.withdrawn ? "ARTIST_WORK_WITHDRAWN" : "ARTIST_WORK_REPUBLISHED", affectedEntityType: "Artist", affectedEntityId: id, reason: body.withdrawn ? "Admin withdrew unsold artwork from the public catalogue" : "Admin republished unsold artwork", changedBy: admin!.email, metadata: { artworkCount: result.count, artistName: artist.name } });
  const artistUser = await prisma.artist.findUnique({ where: { id }, select: { user: { select: { email: true } } } });
  if (artistUser?.user?.email) sendWorkVisibilityEmail(artistUser.user.email, result.count, body.withdrawn ? "withdrawn" : "republished").catch(() => undefined);
  return NextResponse.json({ ok: true, updatedArtworkCount: result.count, withdrawn: body.withdrawn });
}
