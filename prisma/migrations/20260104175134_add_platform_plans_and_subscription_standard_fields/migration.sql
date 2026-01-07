-- AlterEnum
ALTER TYPE "RepeatUnit" ADD VALUE 'WEEK';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "accountEmail" TEXT,
ADD COLUMN     "accountPhone" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "planId" UUID,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformPlan" (
    "id" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformPlan_platformId_idx" ON "PlatformPlan"("platformId");

-- CreateIndex
CREATE INDEX "PlatformPlan_order_idx" ON "PlatformPlan"("order");

-- CreateIndex
CREATE INDEX "PlatformPlan_isActive_idx" ON "PlatformPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPlan_platformId_name_key" ON "PlatformPlan"("platformId", "name");

-- CreateIndex
CREATE INDEX "Subscription_statusChangedAt_idx" ON "Subscription"("statusChangedAt");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- AddForeignKey
ALTER TABLE "PlatformPlan" ADD CONSTRAINT "PlatformPlan_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
