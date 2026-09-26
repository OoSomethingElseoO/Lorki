import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateTextField, validateEmail, validateUrl } from "@/lib/validation";
import { conservancyRequired } from "@/lib/authorization";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

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
  const currentUser = await getCurrentUser(request);
  const cause = conservancyRequired(currentUser);
  if (!cause) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const body = await readJsonObject(request) as Partial<ProfileUpdateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail || !body.registrationNumber) {
    return apiContractError("VALIDATION_ERROR", "name, region, mission, website, contactEmail, and registrationNumber are required", 400);
  }

  // ✅ Comprehensive validation
  const nameError = validateTextField(body.name, {
    minLength: 1,
    maxLength: 200,
    name: "Name",
  });
  if (nameError) {
    return apiContractError("VALIDATION_ERROR", nameError, 400);
  }

  const regionError = validateTextField(body.region, {
    minLength: 1,
    maxLength: 200,
    name: "Region",
  });
  if (regionError) {
    return apiContractError("VALIDATION_ERROR", regionError, 400);
  }

  const missionError = validateTextField(body.mission, {
    minLength: 1,
    maxLength: 5000,
    name: "Mission",
  });
  if (missionError) {
    return apiContractError("VALIDATION_ERROR", missionError, 400);
  }

  const websiteError = validateUrl(body.website);
  if (websiteError) {
    return apiContractError("VALIDATION_ERROR", websiteError, 400);
  }

  const emailError = validateEmail(body.contactEmail);
  if (emailError) {
    return apiContractError("VALIDATION_ERROR", emailError, 400);
  }

  const regNumError = validateTextField(body.registrationNumber, {
    minLength: 1,
    maxLength: 100,
    name: "Registration number",
  });
  if (regNumError) {
    return apiContractError("VALIDATION_ERROR", regNumError, 400);
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
