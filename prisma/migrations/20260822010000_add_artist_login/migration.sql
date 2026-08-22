-- AlterTable
ALTER TABLE "Artist" ADD COLUMN "email" TEXT,
ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Artist_email_key" ON "Artist"("email");
