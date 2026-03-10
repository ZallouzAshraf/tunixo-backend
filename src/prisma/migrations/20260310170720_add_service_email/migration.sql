/*
  Warnings:

  - You are about to drop the column `accountId` on the `orders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_accountId_fkey";

-- DropIndex
DROP INDEX "orders_accountId_key";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "accountId",
ADD COLUMN     "serviceEmail" TEXT;
