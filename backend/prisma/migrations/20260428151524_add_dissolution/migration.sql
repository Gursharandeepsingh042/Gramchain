-- AlterTable
ALTER TABLE "shg_groups" ADD COLUMN     "dissolutionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "dissolution_votes" (
    "id" TEXT NOT NULL,
    "shgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dissolution_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dissolution_votes_shgId_userId_key" ON "dissolution_votes"("shgId", "userId");

-- AddForeignKey
ALTER TABLE "dissolution_votes" ADD CONSTRAINT "dissolution_votes_shgId_fkey" FOREIGN KEY ("shgId") REFERENCES "shg_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
