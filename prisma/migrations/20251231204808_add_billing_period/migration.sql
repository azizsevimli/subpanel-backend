-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY';

-- CreateIndex
CREATE INDEX "Subscription_billingPeriod_idx" ON "Subscription"("billingPeriod");
