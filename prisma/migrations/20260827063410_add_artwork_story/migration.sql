-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_animalId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_conservancyId_fkey";

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "story" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_conservancyId_fkey" FOREIGN KEY ("conservancyId") REFERENCES "Conservancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
