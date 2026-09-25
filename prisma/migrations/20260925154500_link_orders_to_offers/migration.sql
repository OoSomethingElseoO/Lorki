ALTER TABLE "Order" ADD COLUMN "offerId" TEXT;
CREATE UNIQUE INDEX "Order_offerId_key" ON "Order"("offerId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
