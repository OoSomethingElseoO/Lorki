import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type OnboardBody = {
  name: string;
  region: string;
  mission: string;
  website: string;
  contactEmail: string;
  registrationNumber: string;
  registrationDocumentUrl?: string;
};

// Links a new Conservancy ("cause") to the CURRENTLY LOGGED-IN user — same
// pattern as /api/seller/onboarding for artists: turns an existing plain
// account into a cause, no separate signup, no new credentials, no admin
// approval step.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (user.conservancy) {
    return NextResponse.json({ error: "You already have a cause profile" }, { status: 409 });
  }

  const body = (await request.json()) as Partial<OnboardBody>;

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail || !body.registrationNumber) {
    return NextResponse.json(
      { error: "name, region, mission, website, contactEmail, and registrationNumber are required" },
      { status: 400 },
    );
  }

  const conservancy = await prisma.conservancy.create({
    data: {
      name: body.name,
      region: body.region,
      mission: body.mission,
      website: body.website,
      contactEmail: body.contactEmail,
      registrationNumber: body.registrationNumber,
      registrationDocumentUrl: body.registrationDocumentUrl || null,
      userId: user.id,
    },
  });

  return NextResponse.json({ conservancy }, { status: 201 });
}
