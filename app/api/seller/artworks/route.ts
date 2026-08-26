import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";

export async function GET() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const artworks = await prisma.artwork.findMany({
    where: { campaign: { artistId: seller.id } },
    include: { campaign: { include: { animal: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ artworks });
}

type CreateBody = {
  campaignId: string;
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
};

// Full self-service: goes live the instant it's created — the campaign it
// belongs to is already LIVE (self-service campaigns always are), so there
// is no separate publish/approval step for the artwork itself.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.campaignId || !body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return NextResponse.json(
      { error: "campaignId, title, kind, priceCents, imageUrl, and altText are required" },
      { status: 400 },
    );
  }

  if (body.kind !== "ORIGINAL" && body.kind !== "PRINT") {
    return NextResponse.json({ error: "kind must be ORIGINAL or PRINT" }, { status: 400 });
  }

  if (isPriceTooLow(body.priceCents)) {
    return NextResponse.json({ error: `priceCents must be at least ${MIN_PRICE_CENTS}` }, { status: 400 });
  }

  // Ownership check: this campaign must actually belong to the seller
  // making the request — otherwise anyone could list artwork under
  // someone else's campaign.
  const campaign = await prisma.campaign.findUnique({ where: { id: body.campaignId } });
  if (!campaign || campaign.artistId !== seller.id) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // A self-service campaign is always born LIVE (see the comment above),
  // but an admin can PAUSE or ARCHIVE it afterward — without this check,
  // a seller could keep listing new artwork under it with no error at
  // all, and it would just silently never appear anywhere (every
  // storefront query filters on campaign.status === "LIVE"). Reject it
  // here instead of letting that happen invisibly.
  if (campaign.status !== "LIVE") {
    return NextResponse.json(
      { error: `This campaign is ${campaign.status.toLowerCase()} — new listings aren't accepted until it's live again.` },
      { status: 409 },
    );
  }

  const artwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: body.title,
      kind: body.kind,
      priceCents: body.priceCents,
      imageUrl: body.imageUrl,
      altText: body.altText,
    },
  });

  return NextResponse.json({ artwork }, { status: 201 });
}
