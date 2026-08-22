import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type ProfileUpdateBody = {
  name: string;
  region: string;
  mission: string;
  website: string;
  contactEmail: string;
  registrationNumber: string;
  registrationDocumentUrl?: string;
};

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  const cause = currentUser?.conservancy;
  if (!cause) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<ProfileUpdateBody>;

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail || !body.registrationNumber) {
    return NextResponse.json(
      { error: "name, region, mission, website, contactEmail, and registrationNumber are required" },
      { status: 400 },
    );
  }

  // A name change invalidates the sanctions check (screened against the
  // old name); a registration-number change invalidates the registration
  // check (an admin verified the OLD number, not this one). Either
  // invalidates overall verification — an artist can't route a new
  // self-service campaign here again until an admin re-reviews. Already-
  // existing campaigns/payouts are untouched; this only gates new ones.
  const nameChanged = body.name !== cause.name;
  const registrationNumberChanged = body.registrationNumber !== cause.registrationNumber;
  const needsReverification = (nameChanged || registrationNumberChanged) && cause.verifiedAt !== null;

  const conservancy = await prisma.conservancy.update({
    where: { id: cause.id },
    data: {
      name: body.name,
      region: body.region,
      mission: body.mission,
      website: body.website,
      contactEmail: body.contactEmail,
      registrationNumber: body.registrationNumber,
      registrationDocumentUrl: body.registrationDocumentUrl || null,
      ...(needsReverification
        ? {
            verifiedAt: null,
            ...(nameChanged ? { sanctionsCheckedAt: null } : {}),
            ...(registrationNumberChanged
              ? { registrationCheckedAt: null, registrationVerificationMethod: null }
              : {}),
          }
        : {}),
    },
  });

  return NextResponse.json({ conservancy });
}
