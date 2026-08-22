-- Consolidate AdminUser + Customer into one User table. Every login
-- (admin, seller, customer) becomes one identity; what someone can access
-- is layered on top (isAdmin flag, a linked Artist row) rather than a
-- separate account per role.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Migrate existing AdminUser rows into User, preserving id so nothing else
-- needs to change and any existing admin session stays valid.
INSERT INTO "User" ("id", "email", "passwordHash", "name", "isAdmin", "createdAt")
SELECT "id", "email", "passwordHash", "name", true, "createdAt" FROM "AdminUser";

-- Migrate existing Customer rows into User (isAdmin defaults false).
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt")
SELECT "id", "email", "passwordHash", "name", "createdAt" FROM "Customer";

-- Repoint Order.customerId at User instead of Customer (same ids, so no
-- data changes needed — just swap which table the FK targets).
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Repoint PasswordResetToken at User (rename customerId -> userId to match
-- the new relation name).
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_customerId_fkey";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "customerId" TO "userId";
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Artist: drop its own login fields (email/passwordHash) and instead link
-- to a User row — having a linked User is what makes an artist a seller.
ALTER TABLE "Artist" DROP CONSTRAINT IF EXISTS "Artist_email_key";
ALTER TABLE "Artist" DROP COLUMN "email";
ALTER TABLE "Artist" DROP COLUMN "passwordHash";
ALTER TABLE "Artist" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Artist_userId_key" ON "Artist"("userId");
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Old per-role tables are fully replaced by User.
DROP TABLE "AdminUser";
DROP TABLE "Customer";
