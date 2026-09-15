-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'FINANCE_ADMIN', 'OPS_ADMIN', 'VIEWER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" "AdminRole";
