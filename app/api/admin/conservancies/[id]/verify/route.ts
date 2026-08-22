import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

type VerifyBody = {
  registrationChecked: boolean;
  registrationVerificationMethod: string;
  sanctionsChecked: boolean;
  payoutNameChecked: boolean;
};

// The one checkpoint between a self-registered cause (see
// /api/cause/onboarding — anyone can create one with a self-asserted name
// and mission, no verification at all) and it actually being usable:
// /api/seller/campaigns refuses to let an artist route a self-service
// campaign's donations to a conservancy that isn't verified.
//
// Not real KYC/KYB — no identity or sanctions database is queried
// automatically here. This is a manual checklist an admin confirms by
// hand, and registrationVerificationMethod matters specifically because
// not every country has a free instant registry lookup (see
// lib/registry-lookups.ts — Kenya's PBORA and Ethiopia's ACSO don't;
// Nigeria's CAC and South Africa's NPO register do). A bare checkbox would
// let "verified" mean anything from a one-click official search to
// nothing at all for the exact countries this app's founding market is
// in — requiring the admin to write down what they actually did (a paid
// records search, an independently-found phone call, whichever registry)
// makes that difference visible instead of hiding it. Get a lawyer
// involved before treating any of this as a compliance program. All items
// must be confirmed together in one request; verifiedAt (the actual
// campaign-creation gate) is only set once they are, and each is
// timestamped separately so there's a record of what was checked, not
// just a single unlabeled "verified" flag.
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<VerifyBody>;

  if (!body.registrationChecked || !body.sanctionsChecked || !body.payoutNameChecked) {
    return NextResponse.json(
      { error: "All three checklist items must be confirmed to verify a cause" },
      { status: 400 },
    );
  }

  if (!body.registrationVerificationMethod?.trim()) {
    return NextResponse.json(
      { error: "Describe how the registration number was actually checked (which registry, a paid search, a direct call, etc.)" },
      { status: 400 },
    );
  }

  const now = new Date();

  try {
    const conservancy = await prisma.conservancy.update({
      where: { id },
      data: {
        registrationCheckedAt: now,
        registrationVerificationMethod: body.registrationVerificationMethod.trim(),
        sanctionsCheckedAt: now,
        payoutNameCheckedAt: now,
        verifiedAt: now,
      },
    });
    return NextResponse.json({ conservancy });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Conservancy not found" }, { status: 404 });
    }
    throw error;
  }
}
