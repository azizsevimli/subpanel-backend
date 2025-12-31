/*
  Warnings:

  - The primary key for the `Platform` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `createdById` column on the `Platform` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `PlatformField` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `Platform` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `PlatformField` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `platformId` on the `PlatformField` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Platform" DROP CONSTRAINT "Platform_createdById_fkey";

-- DropForeignKey
ALTER TABLE "PlatformField" DROP CONSTRAINT "PlatformField_platformId_fkey";

-- AlterTable
ALTER TABLE "Platform" DROP CONSTRAINT "Platform_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "createdById",
ADD COLUMN     "createdById" UUID,
ADD CONSTRAINT "Platform_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformField" DROP CONSTRAINT "PlatformField_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "platformId",
ADD COLUMN     "platformId" UUID NOT NULL,
ADD CONSTRAINT "PlatformField_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "PlatformField_platformId_idx" ON "PlatformField"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformField_platformId_key_key" ON "PlatformField"("platformId", "key");

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformField" ADD CONSTRAINT "PlatformField_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
