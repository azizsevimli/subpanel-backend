/*
  Warnings:

  - You are about to drop the column `billingDay` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `billingPeriod` on the `Subscription` table. All the data in the column will be lost.
  - Made the column `startDate` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "RepeatUnit" AS ENUM ('MONTH', 'YEAR');

-- DropIndex
DROP INDEX "Subscription_billingPeriod_idx";

-- DropIndex
DROP INDEX "Subscription_createdAt_idx";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "billingDay",
DROP COLUMN "billingPeriod",
ADD COLUMN     "repeatInterval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "repeatUnit" "RepeatUnit" NOT NULL DEFAULT 'MONTH',
ALTER COLUMN "startDate" SET NOT NULL;

-- DropEnum
DROP TYPE "BillingPeriod";

-- CreateIndex
CREATE INDEX "Subscription_repeatUnit_idx" ON "Subscription"("repeatUnit");

-- CreateIndex
CREATE INDEX "Subscription_startDate_idx" ON "Subscription"("startDate");
