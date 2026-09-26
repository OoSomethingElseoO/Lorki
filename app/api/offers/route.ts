import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { sendOfferNotificationEmail } from "@/lib/email";

type OfferBody = { artworkId: string; amountCents: number; email?: string };
const OFFER_RATE_LIMIT = 20;
const OFFER_RATE_WINDOW_MS = 10 * 60 * 1000;
const MIN_INCREMENT_CENTS = 50;
const EXTENSION_WINDOW_MS = 5 * 60 * 1000;
const EXTENSION_MS = 5 * 60 * 1000;
const MAX_EXTENSIONS = 6;

/** Public offer endpoint. The artwork row is locked for the complete write. */
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (await isRateLimited(`offer:${ip}`, OFFER_RATE_LIMIT, OFFER_RATE_WINDOW_MS)) {
    return apiContractError("RATE_LIMITED", "Too many offers. Please try again later.", 429);
  }

  const body = await readJsonObject(request) as Partial<OfferBody> | null;
  if (!body || typeof body.artworkId !== "string" || typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents)) {
    return apiContractError("INVALID_INPUT", "artworkId and an integer amountCents are required", 400);
  }
  const amountCents = body.amountCents;
  if (amountCents <= 0) {
    return apiContractError("INVALID_INPUT", "Offer amount must be positive", 400, { field: "amountCents" });
  }

  const user = await getCurrentUser(request);
  const email = user?.email ?? body.email?.trim().toLowerCase();
  if (!email) return apiContractError("INVALID_INPUT", "An email address is required", 400, { field: "email" });
  const emailError = validateEmail(email);
  if (emailError) return apiContractError("INVALID_EMAIL", emailError, 400, { field: "email" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{
        id: string;
        saleMode: "FIXED_PRICE" | "OFFERS" | "AUCTION";
        inventoryState: "AVAILABLE" | "RESERVED" | "SOLD";
        priceCents: number;
        currency: string;
        offerClosesAt: Date | null;
        offerExtensionCount: number;
        currentHighestOfferAmountCents: number | null;
        title: string;
      }>>`SELECT "id", "title", "saleMode", "inventoryState", "priceCents", "currency", "offerClosesAt", "offerExtensionCount", "currentHighestOfferAmountCents" FROM "Artwork" WHERE "id" = ${body.artworkId} FOR UPDATE`;
      const artwork = locked[0];
      if (!artwork) throw new Error("NOT_FOUND");
      if (artwork.saleMode === "AUCTION" && !isFeatureEnabled("AUCTIONS")) throw new Error("AUCTIONS_DISABLED");
      if (artwork.saleMode === "FIXED_PRICE") throw new Error("OFFERS_NOT_ENABLED");
      if (artwork.inventoryState === "SOLD" || artwork.inventoryState === "RESERVED") throw new Error("NOT_AVAILABLE");
      if (artwork.saleMode === "AUCTION" && (!artwork.offerClosesAt || artwork.offerClosesAt.getTime() <= Date.now())) throw new Error("AUCTION_CLOSED");

      const minimum = Math.max(
        artwork.priceCents,
        (artwork.currentHighestOfferAmountCents ?? 0) + Math.max(MIN_INCREMENT_CENTS, Math.ceil(artwork.priceCents * 0.05)),
      );
      if (amountCents < minimum) throw new Error(`MINIMUM_${minimum}`);

      const offer = await tx.offer.create({
        data: { artworkId: artwork.id, bidderId: user?.id, bidderEmail: email, amountCents, currency: artwork.currency },
        select: { id: true, amountCents: true, submittedAt: true, status: true },
      });

      const shouldExtend = artwork.saleMode === "AUCTION" && artwork.offerClosesAt && artwork.offerClosesAt.getTime() - Date.now() <= EXTENSION_WINDOW_MS && artwork.offerExtensionCount < MAX_EXTENSIONS;
      await tx.artwork.update({
        where: { id: artwork.id },
        data: {
          currentHighestOfferId: offer.id,
          currentHighestOfferAmountCents: offer.amountCents,
          ...(shouldExtend ? { offerClosesAt: new Date(artwork.offerClosesAt!.getTime() + EXTENSION_MS), offerExtensionCount: { increment: 1 } } : {}),
        },
      });
      return { offer, artworkTitle: artwork.title, currentAmountCents: offer.amountCents, closesAt: shouldExtend ? new Date(artwork.offerClosesAt!.getTime() + EXTENSION_MS) : artwork.offerClosesAt };
    });
    sendOfferNotificationEmail(email, result.artworkTitle, `${(amountCents / 100).toFixed(2)}`).catch(() => undefined);
    return apiJson(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return apiContractError("NOT_FOUND", "Artwork not found", 404);
    if (code === "OFFERS_NOT_ENABLED") return apiContractError("OFFERS_NOT_ENABLED", "This artwork is not accepting offers", 409);
    if (code === "NOT_AVAILABLE") return apiContractError("ARTWORK_UNAVAILABLE", "This artwork is no longer available", 409);
    if (code === "AUCTION_CLOSED") return apiContractError("AUCTION_CLOSED", "This auction is closed", 409);
    if (code === "AUCTIONS_DISABLED") return apiContractError("FEATURE_DISABLED", "Auctions are not enabled yet", 503);
    if (code.startsWith("MINIMUM_")) return apiContractError("MINIMUM_OFFER", `Offer must be at least ${code.slice(8)} cents`, 409);
    throw error;
  }
}
