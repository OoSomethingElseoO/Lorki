-- Composite indexes for the public catalogue, home showcases, and reservation cleanup.
-- Equality/filter columns come first; createdAt supports the storefront's newest-first order.
CREATE INDEX "Campaign_status_artistId_idx"
  ON "Campaign"("status", "artistId");

CREATE INDEX "Campaign_status_createdAt_idx"
  ON "Campaign"("status", "createdAt");

CREATE INDEX "Artwork_kind_inventoryState_isPublished_createdAt_idx"
  ON "Artwork"("kind", "inventoryState", "isPublished", "createdAt");

CREATE INDEX "Artwork_campaignId_inventoryState_isPublished_createdAt_idx"
  ON "Artwork"("campaignId", "inventoryState", "isPublished", "createdAt");

CREATE INDEX "Artwork_inventoryState_reservedAt_idx"
  ON "Artwork"("inventoryState", "reservedAt");

CREATE INDEX "NewsArticle_status_createdAt_idx"
  ON "NewsArticle"("status", "createdAt");
