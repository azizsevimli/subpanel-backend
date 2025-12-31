-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionFieldValue" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "platformFieldId" UUID NOT NULL,
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_platformId_idx" ON "Subscription"("platformId");

-- CreateIndex
CREATE INDEX "SubscriptionFieldValue_subscriptionId_idx" ON "SubscriptionFieldValue"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionFieldValue_platformFieldId_idx" ON "SubscriptionFieldValue"("platformFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionFieldValue_subscriptionId_platformFieldId_key" ON "SubscriptionFieldValue"("subscriptionId", "platformFieldId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionFieldValue" ADD CONSTRAINT "SubscriptionFieldValue_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionFieldValue" ADD CONSTRAINT "SubscriptionFieldValue_platformFieldId_fkey" FOREIGN KEY ("platformFieldId") REFERENCES "PlatformField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
