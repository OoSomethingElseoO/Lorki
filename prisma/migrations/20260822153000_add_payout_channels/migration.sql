-- CreateEnum
CREATE TYPE "PayoutChannel" AS ENUM ('MANUAL', 'MPESA_FLUTTERWAVE', 'STRIPE_CONNECT');

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "payoutChannel" "PayoutChannel" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "stripeConnectedAccountId" TEXT,
ADD COLUMN     "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false;
