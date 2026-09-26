import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

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
// pattern as /api/artist/onboarding for artists: turns an existing plain
// account into a cause, no separate signup, no new credentials, no admin
// approval step.
export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  if (user.conservancy) {
    return apiContractError("CONFLICT", "You already have a cause profile", 409);
  }

  const body = await readJsonObject(request) as Partial<OnboardBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail || !body.registrationNumber) {
    return apiContractError("VALIDATION_ERROR", "name, region, mission, website, contactEmail, and registrationNumber are required", 400);
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
