UPDATE "PrintVariant" SET "material" = 'Unframed' WHERE "material" IS NULL;
ALTER TABLE "PrintVariant" ALTER COLUMN "material" SET DEFAULT 'Unframed';
ALTER TABLE "PrintVariant" ALTER COLUMN "material" SET NOT NULL;
