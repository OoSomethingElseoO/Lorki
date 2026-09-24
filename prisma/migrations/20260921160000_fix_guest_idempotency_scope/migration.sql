-- PostgreSQL treats NULL values as distinct in unique indexes, so the
-- original nullable userId made guest idempotency keys non-unique.
-- Retain the newest legacy response for duplicate guest keys before moving
-- all guests into one explicit, non-null scope.
WITH duplicate_guest_rows AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY "idempotencyKey"
      ORDER BY "createdAt" DESC, id DESC
    ) AS row_number
  FROM "IdempotencyStore"
  WHERE "userId" IS NULL
)
DELETE FROM "IdempotencyStore"
WHERE id IN (SELECT id FROM duplicate_guest_rows WHERE row_number > 1);

UPDATE "IdempotencyStore"
SET "userId" = '__guest__'
WHERE "userId" IS NULL;

ALTER TABLE "IdempotencyStore"
  ALTER COLUMN "userId" SET DEFAULT '__guest__',
  ALTER COLUMN "userId" SET NOT NULL;
