import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { sendInquiryConfirmationEmail, sendOperationsAlert } from "@/lib/email";
import { RESERVATION_TTL_MS } from "@/lib/reservations";

type InquiryBody = {
  artworkId: string;
  name: string;
  email: string;
  message?: string;
};

// Same shape as checkout's rate limit, but a separate bucket — an original
// getting a lot of interest shouldn't cost a buyer their checkout attempts.
const INQUIRY_RATE_LIMIT = 5;
const INQUIRY_RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`inquiry:${ip}`, INQUIRY_RATE_LIMIT, INQUIRY_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many inquiries. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<InquiryBody>;

  if (!body.artworkId || !body.name || !body.email) {
    return NextResponse.json({ error: "artworkId, name, and email are required" }, { status: 400 });
  }

  const artwork = await prisma.artwork.findUnique({ where: { id: body.artworkId } });

  if (!artwork) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  if (artwork.kind !== "ORIGINAL" || artwork.inventoryState !== "AVAILABLE") {
    return NextResponse.json({ error: "This piece isn't available for inquiries" }, { status: 409 });
  }

  // Conditioned on inventoryState still being AVAILABLE in the same
  // statement (not a separate check-then-write) — two inquiries racing on
  // the same one-of-one piece must not both succeed. Whichever request's
  // UPDATE actually matches a row wins the reservation; the loser sees
  // count 0 and is told the same "not available" story as if it had
  // arrived a moment later. Released automatically after
  // RESERVATION_TTL_MS by releaseExpiredReservations() if the inquiry
  // doesn't turn into a recorded sale — see lib/reservations.ts.
  const reserved = await prisma.artwork.updateMany({
    where: { id: artwork.id, inventoryState: "AVAILABLE" },
    data: { inventoryState: "RESERVED", reservedAt: new Date() },
  });

  if (reserved.count === 0) {
    return NextResponse.json({ error: "This piece isn't available for inquiries" }, { status: 409 });
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      artworkId: artwork.id,
      name: body.name,
      email: body.email,
      message: body.message || null,
    },
  });

  await sendInquiryConfirmationEmail({ email: body.email, artworkTitle: artwork.title });

  const holdMinutes = Math.round(RESERVATION_TTL_MS / 60_000);
  await sendOperationsAlert(
    `New inquiry: ${artwork.title}`,
    `<p><strong>${body.name}</strong> (${body.email}) is interested in <strong>${artwork.title}</strong> — a one-of-one original, so this needs a personal follow-up, not automated fulfillment.</p>${
      body.message ? `<p>Their message: "${body.message}"</p>` : ""
    }<p>This piece is now held for ${holdMinutes} minutes and won't show as available to other visitors. Reply directly to their email to arrange payment and shipping — once agreed, record the sale from /admin/orders before the hold expires, or the piece goes back on sale automatically.</p>`,
  );

  return NextResponse.json({ inquiry }, { status: 201 });
}
