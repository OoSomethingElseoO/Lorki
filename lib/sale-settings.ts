import type { SaleMode } from "@prisma/client";

export function parseSaleSettings(body: { saleMode?: unknown; offerClosesAt?: unknown }) {
  const saleMode = body.saleMode;
  if (saleMode !== "FIXED_PRICE" && saleMode !== "OFFERS" && saleMode !== "AUCTION") {
    throw new Error("saleMode must be FIXED_PRICE, OFFERS, or AUCTION");
  }
  if (saleMode === "FIXED_PRICE" || saleMode === "OFFERS") return { saleMode: saleMode as SaleMode, offerClosesAt: null };
  if (typeof body.offerClosesAt !== "string") throw new Error("An auction closing time is required");
  const close = new Date(body.offerClosesAt);
  if (!Number.isFinite(close.getTime()) || close.getTime() <= Date.now()) throw new Error("Auction closing time must be in the future");
  if (close.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) throw new Error("Auction closing time cannot be more than 30 days away");
  return { saleMode: "AUCTION" as SaleMode, offerClosesAt: close };
}
