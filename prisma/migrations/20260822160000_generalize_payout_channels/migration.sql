-- AlterEnum: MPESA_FLUTTERWAVE -> FLUTTERWAVE (generalized beyond Kenya/M-Pesa —
-- Flutterwave itself covers 30+ countries via mobile money and bank transfer)
ALTER TYPE "PayoutChannel" RENAME VALUE 'MPESA_FLUTTERWAVE' TO 'FLUTTERWAVE';

-- AlterTable
ALTER TABLE "Artist" DROP COLUMN "mpesaPhone",
ADD COLUMN     "payoutCountry" TEXT,
ADD COLUMN     "payoutCurrency" TEXT,
ADD COLUMN     "payoutMobileNetwork" TEXT,
ADD COLUMN     "payoutAccountNumber" TEXT,
ADD COLUMN     "payoutBankCode" TEXT;
