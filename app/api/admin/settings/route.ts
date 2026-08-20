import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getSettings();

  return NextResponse.json({
    settings: {
      stripeSecretKeySet: Boolean(settings.stripeSecretKey),
      stripeWebhookSecretSet: Boolean(settings.stripeWebhookSecret),
      resendApiKeySet: Boolean(settings.resendApiKey),
      emailFrom: settings.emailFrom ?? "",
      operationsEmail: settings.operationsEmail ?? "",
    },
  });
}

type UpdateBody = {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  resendApiKey?: string;
  emailFrom?: string;
  operationsEmail?: string;
};

// Fields are only overwritten when a non-empty value is sent — the admin UI
// shows secrets as masked/blank once set, so a blank submit must mean "leave
// this one alone," not "clear it."
export async function PATCH(request: Request) {
  const body = (await request.json()) as UpdateBody;

  const data: Record<string, string> = {};
  for (const key of ["stripeSecretKey", "stripeWebhookSecret", "resendApiKey", "emailFrom", "operationsEmail"] as const) {
    const value = body[key];
    if (typeof value === "string" && value.trim().length > 0) {
      data[key] = value.trim();
    }
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json({ ok: true });
}
