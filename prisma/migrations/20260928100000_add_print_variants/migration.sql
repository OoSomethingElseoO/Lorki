-- CreateTable
CREATE TABLE "PrintVariant" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "material" TEXT NOT NULL DEFAULT 'Unframed',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintVariant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "printVariantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "productOption" TEXT;
ALTER TABLE "Order" ADD COLUMN "productWidthMm" INTEGER;
ALTER TABLE "Order" ADD COLUMN "productHeightMm" INTEGER;

-- CreateIndex
CREATE INDEX "PrintVariant_artworkId_isPublished_idx" ON "PrintVariant"("artworkId", "isPublished");
CREATE UNIQUE INDEX "PrintVariant_artworkId_size_material_key" ON "PrintVariant"("artworkId", "size", "material");
CREATE INDEX "Order_printVariantId_idx" ON "Order"("printVariantId");

-- AddForeignKey
ALTER TABLE "PrintVariant" ADD CONSTRAINT "PrintVariant_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_printVariantId_fkey" FOREIGN KEY ("printVariantId") REFERENCES "PrintVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
