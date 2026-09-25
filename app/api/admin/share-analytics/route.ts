import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { ADMIN_PAGE_SIZE, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

function dateValue(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!checkPermission(user, "OPS_ADMIN").authorized) return unauthorized("OPS_ADMIN");

  const url = new URL(request.url);
  const page = normalizeAdminPage(url.searchParams.get("page") ?? undefined);
  const targetType = url.searchParams.get("targetType")?.trim();
  const channel = url.searchParams.get("channel")?.trim();
  const targetId = url.searchParams.get("targetId")?.trim();
  const from = dateValue(url.searchParams.get("from"));
  const to = dateValue(url.searchParams.get("to"), true);
  const where = {
    ...(targetType ? { targetType } : {}),
    ...(channel ? { channel } : {}),
    ...(targetId ? { targetId: { contains: targetId, mode: "insensitive" as const } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [events, total, groupedTargets, groupedChannels] = await Promise.all([
    prisma.shareEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.shareEvent.count({ where }),
    prisma.shareEvent.groupBy({ by: ["targetType"], where, _count: { _all: true }, orderBy: { _count: { targetType: "desc" } } }),
    prisma.shareEvent.groupBy({ by: ["channel"], where, _count: { _all: true }, orderBy: { _count: { channel: "desc" } } }),
  ]);

  return NextResponse.json({
    events,
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    summary: {
      byTargetType: groupedTargets.map((item) => ({ targetType: item.targetType, count: item._count._all })),
      byChannel: groupedChannels.map((item) => ({ channel: item.channel, count: item._count._all })),
    },
  });
}
