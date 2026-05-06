-- ─────────────────────────────────────────────
-- P1: Razorpay payment orders
-- Adds PaymentOrder table + PaymentStatus enum
-- Adds PAYMENT_CAPTURE / PAYMENT_REFUND to LedgerType
-- ─────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'ATTEMPTED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- AlterEnum: add new ledger types (Postgres requires one ALTER per value)
ALTER TYPE "LedgerType" ADD VALUE 'PAYMENT_CAPTURE';
ALTER TYPE "LedgerType" ADD VALUE 'PAYMENT_REFUND';

-- CreateTable
CREATE TABLE "payment_orders" (
    "id"                TEXT          NOT NULL,
    "userId"            TEXT          NOT NULL,
    "razorpayOrderId"   TEXT          NOT NULL,
    "razorpayPaymentId" TEXT,
    "amountPaise"       INTEGER       NOT NULL,
    "currency"          TEXT          NOT NULL DEFAULT 'INR',
    "purpose"           TEXT          NOT NULL,
    "refType"           TEXT          NOT NULL,
    "refId"             TEXT          NOT NULL,
    "status"            "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "signature"         TEXT,
    "failureReason"     TEXT,
    "capturedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_razorpayOrderId_key"
    ON "payment_orders"("razorpayOrderId");
CREATE INDEX "payment_orders_userId_status_createdAt_idx"
    ON "payment_orders"("userId", "status", "createdAt");
CREATE INDEX "payment_orders_refType_refId_idx"
    ON "payment_orders"("refType", "refId");

-- AddForeignKey
ALTER TABLE "payment_orders"
    ADD CONSTRAINT "payment_orders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
