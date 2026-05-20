/*
  Warnings:

  - A unique constraint covering the columns `[entityType,entityId,ref]` on the table `ledger_entries` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BORROWER', 'LENDER');

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "chainProcessedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'BORROWER';

-- CreateTable
CREATE TABLE "drift_alerts" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "dbValue" TEXT NOT NULL,
    "chainValue" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drift_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drift_alerts_resolved_createdAt_idx" ON "drift_alerts"("resolved", "createdAt");

-- CreateIndex
CREATE INDEX "drift_alerts_loanId_idx" ON "drift_alerts"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_entityType_entityId_ref_key" ON "ledger_entries"("entityType", "entityId", "ref");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");
