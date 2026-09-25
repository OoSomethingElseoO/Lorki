CREATE TYPE "SaleMode" AS ENUM ('FIXED_PRICE', 'OFFERS', 'AUCTION');
CREATE TYPE "OfferStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'WINNING', 'DECLINED', 'EXPIRED', 'CONVERTED');

ALTER TABLE "Artwork"
  ADD COLUMN "saleMode" "SaleMode" NOT NULL DEFAULT 'FIXED_PRICE',
  ADD COLUMN "offerClosesAt" TIMESTAMP(3),
  ADD COLUMN "offerExtensionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentHighestOfferAmountCents" INTEGER,
  ADD COLUMN "currentHighestOfferId" TEXT;
CREATE UNIQUE INDEX "Artwork_currentHighestOfferId_key" ON "Artwork"("currentHighestOfferId");

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL,
  "artworkId" TEXT NOT NULL,
  "bidderId" TEXT,
  "bidderEmail" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "OfferStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Offer_artworkId_status_amountCents_idx" ON "Offer"("artworkId", "status", "amountCents");
CREATE INDEX "Offer_bidderEmail_artworkId_status_idx" ON "Offer"("bidderEmail", "artworkId", "status");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_currentHighestOfferId_fkey" FOREIGN KEY ("currentHighestOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
