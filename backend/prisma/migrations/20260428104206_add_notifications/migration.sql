-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'REPAID', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'LEADER');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('LENDER_DEPOSIT', 'LOAN_DISBURSAL', 'EMI_RECEIVED', 'INTEREST_ACCRUED', 'PLATFORM_FEE', 'DEFAULT_WRITEOFF');

-- CreateEnum
CREATE TYPE "OutboxJobStatus" AS ENUM ('PENDING', 'QUEUED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOAN_APPROVAL_REQUEST', 'LOAN_APPROVED', 'LOAN_REJECTED', 'MEMBER_REMOVED', 'GROUP_INVITE', 'DISSOLUTION_VOTE', 'KYC_REMINDER', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "googleId" TEXT,
    "email" TEXT,
    "aadhaarHash" TEXT,
    "panHash" TEXT,
    "walletAddress" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycDetails" TEXT,
    "name" TEXT,
    "fcmToken" TEXT,
    "password" TEXT,
    "lastKycReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shg_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "village" TEXT,
    "poolContractAddress" TEXT,
    "description" TEXT,
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shg_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shg_members" (
    "userId" TEXT NOT NULL,
    "shgId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shg_members_pkey" PRIMARY KEY ("userId","shgId")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shgId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interestRateBps" INTEGER NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "purpose" TEXT,
    "mlScore" INTEGER,
    "mlRiskBand" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "contractLoanId" INTEGER,
    "isSyncedOnChain" BOOLEAN NOT NULL DEFAULT false,
    "disbursedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "nextEmiDue" TIMESTAMP(3),
    "emiAmount" DECIMAL(18,2),
    "emisPaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_jobs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobData" JSONB NOT NULL,
    "status" "OutboxJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_blockchain_jobs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobData" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_blockchain_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txHash" TEXT NOT NULL,
    "upiRef" TEXT,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'CONFIRMED',

    CONSTRAINT "repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "shgId" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "attendees" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_records" (
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_records_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balancePaise" INTEGER NOT NULL,
    "ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_sync_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastProcessedBlock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_aadhaarHash_key" ON "users"("aadhaarHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_panHash_key" ON "users"("panHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "shg_groups_inviteCode_key" ON "shg_groups"("inviteCode");

-- CreateIndex
CREATE INDEX "loans_memberId_idx" ON "loans"("memberId");

-- CreateIndex
CREATE INDEX "loans_status_nextEmiDue_idx" ON "loans"("status", "nextEmiDue");

-- CreateIndex
CREATE INDEX "loans_contractLoanId_idx" ON "loans"("contractLoanId");

-- CreateIndex
CREATE INDEX "loans_isSyncedOnChain_idx" ON "loans"("isSyncedOnChain");

-- CreateIndex
CREATE INDEX "outbox_jobs_status_createdAt_idx" ON "outbox_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repayments_txHash_key" ON "repayments"("txHash");

-- CreateIndex
CREATE INDEX "repayments_loanId_idx" ON "repayments"("loanId");

-- CreateIndex
CREATE INDEX "otp_records_expiresAt_idx" ON "otp_records"("expiresAt");

-- CreateIndex
CREATE INDEX "ledger_entries_entityType_entityId_createdAt_idx" ON "ledger_entries"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "bank_accounts_userId_idx" ON "bank_accounts"("userId");

-- AddForeignKey
ALTER TABLE "shg_members" ADD CONSTRAINT "shg_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shg_members" ADD CONSTRAINT "shg_members_shgId_fkey" FOREIGN KEY ("shgId") REFERENCES "shg_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_shgId_fkey" FOREIGN KEY ("shgId") REFERENCES "shg_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_shgId_fkey" FOREIGN KEY ("shgId") REFERENCES "shg_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
