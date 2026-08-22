-- AlterTable: Campaign.animalId is now optional — a campaign either goes
-- through an Animal (wildlife-specific) or links a Conservancy directly
-- (any other cause), never both/neither (enforced in application code).
ALTER TABLE "Campaign" ALTER COLUMN "animalId" DROP NOT NULL;
ALTER TABLE "Campaign" ADD COLUMN     "conservancyId" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_conservancyId_fkey" FOREIGN KEY ("conservancyId") REFERENCES "Conservancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Conservancy becomes a self-registerable payout recipient,
-- same shape as Artist's payout-channel fields.
ALTER TABLE "Conservancy" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "payoutChannel" "PayoutChannel" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "payoutCountry" TEXT,
ADD COLUMN     "payoutCurrency" TEXT,
ADD COLUMN     "payoutMobileNetwork" TEXT,
ADD COLUMN     "payoutAccountNumber" TEXT,
ADD COLUMN     "payoutBankCode" TEXT,
ADD COLUMN     "stripeConnectedAccountId" TEXT,
ADD COLUMN     "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cryptoNetwork" TEXT,
ADD COLUMN     "cryptoAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Conservancy_userId_key" ON "Conservancy"("userId");

-- AddForeignKey
ALTER TABLE "Conservancy" ADD CONSTRAINT "Conservancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
