import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { sendInquiryConfirmationEmail, sendOperationsAlert } from "@/lib/email";

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

  const inquiry = await prisma.inquiry.create({
    data: {
      artworkId: artwork.id,
      name: body.name,
      email: body.email,
      message: body.message || null,
    },
  });

  await sendInquiryConfirmationEmail({ email: body.email, artworkTitle: artwork.title });

  await sendOperationsAlert(
    `New inquiry: ${artwork.title}`,
    `<p><strong>${body.name}</strong> (${body.email}) is interested in <strong>${artwork.title}</strong> — a one-of-one original, so this needs a personal follow-up, not automated fulfillment.</p>${
      body.message ? `<p>Their message: "${body.message}"</p>` : ""
    }<p>Reply directly to their email to arrange payment and shipping. Once agreed, record the sale from /admin/orders.</p>`,
  );

  return NextResponse.json({ inquiry }, { status: 201 });
}
