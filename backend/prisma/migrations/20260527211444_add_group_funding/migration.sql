-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULLY_FUNDED', 'DISBURSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LOAN_OPPORTUNITY';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_FUNDING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_FUNDING_APPROVED';

-- CreateTable
CREATE TABLE "group_funding_requests" (
    "id" TEXT NOT NULL,
    "shgId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "minInvestment" DECIMAL(18,2) NOT NULL,
    "maxInvestment" DECIMAL(18,2) NOT NULL,
    "signatureUrl" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "FundingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_funding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_investments" (
    "id" TEXT NOT NULL,
    "fundingRequestId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "shgId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interestRateBps" INTEGER NOT NULL,
    "status" "FundingStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lender_investments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_funding_requests_shgId_status_idx" ON "group_funding_requests"("shgId", "status");

-- CreateIndex
CREATE INDEX "group_funding_requests_status_idx" ON "group_funding_requests"("status");

-- CreateIndex
CREATE INDEX "lender_investments_fundingRequestId_status_idx" ON "lender_investments"("fundingRequestId", "status");

-- CreateIndex
CREATE INDEX "lender_investments_lenderId_status_idx" ON "lender_investments"("lenderId", "status");

-- CreateIndex
CREATE INDEX "lender_investments_shgId_status_idx" ON "lender_investments"("shgId", "status");

-- AddForeignKey
ALTER TABLE "group_funding_requests" ADD CONSTRAINT "group_funding_requests_shgId_fkey" FOREIGN KEY ("shgId") REFERENCES "shg_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_funding_requests" ADD CONSTRAINT "group_funding_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_investments" ADD CONSTRAINT "lender_investments_fundingRequestId_fkey" FOREIGN KEY ("fundingRequestId") REFERENCES "group_funding_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_investments" ADD CONSTRAINT "lender_investments_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_investments" ADD CONSTRAINT "lender_investments_shgId_fkey" FOREIGN KEY ("shgId") REFERENCES "shg_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
