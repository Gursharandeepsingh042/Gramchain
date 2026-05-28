import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ log: ['warn'] })

async function main() {
  const loans = await (prisma as any).loan.findMany({
    select: { id: true, memberId: true, amount: true, status: true, shgId: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  console.log('\n=== Member Loans ===')
  loans.forEach((l: any) => console.log(`  member=${l.memberId} shg=${l.shgId} amount=${l.amount} status=${l.status}`))

  const shgLoans = await (prisma as any).loan.groupBy({
    by: ['shgId'],
    _sum: { amount: true },
    _count: { id: true },
  })
  console.log('\n=== Loans per SHG ===')
  shgLoans.forEach((g: any) => console.log(`  shg=${g.shgId} totalAmount=${g._sum.amount} count=${g._count.id}`))

  await prisma.$disconnect()
}

main().catch(console.error)
