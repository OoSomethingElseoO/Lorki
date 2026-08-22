-- AlterEnum
ALTER TYPE "PayoutChannel" ADD VALUE 'CRYPTO';

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "cryptoNetwork" TEXT,
ADD COLUMN     "cryptoAddress" TEXT;
