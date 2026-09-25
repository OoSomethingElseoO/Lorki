-- Admin-configurable word pools for the three hero headline lines.
-- Nullable keeps existing installations and branding rows valid; the
-- application supplies safe defaults when this is unset.
ALTER TABLE "Settings" ADD COLUMN "heroHeadlineWords" JSONB;
