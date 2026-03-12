-- Pivot Tunixo: AI subscriptions -> Gaming & Gift cards top-up
-- Drop old tables (order respects FKs)
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "seller_deposits" CASCADE;
DROP TABLE IF EXISTS "seller_withdrawals" CASCADE;
DROP TABLE IF EXISTS "services" CASCADE;
DROP TABLE IF EXISTS "platform_reserve" CASCADE;

-- Migrate data before altering enums: SELLER -> BUYER, WITHDRAWAL/COMMISSION -> DEBIT
UPDATE "users" SET "role" = 'BUYER' WHERE "role" = 'SELLER';
UPDATE "transactions" SET "type" = 'DEBIT' WHERE "type" IN ('WITHDRAWAL', 'COMMISSION');

-- Replace Role enum (BUYER, ADMIN only)
CREATE TYPE "Role_new" AS ENUM ('BUYER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'BUYER';
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Replace TransactionType enum (CREDIT, DEBIT only)
CREATE TYPE "TransactionType_new" AS ENUM ('CREDIT', 'DEBIT');
ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
DROP TYPE "TransactionType";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";

-- Drop old OrderStatus (no longer used, orders table dropped)
DROP TYPE "OrderStatus";

-- Drop unused enums
DROP TYPE IF EXISTS "AccountStatus";
DROP TYPE IF EXISTS "DepositStatus";
DROP TYPE IF EXISTS "WithdrawalStatus";
DROP TYPE IF EXISTS "DeliveryType";

-- Create new enums
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "ServiceType" AS ENUM ('TOPUP', 'GIFTCARD');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CodeStatus" AS ENUM ('AVAILABLE', 'USED');

-- CreateTable products
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "gameId" TEXT,
    "productId" TEXT,
    "priceTnd" DOUBLE PRECISION NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateTable gift_codes
CREATE TABLE "gift_codes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gift_codes_code_key" ON "gift_codes"("code");

-- CreateTable orders (new structure)
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "playerId" TEXT,
    "zoneId" TEXT,
    "playerUsername" TEXT,
    "deliveredCode" TEXT,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "apiReference" TEXT,
    "apiResponse" JSONB,
    "paymentReference" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey gift_codes -> products
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey orders -> users, products
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON UPDATE CASCADE;
