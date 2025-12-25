-- CreateEnum
CREATE TYPE "PlatformFieldType" AS ENUM ('TEXT', 'NUMBER', 'EMAIL', 'PASSWORD', 'SELECT', 'MULTISELECT', 'CHECKBOX', 'TEXTAREA');

-- CreateTable
CREATE TABLE "PlatformField" (
    "id" SERIAL NOT NULL,
    "platformId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "PlatformFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "optionsJson" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformField_platformId_idx" ON "PlatformField"("platformId");

-- CreateIndex
CREATE INDEX "PlatformField_order_idx" ON "PlatformField"("order");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformField_platformId_key_key" ON "PlatformField"("platformId", "key");

-- AddForeignKey
ALTER TABLE "PlatformField" ADD CONSTRAINT "PlatformField_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
