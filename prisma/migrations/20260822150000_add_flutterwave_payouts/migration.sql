-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "mpesaPhone" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "flutterwaveSecretKey" TEXT,
ADD COLUMN     "flutterwaveWebhookSecret" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "flutterwaveTransferId" TEXT,
ADD COLUMN     "flutterwaveTransferStatus" TEXT;
